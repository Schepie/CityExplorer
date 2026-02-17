import React, { useEffect, useState, useRef, useMemo } from 'react';
import Map, { Source, Layer, Marker, Popup, useMap } from '@vis.gl/react-maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Maximize, Plus, Minus, X, Volume2, Play, Pause, Layers } from 'lucide-react';
import { calcDistance, calcBearing, getDistanceToSegment, getPointProgressOnPath } from '../utils/geometry';
import PoiDetailContent from './PoiDetailContent';
import BackgroundKeepAlive from './BackgroundKeepAlive';
import { interleaveRouteItems } from '../utils/routeUtils';
import NavigationMapHeadingUp from './NavigationMapHeadingUp';
import { maybeSpeakStep } from '../utils/navigationScheduler';
import { getBestVoice } from '../utils/speechUtils';

// Constants
// Constants
const STYLE_OPENFREEMAP = 'https://tiles.openfreemap.org/styles/bright';
const STYLE_OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
// Use MapTiler if key is present, otherwise fallback to Carto Voyager
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
// Base styles
const STYLE_CARTO = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const STYLE_MAPTILER_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;

const EMPTY_ARRAY = [];

// Helper: Standard Coordinate Sanitizer
const isValidCoord = (p) => {
    return Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number' &&
        !isNaN(p[0]) &&
        !isNaN(p[1]) &&
        isFinite(p[0]) &&
        isFinite(p[1]);
};

// Use this to strip any 3rd/4th elements that might crash MapLibre
const normalizeCoord = (p) => {
    if (!isValidCoord(p)) return null;
    return [p[0], p[1]];
};

const sanitizePath = (path, name = 'path') => {
    if (!path || !Array.isArray(path)) return [];
    // Filter AND normalize to exactly 2 numbers [lng, lat]
    return path
        .map(p => normalizeCoord(p))
        .filter(p => p !== null);
};

const MapLibreContainer = ({
    routeData,
    language,
    onPoiClick,
    speakingId,
    isSpeechPaused,
    onSpeak,
    spokenCharCount,
    userSelectedStyle = 'walking',
    isSimulating,
    setIsSimulating,
    isSimulationEnabled,
    userLocation,
    setUserLocation,
    activePoiIndex,
    setActivePoiIndex,
    pastDistance = 0,
    viewAction,
    setViewAction,
    navPhase,
    setNavPhase,
    isMapPickMode = false,
    onMapPick,
    routeMarkers = [],
    selectedEditPointIndex = null,
    onEditPointClick,
    isRouteEditMode = false,
    onMovePoint,
    onOpenArMode,
    spokenNavigationEnabled,
    voiceSettings,
    availableVoices,
    focusedLocation,
    searchMode,

    onPopupClose,
    autoAudio
}) => {
    // Refs & State
    const mapRef = useRef(null);
    const [simulationSpeed, setSimulationSpeed] = useState(1);
    const [nearbyPoiIds] = useState(new Set());
    const [navigationPath, setNavigationPath] = useState(null);
    const [is3DMode, setIs3DMode] = useState(false);
    // Style Mode: 'map' or 'satellite'
    const [styleMode, setStyleMode] = useState('map');
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [selectedPoi, setSelectedPoi] = useState(null);
    const [isFollowingUser, setIsFollowingUser] = useState(true); // Control auto-centering

    // Debug: Speech Log
    const [speechLog, setSpeechLog] = useState([]);

    const simDistanceCoveredRef = useRef(0);
    const lastUpdateTimeRef = useRef(0);
    const [pathDistances, setPathDistances] = useState([]);

    const voiceTriggerStateRef = useRef({});
    const popupHighlightedWordRef = useRef(null);
    const speechUtteranceRef = useRef(null);

    const { pois = EMPTY_ARRAY, center, routePath, routeMarkers: persistentMarkers = EMPTY_ARRAY, navigationSteps = EMPTY_ARRAY } = routeData || {};

    // Unified list of all targets (POIs + Manual waypoints) interleaved by their position on path
    const navPoints = useMemo(() => {
        const interleaved = interleaveRouteItems(persistentMarkers, pois, routePath);
        // We usually want to navigate TO the points, so we exclude the Start point (index 0)
        return interleaved.slice(1);
    }, [persistentMarkers, pois, routePath]);

    const isNavigating = navPhase !== 'PRE_ROUTE' && navPhase !== 'COMPLETED' && !!routeData;

    // Default center (Amsterdam)
    const getInitialViewState = () => {
        const isNum = (v) => typeof v === 'number' && !isNaN(v);
        const lat = center && isNum(center[0]) ? center[0] : 52.3676;
        const lng = center && isNum(center[1]) ? center[1] : 4.9041;
        return {
            latitude: lat,
            longitude: lng,
            zoom: 13,
            pitch: 0,
            bearing: 0
        };
    };

    const [viewState, setViewState] = useState(getInitialViewState);

    // Sync with center prop - disabled when in edit/pick mode to prevent screen jumping
    useEffect(() => {
        const isNum = (v) => typeof v === 'number' && !isNaN(v) && isFinite(v);
        if (center && isNum(center[0]) && isNum(center[1]) && !isRouteEditMode && !isMapPickMode) {
            const latDiff = Math.abs(viewState.latitude - center[0]);
            const lngDiff = Math.abs(viewState.longitude - center[1]);
            if (latDiff > 0.01 || lngDiff > 0.01) {
                setViewState(prev => ({ ...prev, latitude: center[0], longitude: center[1] }));
            }
        }
    }, [center, isRouteEditMode, isMapPickMode]);

    // Handle focusedLocation (intentional centering, e.g. from city search)
    useEffect(() => {
        if (focusedLocation && isValidCoord([focusedLocation.lng, focusedLocation.lat])) {
            setViewState(prev => ({
                ...prev,
                latitude: focusedLocation.lat,
                longitude: focusedLocation.lng,
                zoom: 14,
                transitionDuration: 1000
            }));
        }
    }, [focusedLocation]);

    const getGlobalIndex = (item) => {
        const interleaved = interleaveRouteItems(persistentMarkers, pois, routePath);
        return interleaved.findIndex(i => i.id === item.id);
    };

    const getManeuverIcon = (modifier, type) => {
        if (type === 'arrive') return '🏁';
        if (type === 'depart') return '🚀';
        switch (modifier) {
            case 'left': return '⬅️';
            case 'right': return '➡️';
            case 'sharp left': return '↙️';
            case 'sharp right': return '↘️';
            case 'slight left': return '↖️';
            case 'slight right': return '↗️';
            case 'straight': return '⬆️';
            case 'uturn': return '🔄';
            default: return '⬆️';
        }
    };

    const translateHUDInstruction = (step, lang) => {
        const { maneuver, name } = step;

        if (maneuver.type === 'arrive') {
            const currentPoi = navPoints[activePoiIndex];
            if (currentPoi) {
                const poiName = currentPoi.name || (lang === 'nl' ? 'Bestemming' : 'Destination');
                const poiIndex = activePoiIndex + 1;
                return lang === 'nl'
                    ? `POI ${poiIndex}, ${poiName} bereikt`
                    : `POI ${poiIndex}, ${poiName} reached`;
            }
            return lang === 'nl' ? `Bestemming bereikt` : `Arrive at destination`;
        }

        if (lang === 'en') {
            if (maneuver.type === 'depart') return `Head on ${name || 'path'} `;
            const mod = maneuver.modifier || '';
            return `${maneuver.type} ${mod} onto ${name || 'path'} `.replace(/\s+/g, ' ');
        }
        const dirs = {
            'left': 'links', 'right': 'rechts', 'sharp left': 'scherp links', 'sharp right': 'scherp rechts',
            'slight left': 'licht links', 'slight right': 'licht rechts', 'straight': 'rechtdoor', 'uturn': 'omkeren'
        };
        const m = dirs[maneuver.modifier] || maneuver.modifier || '';
        if (maneuver.type === 'depart') return `Vertrek op ${name || 'het pad'} `;
        return `Ga ${m} op ${name || 'het pad'} `.replace(/\s+/g, ' ');
    };

    const speakManeuver = (instruction) => {
        if (!spokenNavigationEnabled || !window.speechSynthesis) return;

        // Debug log with more details
        const targetLang = voiceSettings?.variant === 'en' ? 'en-US' : (voiceSettings?.variant === 'be' ? 'nl-BE' : 'nl-NL');
        const selectedVoice = getBestVoice(availableVoices, targetLang, voiceSettings?.gender || 'female');

        setSpeechLog(prev => {
            const status = window.speechSynthesis.paused ? 'PAUSED' : (window.speechSynthesis.speaking ? 'SPEAKING' : 'IDLE');
            const voiceName = selectedVoice ? selectedVoice.name.substring(0, 15) + '...' : 'DEFAULT';
            const time = new Date().toLocaleTimeString().split(' ')[0];
            const newLog = [{ time, text: instruction, meta: `[${status}] ${voiceName} ` }, ...prev];
            return newLog.slice(0, 5);
        });

        // Prevent cutting off the SAME instruction ...
        if (speechUtteranceRef.current && (speechUtteranceRef.current instanceof Set) && Array.from(speechUtteranceRef.current).some(u => u.text === instruction)) {
            return;
        }

        const utterance = new SpeechSynthesisUtterance(instruction);

        // ... ref set logic ... 
        if (!speechUtteranceRef.current) {
            speechUtteranceRef.current = new Set();
        } else if (!(speechUtteranceRef.current instanceof Set)) {
            const old = speechUtteranceRef.current;
            speechUtteranceRef.current = new Set();
            speechUtteranceRef.current.add(old);
        }
        speechUtteranceRef.current.add(utterance);

        utterance.onend = () => {
            speechUtteranceRef.current.delete(utterance);
        };
        utterance.onerror = (e) => {
            console.error("Speech Error:", e);
            speechUtteranceRef.current.delete(utterance);
        };

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = language === 'nl' ? 'nl-NL' : 'en-US';
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // CRITICAL FIX: Chrome sometimes pauses speech, forcing resume helps unlock the queue
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
    };

    const routeGeoJson = useMemo(() => {
        if (!routePath || routePath.length < 2) return null;
        // Strict mapping with null checks before sanitizePath
        const mapped = routePath.map(p => {
            const lat = typeof p[0] === 'number' ? p[0] : parseFloat(p[0]);
            const lng = typeof p[1] === 'number' ? p[1] : parseFloat(p[1]);
            return [lng, lat];
        });
        const validCoords = sanitizePath(mapped, 'routePath');
        if (validCoords.length < 2) return null;
        return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: validCoords },
            properties: { id: 'route' }
        };
    }, [routePath]);

    const navigationGeoJson = useMemo(() => {
        if (!navigationPath || !navigationPath.coordinates || navigationPath.coordinates.length < 2) return null;
        // Ensure coordinates are NOT null before sanitizePath
        const cleanCoords = navigationPath.coordinates.filter(loc => Array.isArray(loc) && loc.length >= 2 && typeof loc[0] === 'number' && typeof loc[1] === 'number');
        const validCoords = sanitizePath(cleanCoords, 'navigationPath');
        if (validCoords.length < 2) return null;

        let displayCoords = validCoords;
        if (isNavigating && userLocation && typeof userLocation.lng === 'number' && typeof userLocation.lat === 'number') {
            let minD = Infinity;
            let closestIdx = 0;
            for (let i = 0; i < validCoords.length; i++) {
                const pt = { lng: validCoords[i][0], lat: validCoords[i][1] };
                const d = calcDistance(userLocation, pt);
                if (d < minD) { minD = d; closestIdx = i; }
            }
            if (closestIdx < validCoords.length - 1) {
                const remaining = validCoords.slice(closestIdx);
                displayCoords = [[userLocation.lng, userLocation.lat], ...remaining];
            }
        }
        return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: displayCoords },
            properties: { id: 'nav' }
        };
    }, [navigationPath, userLocation, isNavigating]);

    // Path distances calculation
    useEffect(() => {
        if (!routePath || routePath.length < 2) {
            setNavigationPath(null);
            setPathDistances([]);
            return;
        }
        const coordinates = sanitizePath(routePath.map(p => {
            const lat = typeof p[0] === 'number' ? p[0] : parseFloat(p[0]);
            const lng = typeof p[1] === 'number' ? p[1] : parseFloat(p[1]);
            return [lng, lat];
        }), 'navigationPathEffect');
        let total = 0;
        const distances = [0];
        for (let i = 0; i < coordinates.length - 1; i++) {
            const p1 = { lat: coordinates[i][1], lng: coordinates[i][0] };
            const p2 = { lat: coordinates[i + 1][1], lng: coordinates[i + 1][0] };
            total += calcDistance(p1, p2);
            distances.push(total);
        }
        setPathDistances(distances);
        setNavigationPath({ coordinates, steps: navigationSteps || [] });
    }, [routePath, navigationSteps]);

    // Smooth Simulation Loop
    useEffect(() => {
        if (!isSimulating || !navigationPath || pathDistances.length < 2) return;

        const baselineSpeedKmh = userSelectedStyle === 'cycling' ? 15 : 5;
        const tickRateMs = 50;
        lastUpdateTimeRef.current = performance.now();

        const interval = setInterval(() => {
            const now = performance.now();
            const deltaTimeMs = now - lastUpdateTimeRef.current;
            lastUpdateTimeRef.current = now;

            const speedMultiplier = simulationSpeed;
            const distanceInTick = (baselineSpeedKmh / 3600000) * deltaTimeMs * speedMultiplier;

            simDistanceCoveredRef.current += distanceInTick;
            const currentDist = simDistanceCoveredRef.current;
            const totalPathDist = pathDistances[pathDistances.length - 1];

            if (currentDist < totalPathDist) {
                let segmentIndex = 0;
                while (segmentIndex < pathDistances.length - 1 && pathDistances[segmentIndex + 1] < currentDist) {
                    segmentIndex++;
                }

                const dStart = pathDistances[segmentIndex];
                const dEnd = pathDistances[segmentIndex + 1];
                const segmentProgress = (currentDist - dStart) / (dEnd - dStart);

                const coordStart = navigationPath.coordinates[segmentIndex];
                const coordEnd = navigationPath.coordinates[segmentIndex + 1];

                const lng = coordStart[0] + (coordEnd[0] - coordStart[0]) * segmentProgress;
                const lat = coordStart[1] + (coordEnd[1] - coordStart[1]) * segmentProgress;

                let bearing = 0;
                try {
                    bearing = calcBearing({ lat: coordStart[1], lng: coordStart[0] }, { lat: coordEnd[1], lng: coordEnd[0] }) || 0;
                } catch (e) { }

                const speedKmh = baselineSpeedKmh * speedMultiplier;
                const currentLoc = { lat, lng, heading: bearing, speed: speedKmh };
                setUserLocation(currentLoc);
                setCurrentSpeed(speedKmh);

                if (navPoints.length > 0 && activePoiIndex < navPoints.length) {
                    const targetPoi = navPoints[activePoiIndex];
                    const distToPoi = calcDistance(currentLoc, targetPoi);
                    if (distToPoi < 0.035) {
                        setActivePoiIndex(prev => Math.min(prev + 1, navPoints.length - 1));
                    }
                }
            } else {
                const lastCoord = navigationPath.coordinates[navigationPath.coordinates.length - 1];
                setUserLocation({ lat: lastCoord[1], lng: lastCoord[0], heading: 0 });
                setCurrentSpeed(0);
                clearInterval(interval);
                setIsSimulating(false);
            }
        }, tickRateMs);

        return () => clearInterval(interval);
    }, [isSimulating, navigationPath, pathDistances, simulationSpeed, userSelectedStyle, navPoints, activePoiIndex]);

    // View Actions
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current.getMap();
        if (viewAction === 'USER') {
            if (userLocation && typeof userLocation.lng === 'number' && typeof userLocation.lat === 'number') {
                map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 17.5, duration: 1500 });
                setViewAction(null);
            } else {
                console.warn("[Map] Locate Me requested but userLocation is missing or invalid.");
                // We don't nullify viewAction yet, so it can try again once userLocation updates?
                // Actually, better to nullify and let the user click again to avoid unexpected jumps later.
                // But we should probably notify the user.
                setViewAction(null);
            }
        } else if (viewAction === 'ROUTE' && routePath && routePath.length > 0) {
            console.log('[Zoom to Route] routePath sample:', routePath.slice(0, 3));

            // Validate that we have at least one valid coordinate
            // routePath is stored as [lat, lng], but MapLibre needs [lng, lat]
            if (routePath[0] && isValidCoord([routePath[0][1], routePath[0][0]])) {
                const firstPoint = [routePath[0][1], routePath[0][0]]; // [lng, lat]

                // Filter and build bounds only from valid coordinates
                const validPoints = routePath.filter(p => p && isValidCoord([p[1], p[0]]));

                console.log('[Zoom to Route] Valid points count:', validPoints.length);
                console.log('[Zoom to Route] First point [lng, lat]:', firstPoint);

                if (validPoints.length > 0) {
                    const bounds = validPoints.reduce((acc, p) => acc.extend([p[1], p[0]]), new maplibregl.LngLatBounds(firstPoint, firstPoint));
                    const boundsArray = bounds.toArray();
                    console.log('[Zoom to Route] Bounds SW [lng,lat]:', boundsArray[0], 'NE [lng,lat]:', boundsArray[1]);
                    console.log('[Zoom to Route] Last point [lng, lat]:', [validPoints[validPoints.length - 1][1], validPoints[validPoints.length - 1][0]]);

                    // Use smaller padding and maxZoom to prevent "cannot fit within canvas" errors
                    try {
                        console.log('[Zoom to Route] Calling fitBounds...');
                        map.fitBounds(bounds, {
                            padding: 20,  // Reduced from 50 to handle small routes
                            duration: 1500,
                            maxZoom: 18   // Prevent over-zooming on tiny routes
                        });
                        console.log('[Zoom to Route] fitBounds call completed');
                    } catch (e) {
                        console.error('[Zoom to Route] fitBounds failed:', e);
                        // Fallback: just center on the middle of the route
                        map.flyTo({ center: firstPoint, zoom: 15, duration: 1500 });
                    }
                }
            } else {
                console.warn('[Zoom to Route] First point invalid or missing:', routePath[0]);
            }
            setViewAction(null);
        }
    }, [viewAction, userLocation, routePath]);

    // Auto-start simulation
    useEffect(() => {
        if (isNavigating && isSimulationEnabled && !isSimulating) {
            simDistanceCoveredRef.current = 0;
            lastUpdateTimeRef.current = performance.now();
            setIsSimulating(true);
        } else if (!isNavigating && isSimulating) {
            setIsSimulating(false);
        }
    }, [isNavigating, isSimulationEnabled]);

    const getPoiIcon = (poi) => {
        const desc = (poi.description || "").toLowerCase();
        const name = (poi.name || "").toLowerCase();
        const full = `${name} ${desc}`;

        let iconHtml = '';
        let color = '#6366f1'; // Default: Indigo (Primary)

        if (full.includes('park') || full.includes('garden') || full.includes('nature') || full.includes('bos') || full.includes('tuin')) {
            color = '#10b981'; // Emerald
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.5-3.5-6-7-6-10 0-3.5 3-5.5 6-5.5s6 2 6 5.5c0 3-2.5 6.5-6 10z"/><circle cx="12" cy="11" r="2"/></svg>`;
        } else if (full.includes('food') || full.includes('restaurant') || full.includes('cafe') || full.includes('eten') || full.includes('drink')) {
            color = '#f59e0b'; // Amber/Orange
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`;
        } else if (full.includes('shop') || full.includes('store') || full.includes('winkel') || full.includes('markt')) {
            color = '#ec4899'; // Pink
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
        } else if (full.includes('museum') || full.includes('art') || full.includes('history') || full.includes('galer') || full.includes('kunst')) {
            color = '#8b5cf6'; // Purple
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><path d="M8 2h8"/><path d="M12 2v20"/><path d="M4 8h16"/></svg>`;
        } else if (full.includes('church') || full.includes('kerk') || full.includes('cathedral') || full.includes('basilica') || full.includes('temple')) {
            color = '#facc15'; // Yellow/Gold
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M7 7h10"/></svg>`;
        } else if (full.includes('view') || full.includes('panorama') || full.includes('lookout') || full.includes('uitzicht') || full.includes('tower')) {
            color = '#0ea5e9'; // Sky Blue
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>`;
        } else if (full.includes('attraction') || full.includes('monument') || full.includes('castle') || full.includes('beziens') || full.includes('kasteel')) {
            color = '#f43f5e'; // Rose
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }

        return { color, iconHtml };
    };

    const progressStats = useMemo(() => {
        if (!isNavigating || !navigationPath) return null;

        // Default / Fallback values
        let remainingKm = 0;

        if (routeData?.routePath) {
            const userProgressKm = getPointProgressOnPath(userLocation, routeData.routePath);
            const totalDistKm = (routeData.stats?.totalDistance || 0) / 1000;
            remainingKm = Math.max(0, totalDistKm - userProgressKm);
        } else if (navigationPath.steps && navigationPath.steps.length > 0) {
            // Fallback: Old Logic
            const steps = navigationPath.steps;
            let minD = Infinity;
            let closestIdx = 0;
            steps.forEach((s, i) => {
                if (s.maneuver?.location) {
                    const d = calcDistance(userLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                    if (d < minD) { minD = d; closestIdx = i; }
                }
            });
            const targetIdx = Math.min(closestIdx + 1, steps.length - 1);
            if (steps[targetIdx]?.maneuver?.location) {
                const distToTarget = calcDistance(userLocation, { lat: steps[targetIdx].maneuver.location[1], lng: steps[targetIdx].maneuver.location[0] });
                remainingKm = distToTarget + steps.slice(targetIdx + 1).reduce((acc, s) => acc + (s.distance || 0), 0) / 1000;
            }
        }

        const tripTotal = parseFloat(routeData?.stats?.totalDistance || 0) / 1000;
        return {
            leg: { left: remainingKm.toFixed(1) },
            trip: { left: remainingKm.toFixed(1) }
        };
    }, [isNavigating, navigationPath, userLocation, routeData]);

    const hudInstruction = useMemo(() => {
        if (isNavigating && (!navigationPath || !navigationPath.steps || navigationPath.steps.length === 0)) {
            return { icon: '⬆️', text: language === 'nl' ? 'Volg de route' : 'Follow the route', subline: 'NAVIGATION', distance: 0 };
        }
        if (!navigationPath || !navigationPath.steps || navigationPath.steps.length === 0) return null;

        const steps = navigationPath.steps;
        let targetIdx = 0;
        let distanceToNext = 0;

        // NEW LOGIC: Progress based (Robust against midpoint jumps)
        if (routeData?.routePath) {
            const userProgressKm = getPointProgressOnPath(userLocation, routeData.routePath);
            const userProgressM = userProgressKm * 1000;

            let accumulatedM = 0;
            let currentStepIdx = steps.length - 1; // Default to last if off-end

            for (let i = 0; i < steps.length; i++) {
                const stepDist = steps[i].distance || 0;
                // If we are within this step's range
                if (userProgressM < (accumulatedM + stepDist + 5)) { // +5m buffer for precision
                    currentStepIdx = i;
                    break;
                }
                accumulatedM += stepDist;
            }

            targetIdx = Math.min(currentStepIdx + 1, steps.length - 1);

            // Distance to next maneuver is distance to end of current step
            // (which is start of target step)
            // We iterate to find start of target to be precise
            let distToTargetStart = 0;
            for (let i = 0; i < targetIdx; i++) distToTargetStart += (steps[i].distance || 0);

            distanceToNext = Math.max(0, distToTargetStart - userProgressM) / 1000;

        } else {
            // FALLBACK to old logic (Distance Snap)
            let minD = Infinity;
            let closestIdx = 0;
            steps.forEach((s, i) => {
                if (s.maneuver?.location) {
                    const d = calcDistance(userLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                    if (d < minD) { minD = d; closestIdx = i; }
                }
            });
            targetIdx = Math.min(closestIdx + 1, steps.length - 1);
            distanceToNext = calcDistance(userLocation, { lat: steps[targetIdx].maneuver.location[1], lng: steps[targetIdx].maneuver.location[0] });
        }

        const nextStep = steps[targetIdx];
        return {
            icon: getManeuverIcon(nextStep.maneuver?.modifier, nextStep.maneuver?.type),
            text: translateHUDInstruction(nextStep, language),
            subline: steps[Math.max(0, targetIdx - 1)]?.name || (language === 'nl' ? "Huidige weg" : "Current road"),
            distance: distanceToNext,
            lanes: nextStep.intersections?.[0]?.lanes || null
        };
    }, [navigationPath, userLocation, language, isNavigating, routeData]);

    useEffect(() => {
        if (isNavigating && navigationPath && navigationPath.steps && navigationPath.steps.length > 0 && spokenNavigationEnabled) {
            const steps = navigationPath.steps;
            let minD = Infinity;
            let closestIdx = 0;
            steps.forEach((s, i) => {
                if (s.maneuver?.location) {
                    const d = calcDistance(userLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                    if (d < minD) { minD = d; closestIdx = i; }
                }
            });
            const targetIdx = Math.min(closestIdx + 1, steps.length - 1);
            const nextStep = steps[targetIdx];

            // Off-route detection (threshold: 40m)
            // Skip during simulation as we are always on route
            if (!isSimulating && minD > 0.04) {
                const now = Date.now();
                // Only speak "Recalculating" once every 10 seconds
                if (!voiceTriggerStateRef.current.recalc || (now - voiceTriggerStateRef.current.recalc > 10000)) {
                    const text = language === 'nl' ? "Route wordt herberekend." : "Recalculating route.";
                    speakManeuver(text);
                    voiceTriggerStateRef.current.recalc = now;
                }
            }

            if (nextStep && nextStep.maneuver) {
                const distanceM = Math.round(calcDistance(userLocation, { lat: nextStep.maneuver.location[1], lng: nextStep.maneuver.location[0] }) * 1000);

                // Ensure valid distance before planning speech
                if (Number.isFinite(distanceM) && distanceM >= 0) {
                    const followingStep = steps[targetIdx + 1] || null;
                    maybeSpeakStep({
                        mode: userSelectedStyle === 'cycling' ? 'cycling' : 'walking',
                        distanceM,
                        speedMS: (currentSpeed * 1000) / 3600,
                        modifier: nextStep.maneuver.modifier,
                        type: nextStep.maneuver.type,
                        exit: nextStep.maneuver.exit,
                        way: nextStep.name,
                        next: followingStep ? {
                            modifier: followingStep.maneuver.modifier,
                            name: followingStep.name,
                            type: followingStep.maneuver.type,
                            exit: followingStep.maneuver.exit
                        } : null,
                        state: voiceTriggerStateRef.current,
                        id: `step_${targetIdx} `,
                        speakFn: (text) => speakManeuver(text),
                        lang: language
                    });
                }
            }
        }
    }, [isNavigating, userLocation, navigationPath, spokenNavigationEnabled, currentSpeed, userSelectedStyle, language]);

    // Auto-open POI & Audio on Arrival
    const lastTriggeredPoiRef = useRef(null);

    useEffect(() => {
        if (!isNavigating || !userLocation || !navPoints || navPoints.length === 0) return;

        // Target the active POI/Marker
        if (activePoiIndex >= 0 && activePoiIndex < navPoints.length) {
            const targetPoi = navPoints[activePoiIndex];

            const dist = calcDistance(userLocation, targetPoi);

            // 1. Auto-advance (Real Navigation)
            if (!isSimulating && dist < 0.035) {
                setActivePoiIndex(prev => Math.min(prev + 1, navPoints.length - 1));
            }

            // 2. Trigger Popup & Audio (Threshold: 40m)
            if (dist < 0.04 && lastTriggeredPoiRef.current !== targetPoi.id) {
                console.log("Arrived at POI:", targetPoi.name);
                lastTriggeredPoiRef.current = targetPoi.id;

                setSelectedPoi(targetPoi);
                if (autoAudio && onSpeak) {
                    onSpeak(targetPoi);
                }
            }
        }
    }, [isNavigating, userLocation, activePoiIndex, navPoints, autoAudio, onSpeak, isSimulating]);

    const onStyleImageMissing = React.useCallback((e) => {
        const id = e.id;
        // Fix: MapLibre warns if we just return. We must add a dummy image to silence it.
        if (!id || id.trim() === '') {
            const map = e.target;
            if (!map.hasImage(id)) {
                // 1x1 transparent pixel
                const pixel = new Uint8Array(4); // [0,0,0,0]
                map.addImage(id, { width: 1, height: 1, data: pixel }, { pixelRatio: 1 });
            }
            return;
        }

        const map = e.target;
        if (map.hasImage(id)) return;

        // Categorize by name for better fallback colors
        let color = '#64748b'; // Default: Slate-500
        const lowerId = id.toLowerCase();

        // Barriers & Gates
        if (['gate', 'lift_gate', 'cycle_barrier', 'bollard', 'stile', 'sally_port', 'barrier'].some(k => lowerId.includes(k))) {
            color = '#475569'; // Slate-600
        }
        // Amenities & Services
        else if (['recycling', 'atm', 'parking', 'office', 'toilets', 'bench'].some(k => lowerId.includes(k))) {
            color = '#3b82f6'; // Blue-500
        }
        // Sports & Leisure
        else if (['pool', 'sports', 'gym', 'equestrian', 'running', 'archery', 'billiards', 'racing', 'athletics', 'diving', 'rink', 'climbing', 'park', 'playground'].some(k => lowerId.includes(k))) {
            color = '#10b981'; // Emerald-500
        }
        // Food & Drink
        else if (['restaurant', 'cafe', 'bar', 'pub', 'food'].some(k => lowerId.includes(k))) {
            color = '#f59e0b'; // Amber-500
        }

        const width = 24;
        const height = 24;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, width / 2 - 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            const imageData = ctx.getImageData(0, 0, width, height);
            // Use pixelRatio 1 for reliable display of generated dots
            map.addImage(id, imageData, { pixelRatio: 1 });
        }
    }, []);

    // Determine current Map Style URL
    const currentMapStyle = useMemo(() => {
        // 1. Satellite always uses MapTiler (if key is present)
        if (styleMode === 'satellite' && MAPTILER_KEY) {
            return STYLE_MAPTILER_SATELLITE;
        }

        // 2. Use Liberty style in 3D mode if NOT in satellite mode
        if (is3DMode) {
            return STYLE_OPENFREEMAP_LIBERTY;
        }

        // 3. Default to OpenFreeMap Bright (Fast, High-performance, Keyless)
        return STYLE_OPENFREEMAP;
    }, [styleMode, is3DMode]);

    return (
        <div className="relative h-full w-full glass-panel overflow-hidden border-2 border-primary/20 shadow-2xl shadow-primary/10">
            <BackgroundKeepAlive isActive={isNavigating} language={language} />

            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                ref={mapRef}
                mapLibre={maplibregl?.default || maplibregl}
                mapStyle={currentMapStyle}
                style={{ width: '100%', height: '100%' }}
                onStyleImageMissing={onStyleImageMissing}
                onError={e => {
                    console.error("[MapDebug] MapLibre Internal Error:", e.error);
                }}
                onClick={e => {
                    if (isMapPickMode && onMapPick) onMapPick(e.lngLat);
                    else setSelectedPoi(null);
                }}
            >
                <NavigationMapHeadingUp
                    isNavigating={isNavigating}
                    userLocation={userLocation}
                    is3DMode={is3DMode}
                />

                {routeGeoJson && (
                    <Source id="planned-route" type="geojson" data={routeGeoJson}>
                        <Layer
                            id="route-line"
                            type="line"
                            paint={{
                                'line-color': '#6366f1',
                                'line-width': 4,
                                'line-dasharray': [2, 2],
                                'line-opacity': 0.6
                            }}
                        />
                    </Source>
                )}

                {navigationGeoJson && (
                    <Source id="nav-leg" type="geojson" data={navigationGeoJson}>
                        <Layer
                            id="nav-line"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={{
                                'line-color': '#3b82f6',
                                'line-width': 8,
                                'line-opacity': 0.8
                            }}
                        />
                    </Source>
                )}

                {(isRouteEditMode ? routeMarkers : persistentMarkers)?.map((point, idx) => {
                    if (!isValidCoord([point.lng, point.lat])) return null;
                    const isStart = idx === 0;
                    const isSelected = selectedEditPointIndex === idx;
                    const isFocused = focusedLocation &&
                        Math.abs(point.lat - focusedLocation.lat) < 0.0001 &&
                        Math.abs(point.lng - focusedLocation.lng) < 0.0001;
                    const globalIdx = getGlobalIndex(point);
                    return (
                        <Marker
                            key={`route-marker-${point.id || idx}`}
                            longitude={point.lng}
                            latitude={point.lat}
                            anchor="center"
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                if (isRouteEditMode && onEditPointClick) onEditPointClick(idx);
                                else if (!isRouteEditMode && onPoiClick) onPoiClick(point);
                            }}
                            draggable={isRouteEditMode}
                            onDragEnd={e => onMovePoint && onMovePoint(idx, e.lngLat)}
                        >
                            <div className={`flex flex-col items-center cursor-pointer transition-all ${isSelected ? 'scale-110' : 'scale-100'} ${isFocused ? 'selected-marker-focus' : ''}`}>
                                <div className={`
                                    ${isStart ? 'w-10 h-10 rounded-full bg-green-500' : (isSelected ? 'w-6 h-6 rounded bg-amber-500' : 'w-6 h-6 rounded bg-indigo-600')}
border-2 border-white shadow-lg flex items-center justify-center font-black text-white
                                    ${isStart ? 'text-[10px]' : 'text-[9px] rotate-45'}
`}>
                                    <div className={isStart ? '' : '-rotate-45'}>{isStart ? 'START' : globalIdx}</div>
                                </div>
                            </div>
                        </Marker>
                    );
                })}

                {userLocation && isValidCoord([userLocation.lng, userLocation.lat]) && (
                    <Marker
                        longitude={userLocation.lng}
                        latitude={userLocation.lat}
                        anchor="center"
                        zIndex={1000}
                        rotation={userLocation.heading || 0}
                        rotationAlignment="map"
                    >
                        <div className="relative">
                            {isNavigating ? (
                                <div className="navigation-marker-3d">
                                    <div className="marker-3d-shadow" />
                                    <div className="marker-3d-arrow" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-primary" />
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                </div>
                            )}
                        </div>
                    </Marker>
                )}

                {pois.map(poi => {
                    if (!isValidCoord([poi.lng, poi.lat])) return null;
                    const isFocused = focusedLocation &&
                        Math.abs(poi.lat - focusedLocation.lat) < 0.0001 &&
                        Math.abs(poi.lng - focusedLocation.lng) < 0.0001;
                    const { color, iconHtml } = getPoiIcon(poi);
                    return (
                        <Marker
                            key={poi.id}
                            longitude={poi.lng}
                            latitude={poi.lat}
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                setSelectedPoi(poi);
                                if (onPoiClick) onPoiClick(poi);

                                // Center POI 1/10th from bottom (flyTo with positive Y offset)
                                if (mapRef.current) {
                                    const map = mapRef.current.getMap();
                                    const h = map.getCanvas().clientHeight;
                                    map.flyTo({
                                        center: [poi.lng, poi.lat],
                                        offset: [0, h * 0.4], // Shift center down by 40% of height -> point appears at 90% height
                                        zoom: 18,
                                        speed: 1.5,
                                        curve: 1
                                    });
                                }
                            }}
                            anchor="bottom"
                        >
                            <div
                                className={`poi-drip-marker flex flex-col items-center justify-center ${isFocused ? 'selected-marker-focus' : ''}`}
                                style={{ color: color }}
                            >
                                <div className="poi-drip-marker-content">
                                    {iconHtml ? <div className="mb-[1px] -mt-1 scale-75 text-white" dangerouslySetInnerHTML={{ __html: iconHtml }} /> : null}
                                    <span className="text-[10px] font-black text-white leading-none">{getGlobalIndex(poi)}</span>
                                </div>
                            </div>
                        </Marker>
                    );
                })}

                {selectedPoi && isValidCoord([selectedPoi.lng, selectedPoi.lat]) && (
                    <Popup
                        longitude={selectedPoi.lng}
                        latitude={selectedPoi.lat}
                        anchor="bottom"
                        onClose={() => { setSelectedPoi(null); if (onPopupClose) onPopupClose(); }}
                        closeButton={false}
                        className="custom-poi-popup"
                        maxWidth="320px"
                    >
                        <div className="text-slate-900 w-full p-4 overflow-hidden relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setSelectedPoi(null); if (onPopupClose) onPopupClose(); }}
                                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                            >
                                <X size={16} />
                            </button>
                            <div className="flex justify-between items-start gap-4 mb-3 mr-6">
                                <h3 className="font-bold text-lg m-0 leading-tight">{selectedPoi.name}</h3>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSpeak(selectedPoi); }}
                                    className={`h-10 w-10 flex items-center justify-center rounded-full transition-all duration-300 ${speakingId === selectedPoi.id ? 'bg-primary text-white shadow-lg scale-105 ring-2 ring-primary/20' : 'bg-slate-100 text-slate-500 hover:text-primary hover:bg-primary/10'}`}
                                    title={speakingId === selectedPoi.id ? (isSpeechPaused ? "Resume" : "Pause") : "Listen"}
                                >
                                    {speakingId === selectedPoi.id ? (
                                        isSpeechPaused ? <Play size={20} className="ml-0.5 fill-current" /> : <Pause size={20} className="fill-current" />
                                    ) : (
                                        <Volume2 size={20} />
                                    )}
                                </button>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                <PoiDetailContent
                                    poi={selectedPoi}
                                    language={language}
                                    speakingId={speakingId}
                                    spokenCharCount={spokenCharCount}
                                    highlightRef={popupHighlightedWordRef}
                                    isDark={false}
                                />
                            </div>
                        </div>
                    </Popup>
                )}
            </Map>

            {routeData && (
                <>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl bg-slate-900/95 w-[90%] max-w-[340px] p-3 flex items-center gap-3">
                        {isNavigating && hudInstruction && (
                            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-2xl shadow-inner border border-white/20">
                                {hudInstruction.icon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            {isNavigating && hudInstruction ? (
                                <>
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <span className="text-[10px] uppercase tracking-wider text-blue-400 font-black truncate">{hudInstruction.subline}</span>
                                        <span className="text-xs font-black text-white ml-2 bg-blue-500/20 px-1.5 py-0.5 rounded">{Math.round(hudInstruction.distance * 1000)}m</span>
                                    </div>
                                    <div className="text-sm font-bold text-white leading-tight">{hudInstruction.text}</div>
                                </>
                            ) : (
                                <>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">{language === 'nl' ? 'ROUTE KLAAR' : 'ROUTE READY'}</span>
                                    <div className="text-sm font-bold text-white leading-tight">{language === 'nl' ? 'Druk op START' : 'Press START'}</div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => setNavPhase(isNavigating ? 'COMPLETED' : 'IN_TRANSIT')}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${isNavigating ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                        >
                            {isNavigating ? 'STOP' : 'START'}
                        </button>
                    </div>
                </>
            )}

            <div className="absolute right-4 bottom-6 z-10 flex flex-col gap-2">
                {MAPTILER_KEY && (
                    <button
                        onClick={() => setStyleMode(prev => prev === 'map' ? 'satellite' : 'map')}
                        className={`bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full p-3 border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center ${styleMode === 'satellite' ? '!text-blue-400 !border-blue-400/50' : ''}`}
                        title={styleMode === 'map' ? "Switch to Satellite" : "Switch to Map"}
                    >
                        <Layers size={20} className={styleMode === 'satellite' ? "fill-blue-400/20" : ""} />
                    </button>
                )}
                <button onClick={() => { setIs3DMode(!is3DMode); setViewState(prev => ({ ...prev, pitch: !is3DMode ? 60 : 0 })); }} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full p-3 border border-white/10 text-white shadow-lg font-bold text-xs h-12 w-12 flex items-center justify-center">{is3DMode ? '2D' : '3D'}</button>
                <button onClick={() => setViewState(v => ({ ...v, zoom: Math.min((v.zoom || 13) + 1, 20) }))} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center"><Plus size={24} /></button>
                <button onClick={() => setViewState(v => ({ ...v, zoom: Math.max((v.zoom || 13) - 1, 1) }))} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center"><Minus size={24} /></button>
                <button onClick={() => setViewAction('USER')} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full p-3 border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center"><LocateFixed size={20} /></button>
                <button onClick={() => setViewAction('ROUTE')} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full p-3 border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center"><Maximize size={20} /></button>
                {onOpenArMode && <button onClick={onOpenArMode} className="bg-black/20 hover:bg-black/60 backdrop-blur-md rounded-full p-3 border border-white/10 text-white shadow-lg h-12 w-12 flex items-center justify-center text-xs font-bold">AR</button>}
            </div>

            {(isSimulating || (isNavigating && isSimulationEnabled)) && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-900/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">
                    <button
                        onClick={() => setSimulationSpeed(s => s === 1 ? 5 : s === 5 ? 10 : 1)}
                        className="p-3 rounded-xl border border-white/10 bg-slate-800 text-white font-bold text-sm min-w-[48px]"
                    >
                        {simulationSpeed}x
                    </button>
                    <div className="flex flex-col items-center px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 min-w-[64px]">
                        <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">KM/H</span>
                        <span className="text-sm font-black text-white">{currentSpeed.toFixed(1)}</span>
                    </div>
                    <button
                        onClick={() => setIsSimulating(!isSimulating)}
                        className={`p-3 rounded-xl border border-white/10 shadow-lg transition-all ${isSimulating ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-200'}`}
                    >
                        {isSimulating ? '⏸' : '▶'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MapLibreContainer;

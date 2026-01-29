import React, { useEffect, useState, useRef } from 'react';
import { MapContainer as LMapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { isLocationOnPath } from '../utils/geometry';
import { Brain, MessageSquare } from 'lucide-react';
import { SmartAutoScroller } from '../utils/AutoScroller';
import PoiDetailContent from './PoiDetailContent';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Map Styles Configuration
const MAP_STYLES = {
    default: {
        name: 'Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    walking: {
        name: 'Walking',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    cycling: {
        name: 'Cycling',
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
};

// Math Helpers
const toRad = (v) => v * Math.PI / 180;
const toDeg = (v) => v * 180 / Math.PI;
const calcDistance = (p1, p2) => {
    const R = 6371; // km
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Return raw km
};
const calcBearing = (p1, p2) => {
    const y = Math.sin(toRad(p2.lng - p1.lng)) * Math.cos(toRad(p2.lat));
    const x = Math.cos(toRad(p1.lat)) * Math.sin(toRad(p2.lat)) - Math.sin(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.cos(toRad(p2.lng - p1.lng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const getPointAhead = (center, bearing, distanceOffsetKm) => {
    const R = 6371;
    const lat1 = toRad(center.lat);
    const lon1 = toRad(center.lng);
    const brng = toRad(bearing);

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceOffsetKm / R) +
        Math.cos(lat1) * Math.sin(distanceOffsetKm / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distanceOffsetKm / R) * Math.cos(lat1),
        Math.cos(distanceOffsetKm / R) - Math.sin(lat1) * Math.sin(lat2));

    return [toDeg(lat2), toDeg(lon2)];
};

// Navigation Helpers (Internalized for HUD)
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
    if (lang === 'en') {
        if (maneuver.type === 'arrive') return `Arrive at destination`;
        if (maneuver.type === 'depart') return `Head on ${name || 'path'}`;
        const mod = maneuver.modifier || '';
        return `${maneuver.type} ${mod} onto ${name || 'path'}`.replace(/\s+/g, ' ');
    }
    const dirs = {
        'left': 'links', 'right': 'rechts', 'sharp left': 'scherp links', 'sharp right': 'scherp rechts',
        'slight left': 'licht links', 'slight right': 'licht rechts', 'straight': 'rechtdoor', 'uturn': 'omkeren'
    };
    const m = dirs[maneuver.modifier] || maneuver.modifier || '';
    if (maneuver.type === 'arrive') return `Bestemming bereikt`;
    if (maneuver.type === 'depart') return `Vertrek op ${name || 'het pad'}`;
    return `Ga ${m} op ${name || 'het pad'}`.replace(/\s+/g, ' ');
};

// Route Arrows Component
const RouteArrows = ({ polyline }) => {
    const arrows = React.useMemo(() => {
        if (!polyline || polyline.length < 2) return [];
        const result = [];
        let accumulatedDistance = 0;
        const intervalKm = 0.05; // Show arrow every 50m (much denser for city walks)

        for (let i = 0; i < polyline.length - 1; i++) {
            const p1 = { lat: polyline[i][0], lng: polyline[i][1] };
            const p2 = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
            const d = calcDistance(p1, p2);
            accumulatedDistance += d;

            if (accumulatedDistance >= intervalKm) {
                const bearing = calcBearing(p1, p2);
                result.push({
                    position: polyline[i + 1],
                    bearing: bearing
                });
                accumulatedDistance = 0;
            }
        }
        return result;
    }, [polyline]);

    if (arrows.length === 0) return null;

    return (
        <>
            {arrows.map((arrow, idx) => (
                <Marker
                    key={`arrow-${idx}`}
                    position={arrow.position}
                    interactive={false}
                    pane="markerPane"
                    zIndexOffset={500}
                    icon={L.divIcon({
                        className: 'route-arrow-marker',
                        html: `<div style="transform: rotate(${arrow.bearing}deg); color: white; background-color: var(--primary); border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4);">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
                                   <polyline points="18 15 12 9 6 15"></polyline>
                                 </svg>
                               </div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    })}
                />
            ))}
        </>
    );
};

// Zoom Controls Component
const ZoomControls = ({ language, isPopupOpen, setUserHasInteracted }) => {
    const map = useMap();

    return (
        <div className={`absolute bottom-6 right-4 z-[1000] flex flex-col gap-2 transition-opacity ${isPopupOpen ? 'opacity-20' : 'opacity-100'}`}>
            {/* Zoom In */}
            <button
                onClick={() => {
                    setUserHasInteracted(true);
                    map.zoomIn();
                }}
                className="bg-black/20 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 border border-white/5 shadow-sm text-white/70 hover:text-white transition-all group"
                title={language === 'nl' ? 'Inzoomen' : 'Zoom In'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>

            {/* Zoom Out */}
            <button
                onClick={() => {
                    setUserHasInteracted(true);
                    map.zoomOut();
                }}
                className="bg-black/20 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 border border-white/5 shadow-sm text-white/70 hover:text-white transition-all group"
                title={language === 'nl' ? 'Uitzoomen' : 'Zoom Out'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
        </div>
    );
};

// Helper to control map view
const MapController = ({ center, positions, userLocation, focusedLocation, viewAction, onActionHandled, isNavigating, effectiveHeading, isPopupOpen }) => {
    const map = useMap();
    const hasAutoFit = useRef(false);
    const prevPositionsKey = useRef('');
    const prevFocusedLocation = useRef(null);
    const isAutoFollow = useRef(true); // Default to following

    // Fix: Handle map resize on window/container resize (e.g. fullscreen toggle)
    useEffect(() => {
        const handleResize = () => {
            // console.log("Window resized. Invalidating map size.");
            map.invalidateSize();
        };

        window.addEventListener('resize', handleResize);
        // Also trigger once on mount to be safe
        setTimeout(handleResize, 100);

        return () => window.removeEventListener('resize', handleResize);
    }, [map]);

    // Disable auto-follow on user interaction
    useEffect(() => {
        const onDrag = () => {
            if (isAutoFollow.current) {
                // console.log("User dragged map. Disabling auto-follow.");
                isAutoFollow.current = false;
            }
        };
        map.on('dragstart', onDrag);
        return () => map.off('dragstart', onDrag);
    }, [map]);

    // Generate simple key to detect route changes
    const currentKey = positions && positions.length > 0
        ? `${positions.length}-${positions[0][0]}-${positions[0][1]}`
        : 'empty';

    if (prevPositionsKey.current !== currentKey) {
        hasAutoFit.current = false;
        prevPositionsKey.current = currentKey;
    }

    // Priority 1: Explicit View Actions
    const lastActionTime = useRef(0);

    useEffect(() => {
        // Priority 1: Explicit View Actions
        if (viewAction === 'USER' && userLocation) {
            // Re-enable auto-follow
            isAutoFollow.current = true;
            lastActionTime.current = Date.now();
            map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.5 });
            if (onActionHandled) onActionHandled();
            return;
        }

        if (viewAction === 'ROUTE' && positions && positions.length > 0) {
            // Disable auto-follow to allow looking at the whole route
            isAutoFollow.current = false;
            lastActionTime.current = Date.now();
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [50, 50] });
            if (onActionHandled) onActionHandled();
            return;
        }

        // Priority 2: Focused Location Change (Only fly if changed)
        const isNewFocus = focusedLocation && (
            !prevFocusedLocation.current ||
            focusedLocation.lat !== prevFocusedLocation.current.lat ||
            focusedLocation.lng !== prevFocusedLocation.current.lng
        );

        if (isNewFocus) {
            // Disable auto-follow when explicitly focusing a location
            isAutoFollow.current = false;
            lastActionTime.current = Date.now();

            // Calculate offset to position selected POI near the bottom (85% down)
            // This maximizes space above for the popup.
            const targetZoom = 16;
            const size = map.getSize();

            const shiftY = size.y * 0.42;
            const centerPoint = map.project([focusedLocation.lat, focusedLocation.lng], targetZoom);
            const newCenterPoint = centerPoint.subtract([0, shiftY]);
            const newCenterLatLng = map.unproject(newCenterPoint, targetZoom);

            map.flyTo(newCenterLatLng, targetZoom, { duration: 1.5 });
            prevFocusedLocation.current = focusedLocation;
            return;
        }

        // Priority 3: Follow User in Navigation Mode (ONLY IF ENABLED)
        if (isNavigating && userLocation && isAutoFollow.current && !isPopupOpen) {
            // Don't fight with manual actions (fly To)
            if (Date.now() - lastActionTime.current < 2000) return;

            const currentZoom = map.getZoom();
            // Center exactly on user (identical to Locate Me behavior) and use zoom 16 as base
            map.setView([userLocation.lat, userLocation.lng], currentZoom < 16 ? 16 : currentZoom, { animate: true, duration: 1.0 });
            return;
        }

        // Priority 4: Auto-fit on initial load/route change
        if (!hasAutoFit.current) {
            if (positions && positions.length > 0) {
                const bounds = L.latLngBounds(positions);
                map.fitBounds(bounds, { padding: [50, 50] });
                hasAutoFit.current = true;
            } else if (userLocation && !positions) {
                map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 2 });
                // Don't set hasAutoFit true here if we want to follow user? 
                // But normally we just center once.
                hasAutoFit.current = true;
            } else if (center && !positions) {
                map.flyTo(center, 13, { duration: 2 });
                hasAutoFit.current = true;
            }
        }
    }, [center, positions, userLocation, focusedLocation, map, viewAction, onActionHandled]);
    useEffect(() => {
        const container = map.getContainer();
        // DISABLE ROTATION per user request: Always reset transforms
        // if (isNavigating && effectiveHeading !== 0) { ... }

        container.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.transform = 'rotate(0deg) scale(1.0)';
        container.style.setProperty('--map-rotation', '0deg');
        container.style.setProperty('--map-scale', '1.0');

    }, [map, isNavigating, effectiveHeading]);

    return null;
};

const MapContainer = ({ routeData, searchMode, focusedLocation, language, onPoiClick, onPopupClose, speakingId, isSpeechPaused, onSpeak, onStopSpeech, spokenCharCount, isLoading, loadingText, loadingCount, onUpdatePoiDescription, onNavigationRouteFetched, onToggleNavigation, autoAudio, setAutoAudio, userSelectedStyle = 'walking', onStyleChange, isSimulating, setIsSimulating, isSimulationEnabled, isAiViewActive, onOpenAiChat, userLocation, setUserLocation, activePoiIndex, setActivePoiIndex, pastDistance = 0, viewAction, setViewAction, navPhase, setNavPhase, routeStart }) => {
    const { pois = [], center, routePath } = routeData || {};
    const isInputMode = !routeData;

    // track simulation index to allow pausing
    const simulationIndexRef = useRef(0);
    const lastFetchedIndexRef = useRef(-1); // Sync fetcher with target POI
    const lastFetchedPhaseRef = useRef(null); // Sync fetcher with nav phase
    const initialStartDistRef = useRef(null); // Track initial distance to start for PRE_ROUTE leg stats
    const [simulationSpeed, setSimulationSpeed] = useState(1); // 1x, 2x, 5x
    // Fix for stale closure in Leaflet listeners
    const speakingIdRef = useRef(speakingId);
    useEffect(() => { speakingIdRef.current = speakingId; }, [speakingId]);

    const onPopupCloseRef = useRef(onPopupClose);
    useEffect(() => { onPopupCloseRef.current = onPopupClose; }, [onPopupClose]);

    const onPoiClickRef = useRef(onPoiClick);
    useEffect(() => { onPoiClickRef.current = onPoiClick; }, [onPoiClick]);

    const popupHighlightedWordRef = useRef(null);
    const activeScrollerRef = useRef(null);

    // Auto-scroll logic for Marker Popups using SmartAutoScroller
    useEffect(() => {
        const el = popupHighlightedWordRef.current;
        if (speakingId && el) {
            const container = el.closest('.overflow-y-auto') || el.closest('.leaflet-popup-content');
            if (container) {
                // Initialize scroller ONLY if container changed or it doesn't exist
                if (!activeScrollerRef.current || activeScrollerRef.current.container !== container) {
                    activeScrollerRef.current?.destroy();
                    activeScrollerRef.current = new SmartAutoScroller(container, {
                        pinStrategy: 'top',
                        topMargin: 10,
                        bottomMargin: 40
                    });
                }
                activeScrollerRef.current.syncHighlight(el);
            }
        }
    }, [spokenCharCount]); // Character level sync

    // Separate effect for teardown
    useEffect(() => {
        if (!speakingId) {
            activeScrollerRef.current?.destroy();
            activeScrollerRef.current = null;
        }
    }, [speakingId]);

    const focusedLocationRef = useRef(focusedLocation);
    useEffect(() => { focusedLocationRef.current = focusedLocation; }, [focusedLocation]);

    // Default center (Amsterdam)
    const defaultCenter = [52.3676, 4.9041];
    // const [userSelectedStyle, setUserSelectedStyle] = useState('walking'); // Lifted to App.jsx
    const [isPopupOpen, setIsPopupOpen] = useState(false); // Track if any popup is open for HUD transparency
    const [userHasInteracted, setUserHasInteracted] = useState(false); // Track user interaction for geolocation privacy
    const markerRefs = useRef({}); // Refs for markers to open programmatically

    // Proximity State
    const [nearbyPoiIds, setNearbyPoiIds] = useState(new Set());
    const lastTriggeredPoiIdRef = useRef(null);
    const lastOpenedPopupIdRef = useRef(null);

    // Track active POI index for sequential navigation
    // Lifted to App.jsx: activePoiIndex
    const lastReachedPoiIndexRef = useRef(-1); // Separate ref to track navigation progress

    // Reset active index ONLY when the route's POIs change fundamentally.
    // We use a join of IDs to avoid resetting when descriptions or steps are updated.
    const poiIdsString = pois?.map(p => p.id).join(',');
    useEffect(() => {
        setActivePoiIndex(0);
        lastReachedPoiIndexRef.current = -1;
        simulationIndexRef.current = 0;
        lastFetchedIndexRef.current = -1;
        setNavigationPath(null);
        initialStartDistRef.current = null; // Reset on new route
    }, [poiIdsString]);

    // Reset simulation index when target advances
    useEffect(() => {
        simulationIndexRef.current = 0;
    }, [activePoiIndex]);

    // Audio Context Ref (persistent)
    const audioCtxRef = useRef(null);
    // const [isSimulating, setIsSimulating] = useState(false); // NOW PASSED AS PROP



    const [navigationPath, setNavigationPath] = useState(null);

    // Lifted state (passed as prop now)
    const setLocalUserLocation = (loc) => setUserLocation(loc); // Keep setter alias for compatibility

    // Fetch user location
    // Fetch user location
    useEffect(() => {
        let watchId;

        // --- SIMULATION ---
        if (isSimulating && navigationPath && navigationPath.length > 0) {
            console.warn("SIMULATION RUNNING at", simulationSpeed, "x");

            // Base delay for 1x speed (e.g. 600ms per step)
            // Adjust this base value to feel "natural" for 1x
            const baseDelay = 600;
            const intervalDelay = baseDelay / simulationSpeed;

            const interval = setInterval(() => {
                if (simulationIndexRef.current < navigationPath.length) {
                    const [lat, lng] = navigationPath[simulationIndexRef.current];
                    setUserLocation({ lat, lng, heading: 0 });
                    simulationIndexRef.current += 1;
                } else {
                    clearInterval(interval);
                    // Simulation finished this leg.
                    // Force advance to next POI if available.
                    console.log("Simulation leg complete. Checking for next POI...");
                    if (routeData && routeData.pois && activePoiIndex < (routeData.pois.length - 1)) {
                        const nextIdx = activePoiIndex + 1;
                        console.log("Simulation finished leg. Advancing to next POI index:", nextIdx);

                        // IMPORTANT: Clear the current path to allow the fetcher to get the next leg
                        setNavigationPath(null);
                        simulationIndexRef.current = 0;
                        setActivePoiIndex(nextIdx);

                        // Update strict tracker to prevent double-fire from proximity interaction
                        lastReachedPoiIndexRef.current = nextIdx - 1;
                    } else {
                        console.log("Simulation reached the end of the entire route.");
                        setIsSimulating(false);
                    }
                }
            }, intervalDelay);

            return () => clearInterval(interval);
        }

        // Only request geolocation after user interaction (browser privacy requirement)
        if (navigator.geolocation && !isSimulating && userHasInteracted) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    // Only update if not in test mode
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        heading: position.coords.heading // Capture heading if available
                    });
                },
                (error) => {
                    console.log("Error getting location:", error);
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 10000,
                    timeout: 20000
                }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isSimulating, navigationPath, activePoiIndex, routeData, simulationSpeed, userHasInteracted]); // Re-run when toggle changes

    // Audio Trigger
    // Audio Trigger
    const playProximitySound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            if (!audioCtxRef.current) {
                audioCtxRef.current = new AudioContext();
            }

            const ctx = audioCtxRef.current;

            // Resume if suspended (browser policy)
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            // Nice "Bing" sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

            osc.start();
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) {
            console.warn("Audio play failed", e);
        }
    };

    // Proximity Effect
    useEffect(() => {
        if (!userLocation || !routeData?.pois) return;

        const PROXIMITY_THRESHOLD_KM = 0.08; // 80 Meters (Breathing + Sound)
        const POPUP_THRESHOLD_KM = 0.025;     // 25 Meters (Auto Open Popup)
        const EXIT_THRESHOLD_KM = 0.1;       // 100 Meters (Reset)
        const START_ARRIVAL_THRESHOLD_KM = 0.06; // 60 Meters

        // --- PRE-ROUTE LOGIC ---
        // If we are heading to start, check distance to start point
        if (navPhase === 'PRE_ROUTE' && routeStart && setNavPhase) {
            const distToStart = calcDistance(
                { lat: userLocation.lat, lng: userLocation.lng },
                { lat: routeStart[0], lng: routeStart[1] }
            );

            // Capture initial distance once for HUD "Leg Done" calculation
            if (!initialStartDistRef.current && distToStart > START_ARRIVAL_THRESHOLD_KM) {
                console.log("PRE_ROUTE Started. Initial Dist to Start:", distToStart);
                initialStartDistRef.current = distToStart;
            }

            // If arrived at start, switch phase!
            if (distToStart < START_ARRIVAL_THRESHOLD_KM) {
                console.log("!!! ARRIVED AT START POINT !!! Switching to IN_ROUTE phase.");
                setNavPhase('IN_ROUTE');
                playProximitySound(); // Celebration sound
                initialStartDistRef.current = null; // Reset
                // Don't return, let generic logic run too (might be near POI 0 already)
            }
        }

        // --- ROBUST POI ACTIVATION LOGIC ---
        // Requirement: Only open if IN_ROUTE, Sequential, and On-Path
        const checkPoiActivation = () => {
            if (navPhase !== 'IN_ROUTE') return;
            if (activePoiIndex >= routeData.pois.length) return;

            // 1. Define Candidates: Current Target & Next Target (handling skips)
            // We check only activePoiIndex and activePoiIndex + 1
            const candidates = [activePoiIndex];
            if (activePoiIndex < routeData.pois.length - 1) {
                candidates.push(activePoiIndex + 1);
            }

            let activationFound = false;

            for (const targetIdx of candidates) {
                if (activationFound) break; // Only trigger one at a time

                const targetPoi = routeData.pois[targetIdx];
                const distKm = calcDistance(
                    { lat: userLocation.lat, lng: userLocation.lng },
                    { lat: targetPoi.lat, lng: targetPoi.lng }
                );

                // --- CHECK 1: Distance (Arrival Zone) ---
                if (distKm < 0.05) { // 50 Meters for arrival

                    // --- CHECK 2: Geometry (Are we actually on the path?) ---
                    // We need the leg leading TO this POI.
                    // Leg index usually corresponds to POI index in 1-to-1 mapping if start is index 0
                    // routeData.legs[0] -> to POI 0? Or from Start to POI 0?
                    // Typically: Leg i connects Waypoint i to Waypoint i+1.
                    // Our Route: Start -> POI 0 -> POI 1 ...
                    // So Leg 0 goes Start -> POI 0. Leg 1 goes POI 0 -> POI 1.
                    // TargetIdx corresponds strictly to LegIdx.
                    const relevantLeg = routeData.legs && routeData.legs[targetIdx];
                    let onPath = true;

                    // If we have geometry, enforce it
                    if (relevantLeg && relevantLeg.geometry && relevantLeg.geometry.coordinates) {
                        const pathCoords = relevantLeg.geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON to [lat, lng]
                        // 35m tolerance for path adherence
                        // Using simple distance logic for now as 'isLocationOnPath' might need more robust segment matching
                        // But we imported isLocationOnPath, so let's use it if available
                        onPath = isLocationOnPath(userLocation, pathCoords, 0.035);
                    } else {
                        // Fallback: Bearing check? Or just trust distance if legs missing?
                        // For robust production, maybe trust distance if strictly close (<20m)
                        if (distKm > 0.025) onPath = false; // Stricter distance if no geometry
                    }

                    if (!onPath) {
                        // console.log(`Near POI ${targetIdx} (${distKm.toFixed(3)}km) but NOT ON PATH. Ignoring.`);
                        continue;
                    }

                    // --- ACTIVATION ---
                    // If we reached here, we are close AND on path. 

                    // Handle Skip: If we triggered target+1 w/o triggering target
                    if (targetIdx > activePoiIndex) {
                        console.log(`!!! SKIP DETECTED !!! Auto-completing skipped POI ${activePoiIndex} because we reached ${targetIdx}`);
                        // Logic to mark previous as passed could go here
                        setActivePoiIndex(targetIdx);
                    }

                    // A. Update Navigation State
                    // Only advance if this is the first time reaching this specific index
                    if (lastReachedPoiIndexRef.current < targetIdx) {
                        console.log(`!!! ARRIVAL VALIDATED !!! Reached POI ${targetIdx} (${targetPoi.name}). Advancing.`);
                        lastReachedPoiIndexRef.current = targetIdx;

                        // Move to next target for *next* time (unless this was the last one)
                        if (targetIdx < routeData.pois.length - 1) {
                            setActivePoiIndex(targetIdx + 1);
                        } else {
                            console.log("Route Completed!");
                            setNavPhase('COMPLETED');
                        }
                    }

                    // B. UI Logic: Open Popup
                    if (lastOpenedPopupIdRef.current !== targetPoi.id) {
                        console.log("Opening Popup for:", targetPoi.name);
                        if (onPoiClickRef.current) onPoiClickRef.current(targetPoi);
                        if (markerRefs.current && markerRefs.current[targetPoi.id]) {
                            markerRefs.current[targetPoi.id].openPopup();
                            setIsPopupOpen(true);
                        }
                        lastOpenedPopupIdRef.current = targetPoi.id;
                        playProximitySound();
                    }

                    activationFound = true;
                }
            }
        };

        // Execute checks
        checkPoiActivation();

        // 3. Update Nearby Set (Visuals/Breathing) - Keep this permissive for UI feedback
        // Just show what's strictly close for visual flair, independent of logic
        let hasChanges = false;
        const nextNearby = new Set(nearbyPoiIds);

        routeData.pois.forEach(poi => {
            const d = calcDistance(userLocation, { lat: poi.lat, lng: poi.lng });
            if (d < 0.08 && !nearbyPoiIds.has(poi.id)) {
                nextNearby.add(poi.id);
                hasChanges = true;
            } else if (d > 0.1 && nearbyPoiIds.has(poi.id)) {
                nextNearby.delete(poi.id);
                hasChanges = true;
            }
        });

        if (hasChanges) setNearbyPoiIds(nextNearby);

    }, [userLocation, routeData, activePoiIndex, navPhase]); // Dependencies updated

    const t = {
        en: {
            here: "You are here",
            nav: "Navigate Here",
            dist: "Distance",
            limit: "Limit",
            next: "Next",
            locate: "Locate Me",
            fit: "Fit Route",
            walking: "Walking",
            cycling: "Cycling",
            switch: "Switch to"
        },
        nl: {
            here: "Je bent hier",
            nav: "Navigeer Hier",
            dist: "Afstand",
            limit: "Limiet",
            next: "Volgende",
            locate: "Mijn Locatie",
            fit: "Route Passen",
            walking: "Wandelen",
            cycling: "Fietsen",
            switch: "Wissel naar"
        }
    };
    const text = t[language || 'en'];

    const [isNavigating, setIsNavigating] = useState(false);
    const isNavigatingRef = useRef(false); // Ref for immediate access in event handlers
    useEffect(() => { isNavigatingRef.current = isNavigating; }, [isNavigating]);



    // Calculate effective heading for rotation
    const [effectiveHeading, setEffectiveHeading] = useState(0);

    useEffect(() => {
        if (!isNavigating || !userLocation) {
            setEffectiveHeading(0);
            return;
        }

        const steps = routeData?.navigationSteps;
        const targetPoi = focusedLocation || (routeData?.pois && routeData.pois[0]);

        if (isNavigating && steps && steps.length > 0) {
            // Find current maneuver bearing
            let minD = Infinity;
            let closestIdx = 0;
            steps.forEach((s, i) => {
                const d = calcDistance(userLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                if (d < minD) {
                    minD = d;
                    closestIdx = i;
                }
            });

            let targetIdx = closestIdx + 1;
            if (targetIdx < steps.length) {
                const distToTarget = calcDistance(userLocation, { lat: steps[targetIdx].maneuver.location[1], lng: steps[targetIdx].maneuver.location[0] });
                if (distToTarget < 0.025) targetIdx++;
            }
            targetIdx = Math.min(targetIdx, steps.length - 1);

            const nextStep = steps[targetIdx];
            const bearing = calcBearing(userLocation, { lat: nextStep.maneuver.location[1], lng: nextStep.maneuver.location[0] });
            setEffectiveHeading(bearing);
        } else if (targetPoi) {
            setEffectiveHeading(calcBearing(userLocation, targetPoi));
        }
    }, [isNavigating, userLocation, focusedLocation, routeData]);


    // Custom Icons for Start/End
    const startIcon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: #22c55e; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); display: flex; align-items: center; justify-content: center; color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid white;"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 38],
        popupAnchor: [0, -40]
    });

    // Fix: Track last opened focus ID to prevent re-opening on generic re-renders
    const lastFocusedIdRef = useRef(null);

    // Sync Sidebar Selection with Map Popup & HUD State
    useEffect(() => {
        if (focusedLocation && pois && markerRefs.current) {
            // Only open if it's a distinct new focus event
            // Only open if it's a distinct new focus event
            if (lastFocusedIdRef.current !== focusedLocation.id) {
                if (markerRefs.current && markerRefs.current[focusedLocation.id]) {
                    const marker = markerRefs.current[focusedLocation.id];
                    console.log("Requesting popup open for:", focusedLocation.id);
                    // Defer opening slightly to avoid fighting with close events
                    setTimeout(() => {
                        marker.openPopup();
                        setIsPopupOpen(true);
                    }, 10);
                    lastFocusedIdRef.current = focusedLocation.id;
                } else {
                    // Fallback if ID-based lookup fails (legacy support or race condition)
                    const idx = pois.findIndex(p => p.id === focusedLocation.id);
                    if (idx !== -1 && markerRefs.current[idx]) {
                        // This path shouldn't be needed if refs are set correctly by ID now
                        markerRefs.current[idx].openPopup();
                    }
                }
            }
        } else {
            // Reset if focus is cleared
            if (lastFocusedIdRef.current !== null) {
                console.log("Focus cleared. Resetting lastFocusedIdRef and closing popup.");
                const oldId = lastFocusedIdRef.current;
                if (markerRefs.current && markerRefs.current[oldId]) {
                    markerRefs.current[oldId].closePopup();
                }
                lastFocusedIdRef.current = null;
                setIsPopupOpen(false);
            }
        }
    }, [focusedLocation, pois]);

    // Fetch real street navigation path
    useEffect(() => {
        // console.log("Nav check:", { user: !!userLocation, focus: !!focusedLocation, nav: isNavigating, style: userSelectedStyle });
        // TEST MODE GUARD: Do not re-fetch route if we are simulating AND we already have the path for the current target
        if (isSimulating && navigationPath && navigationPath.length > 0 &&
            lastFetchedIndexRef.current === activePoiIndex &&
            lastFetchedPhaseRef.current === navPhase) {
            return;
        }
        lastFetchedIndexRef.current = activePoiIndex;
        lastFetchedPhaseRef.current = navPhase;

        // Target is determined by the sequential index
        let navTarget = (pois && pois.length > activePoiIndex) ? pois[activePoiIndex] : (focusedLocation || (pois && pois[0]));

        if (navPhase === 'PRE_ROUTE' && routeData?.center) {
            navTarget = {
                lat: routeData.center[0],
                lng: routeData.center[1],
                name: language === 'nl' ? 'Startpunt' : 'Start Point',
                isStart: true
            };
        }

        if (!userLocation || !navTarget || !isNavigating) {
            setNavigationPath(null);
            return;
        }

        const fetchPath = async () => {
            try {
                // CRITICAL FIX: Use current user location if available to ensure accurate navigation from device location.
                // Fallback to center/start point only if user location is missing or for initial preview.
                let originLat, originLng;

                if (userLocation) {
                    // Always route from current user location if available
                    originLat = Number(userLocation.lat);
                    originLng = Number(userLocation.lng);
                    console.log(`🚀 Routing from DEVICE to ${navTarget.name} (${navPhase})`);
                } else if (activePoiIndex === 0 && center) {
                    // Fallback: First POI from START point if no user location
                    originLat = center[0];
                    originLng = center[1];
                    console.log("🚀 Routing from START (Fallback) to POI1:", { start: center, poi1: navTarget });
                } else {
                    // Should not happen if userLocation is required, but safe fallback
                    originLat = center[0];
                    originLng = center[1];
                }

                const fLng = Number(navTarget.lng);
                const fLat = Number(navTarget.lat);

                // Switch profile based on map style
                // 'foot' (pedestrian) prefers safe, smaller paths. 'bike'/'bicycle' prefers bike lanes/roads.
                // We default to 'foot' to ensure we never get car routes.
                const profile = userSelectedStyle === 'cycling' ? 'bicycle' : 'foot';

                // Use 'routing.openstreetmap.de' which is often better for dedicated walking/hiking paths in Europe
                // Note: This specific localized server uses 'driving' as the generic endpoint name but the subdomain determines the profile.
                let baseUrl = 'https://router.project-osrm.org/route/v1/' + profile;

                if (profile === 'foot') {
                    baseUrl = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
                } else if (profile === 'bicycle') {
                    baseUrl = 'https://routing.openstreetmap.de/routed-bike/route/v1/driving';
                }

                const url = `${baseUrl}/${originLng},${originLat};${fLng},${fLat}?overview=full&geometries=geojson&steps=true`;
                console.log(`Fetching Navigation Path (${baseUrl}):`, url);
                const res = await fetch(url);
                const data = await res.json();

                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const path = route.geometry.coordinates.map(c => [c[1], c[0]]);

                    // Force the path to end EXACTLY at the POI coordinate.
                    // This solves the issue where OSRM stops on the street (e.g. 50m away)
                    // and the simulation stops before triggering the "Arrival" threshold.
                    path.push([fLat, fLng]);

                    setNavigationPath(path);

                    // Extract steps and lift them up
                    if (route.legs && route.legs.length > 0 && onNavigationRouteFetched) {
                        onNavigationRouteFetched(route.legs[0].steps);
                    }
                }
            } catch (e) {
                console.error("Navigation fetch failed", e);
            }
        };

        fetchPath();
    }, [userLocation, focusedLocation, isNavigating, userSelectedStyle, pois, activePoiIndex, center]);

    // Determine effective style
    // If no route data (input mode), use Dark. Otherwise use user selection.
    const activeStyleKey = isInputMode ? 'default' : userSelectedStyle;

    const positions = pois.map(poi => [poi.lat, poi.lng]);


    // Use OSRM path if available, else simple lines
    const polyline = routePath || [];

    // Filter styles for switcher (exclude Dark/Default)
    const switcherStyles = Object.keys(MAP_STYLES).filter(k => k !== 'default');

    // User Location Icon (with counter-rotation and counter-scale)
    const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: isSimulating ?
            `<div class="simulation-marker-inner" style="transform: rotate(var(--map-rotation, 0deg)) scale(calc(1 / var(--map-scale, 1))); transition: transform 0.8s;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#3b82f6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-lg"><path d="M19 1L5 17 10 21 17 5 19 1zM2 10l3-5" /></svg>
             </div>` :
            `<div class="user-marker-inner" style="transform: rotate(var(--map-rotation, 0deg)) scale(calc(1 / var(--map-scale, 1))); transition: transform 0.8s;">
                <div class="user-marker-arrow" style="transform: translateX(-50%) translateY(-12px)"></div>
              </div>`,
        iconSize: isSimulating ? [32, 32] : [24, 24],
        iconAnchor: isSimulating ? [16, 16] : [12, 12]
    });

    // Helper: Determine Icon by Category
    const getPoiIcon = (poi) => {
        const desc = (poi.description || "").toLowerCase();
        let iconHtml = '';
        let colorClass = 'bg-primary'; // Default

        if (desc.includes('park') || desc.includes('garden') || desc.includes('forest') || desc.includes('tree') || desc.includes('nature')) {
            colorClass = 'bg-emerald-600';
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-3.5-3.5-6-7-6-10 0-3.5 3-5.5 6-5.5s6 2 6 5.5c0 3-2.5 6.5-6 10z"/><circle cx="12" cy="11" r="2"/></svg>`; // Tree-ish
        } else if (desc.includes('food') || desc.includes('restaurant') || desc.includes('cafe') || desc.includes('eat')) {
            colorClass = 'bg-orange-500';
            // Cutlery
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`;
        } else if (desc.includes('shop') || desc.includes('store') || desc.includes('mall')) {
            colorClass = 'bg-pink-500';
            // Bag
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
        } else if (desc.includes('museum') || desc.includes('art') || desc.includes('history') || desc.includes('castle')) {
            colorClass = 'bg-purple-600';
            // Building
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><path d="M8 2h8"/><path d="M12 2v20"/><path d="M4 8h16"/></svg>`;
        }

        return { colorClass, iconHtml };
    };





    return (
        <div className="relative h-full w-full glass-panel overflow-hidden border-2 border-primary/20 shadow-2xl shadow-primary/10">
            <LMapContainer center={center || defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                    key={activeStyleKey} // Force re-render when style changes
                    attribution={MAP_STYLES[activeStyleKey].attribution}
                    url={MAP_STYLES[activeStyleKey].url}
                />

                <MapController
                    center={center}
                    positions={positions}
                    userLocation={userLocation}
                    focusedLocation={focusedLocation}
                    viewAction={viewAction}
                    onActionHandled={() => setViewAction(null)}
                    isNavigating={isNavigating}
                    effectiveHeading={effectiveHeading}
                    isPopupOpen={isPopupOpen}
                />

                {/* User Location Marker */}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
                        <Popup className="glass-popup">
                            <div className="text-slate-900 font-bold">{text.here}</div>
                        </Popup>
                    </Marker>
                )}

                {/* --- Start & End Markers --- */}
                {!isInputMode && routeData && (
                    <>
                        {/* Start Marker (Always at routeData.center) */}
                        <Marker
                            position={routeData.center}
                            icon={startIcon}
                            zIndexOffset={900}
                        >
                            <Popup className="glass-popup">
                                <div className="text-slate-900 font-bold">
                                    {routeData.startName || (language === 'nl' ? 'Startpunt' : 'Start Point')}
                                </div>
                                {routeData.startInfo && (
                                    <p className="text-xs text-slate-600 mt-2 min-w-[240px] max-w-[320px] leading-relaxed whitespace-pre-wrap">
                                        {routeData.startInfo}
                                    </p>
                                )}
                            </Popup>
                        </Marker>
                    </>
                )}

                {/* Navigation moved to Top HUD */}

                {/* Only show Route/POIs if we have data */}
                {!isInputMode && (
                    <>
                        {/* Dynamic Navigation Line from User to Focused POI */}
                        {/* Turn-by-Turn Navigation Line (Solid Blue, Transparent) */}
                        {/* Active Navigation Leg (Solid, High Visibility) */}
                        {navigationPath && (
                            <Polyline
                                positions={navigationPath}
                                pathOptions={{
                                    color: '#3b82f6',
                                    weight: 9,
                                    opacity: 0.9,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                }}
                            />
                        )}

                        {/* Full Planned Route (Dotted/Inactive) */}
                        {polyline && polyline.length > 1 && (
                            <Polyline
                                positions={polyline}
                                pathOptions={{
                                    color: isNavigating ? 'var(--primary)' : 'var(--primary)',
                                    weight: 6,
                                    opacity: 0.6,
                                    dashArray: '4, 12', // Distinctly dotted
                                    lineCap: 'round'
                                }}
                            />
                        )}

                        {/* Direction Arrows on the dotted route */}
                        {polyline && polyline.length > 1 && (
                            <RouteArrows polyline={polyline} />
                        )}

                        {/* Search Radius Circle (Only in Radius Mode) */}
                        {routeData.stats && routeData.stats.limitKm && routeData.stats.limitKm.toString().startsWith('Radius') && (
                            <Circle
                                center={center}
                                radius={parseFloat(routeData.stats.limitKm.split(' ')[1]) * 1000} // Extract km, convert to meters
                                pathOptions={{
                                    color: 'var(--primary)',
                                    fillColor: 'var(--primary)',
                                    fillOpacity: 0.1,
                                    weight: 1,
                                    dashArray: '5, 10'
                                }}
                            />
                        )}

                        {pois.map((poi, idx) => {
                            const { colorClass, iconHtml } = getPoiIcon(poi);
                            const isBreathing = nearbyPoiIds.has(poi.id);

                            return (
                                <Marker
                                    key={idx}
                                    ref={(el) => { if (el) markerRefs.current[poi.id] = el; }}
                                    position={[poi.lat, poi.lng]}
                                    eventHandlers={{
                                        click: () => {
                                            setIsNavigating(false);
                                            onPoiClickRef.current && onPoiClickRef.current(poi);
                                            setIsPopupOpen(true);
                                        },
                                        popupclose: () => {
                                            console.log("Popup closing for", poi.name);
                                            // Only clear focus if we are NOT navigating (to preserve route)
                                            if (!isNavigatingRef.current) {
                                                // IMPORTANT: Only clear if the closed popup is the CURRENTLY focused one.
                                                // This prevents resetting focus when opening a new popup (which closes the old one).
                                                if (focusedLocationRef.current && focusedLocationRef.current.id === poi.id) {
                                                    onPopupCloseRef.current && onPopupCloseRef.current();
                                                }
                                            }
                                            setIsPopupOpen(false);
                                            if (speakingIdRef.current === poi.id) {
                                                onStopSpeech();
                                            }
                                        }
                                    }}
                                    icon={L.divIcon({
                                        className: 'bg-transparent border-none',
                                        html: `<div style="transform: rotate(var(--map-rotation, 0deg)) scale(calc(1 / var(--map-scale, 1))); transition: none;" class="w-10 h-10 rounded-full ${colorClass} text-white flex flex-col items-center justify-center border-2 border-white shadow-md shadow-black/30 ${isBreathing ? 'breathing-marker' : ''}">
                                                 ${iconHtml ? `<div class="mb-[1px] -mt-1 scale-75">${iconHtml}</div>` : ''}
                                                 ${searchMode === 'radius' ? '' : `<span class="text-[10px] font-bold leading-none">${idx + 1}</span>`}
                                               </div>`,
                                        iconAnchor: [20, 20]
                                    })}
                                >
                                    {poi.structured_info?.short_description && (
                                        <Tooltip direction="top" offset={[0, -45]} className="font-sans text-xs font-medium text-slate-700 shadow-sm" opacity={0.95}>
                                            {poi.structured_info.short_description}
                                        </Tooltip>
                                    )}
                                    <Popup
                                        autoPan={false}
                                        className="custom-poi-popup"
                                        eventHandlers={{
                                            add: () => setIsPopupOpen(true),
                                            remove: () => {
                                                setIsPopupOpen(false);
                                                // Only trigger clear if it was the focused one
                                                if (!isNavigatingRef.current && focusedLocationRef.current && focusedLocationRef.current.id === poi.id) {
                                                    if (onPopupCloseRef.current) onPopupCloseRef.current();
                                                }
                                            }
                                        }}
                                    >
                                        <div className="text-slate-900 w-full p-4">
                                            <div className="flex justify-between items-start gap-4 mb-3">
                                                <h3 className="font-bold text-lg m-0 leading-tight">{poi.name}</h3>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-1 shrink-0 -mt-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSpeak(poi); }}
                                                        className={`p-1.5 rounded-full transition-all ${speakingId === poi.id ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-primary hover:bg-black/5'}`}
                                                        title="Read Aloud"
                                                    >
                                                        {speakingId === poi.id ? (
                                                            isSpeechPaused ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                                            )
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Scrollable Scroll Area */}
                                            <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                                <PoiDetailContent
                                                    poi={poi}
                                                    language={language}
                                                    speakingId={speakingId}
                                                    spokenCharCount={spokenCharCount}
                                                    highlightRef={popupHighlightedWordRef}
                                                    isDark={false}
                                                    primaryColor="#6366f1"
                                                />

                                                {/* External Link (with Generic Fallback) */}
                                                {(() => {
                                                    let link = poi.link;
                                                    let source = poi.source;

                                                    // Universal Fallback: Google Search
                                                    if (!link) {
                                                        link = `https://www.google.com/search?q=${encodeURIComponent(poi.name + " Hasselt")}`;
                                                        source = "Google Search";
                                                    }

                                                    return (
                                                        <div className="mt-4 mb-2">
                                                            <a
                                                                href={link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                {source ? `Source: ${source}` : "Read more"}
                                                            </a>
                                                        </div>
                                                    );
                                                })()}
                                            </div>


                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* --- TOP HUD & CONTROLS MOVED INSIDE MAP TO RESPECT POPUP Z-INDEX --- */}

                        {/* Top Navigation HUD - Instruction Only */}
                        {
                            pois.length > 0 && !isInputMode && (() => {
                                const effectiveLocation = userLocation || (center ? { lat: center[0], lng: center[1] } : null);
                                if (!effectiveLocation) return null;

                                const targetPoi = focusedLocation || pois[0];
                                const steps = routeData?.navigationSteps;

                                // Progress Stats Calculation
                                let progressStats = null;
                                if (isNavigating && steps && steps.length > 0) {
                                    const totalDistKm = steps.reduce((acc, s) => acc + s.distance, 0) / 1000;
                                    let minD = Infinity;
                                    let closestIdx = 0;
                                    steps.forEach((s, i) => {
                                        // Re-use calcDistance available in scope
                                        const d = calcDistance(effectiveLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                                        if (d < minD) { minD = d; closestIdx = i; }
                                    });
                                    const targetIdx = Math.min(closestIdx + 1, steps.length - 1);
                                    const distToTarget = calcDistance(effectiveLocation, { lat: steps[targetIdx].maneuver.location[1], lng: steps[targetIdx].maneuver.location[0] });
                                    let remainingStepsKm = 0;
                                    for (let i = targetIdx + 1; i < steps.length; i++) {
                                        remainingStepsKm += steps[i].distance / 1000;
                                    }
                                    const remainingKm = distToTarget + remainingStepsKm;
                                    const doneKm = Math.max(0, totalDistKm - remainingKm);

                                    // Total Trip Calculation
                                    const tripDone = (pastDistance || 0) + doneKm;
                                    const tripTotal = parseFloat(routeData?.stats?.totalDistance || 0);
                                    // Fallback to current leg if trip total is missing (e.g. single leg)
                                    const finalTotal = tripTotal > 0.1 ? tripTotal : totalDistKm;
                                    const finalLeft = Math.max(0, finalTotal - tripDone);

                                    // Dynamic PRE_ROUTE Leg Stats
                                    let legDone = doneKm.toFixed(1);
                                    let legLeft = remainingKm.toFixed(1);
                                    let legTotal = totalDistKm.toFixed(1);

                                    if (navPhase === 'PRE_ROUTE' && routeStart) {
                                        // Calc live distance to start
                                        const distToStart = calcDistance(effectiveLocation, { lat: routeStart[0], lng: routeStart[1] });
                                        // Use captured initial distance or fallback to current + some buffer
                                        const initialDist = initialStartDistRef.current || distToStart;
                                        const doneTowardsStart = Math.max(0, initialDist - distToStart);

                                        legLeft = distToStart.toFixed(1);
                                        legTotal = initialDist.toFixed(1);
                                        legDone = doneTowardsStart.toFixed(1);
                                    }

                                    progressStats = {
                                        leg: {
                                            done: legDone,
                                            left: legLeft,
                                            total: legTotal
                                        },
                                        trip: {
                                            done: tripDone.toFixed(1),
                                            left: finalLeft.toFixed(1),
                                            total: finalTotal.toFixed(1)
                                        }
                                    };
                                }

                                let hudIcon = '📍';
                                let hudInstruction = targetPoi.name;
                                let hudDistance = calcDistance(effectiveLocation, targetPoi);
                                let bearingTarget = targetPoi;
                                let hudSubline = searchMode === 'radius'
                                    ? (language === 'nl' ? 'Beschikbare Spot' : 'Available Spot')
                                    : `${text.next}: POI ${pois.findIndex(p => p.id === targetPoi.id) + 1}`;

                                if (isNavigating && steps && steps.length > 0) {
                                    let minD = Infinity;
                                    let closestIdx = 0;
                                    steps.forEach((s, i) => {
                                        const d = calcDistance(effectiveLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
                                        if (d < minD) {
                                            minD = d;
                                            closestIdx = i;
                                        }
                                    });

                                    let targetIdx = closestIdx + 1;
                                    if (targetIdx < steps.length) {
                                        const distToTarget = calcDistance(effectiveLocation, { lat: steps[targetIdx].maneuver.location[1], lng: steps[targetIdx].maneuver.location[0] });
                                        if (distToTarget < 0.025) {
                                            targetIdx++;
                                        }
                                    }
                                    targetIdx = Math.min(targetIdx, steps.length - 1);

                                    const nextStep = steps[targetIdx];
                                    hudIcon = getManeuverIcon(nextStep.maneuver.modifier, nextStep.maneuver.type);
                                    hudInstruction = translateHUDInstruction(nextStep, language);
                                    hudDistance = calcDistance(effectiveLocation, { lat: nextStep.maneuver.location[1], lng: nextStep.maneuver.location[0] });
                                    bearingTarget = { lat: nextStep.maneuver.location[1], lng: nextStep.maneuver.location[0] };
                                    hudSubline = (targetIdx === steps.length - 1 && hudDistance < 0.02)
                                        ? (language === 'nl' ? 'Bestemming bereikt' : 'Arrived')
                                        : (nextStep.name || targetPoi.name);
                                }

                                return (
                                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-[1000] backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 bg-slate-900/95 w-[90%] max-w-[320px] opacity-100 animate-in slide-in-from-top ${isPopupOpen ? 'opacity-40 scale-95' : 'opacity-100'}`}>
                                        <div className="flex items-center p-3 gap-3">
                                            {/* Left: Instructions & Stats */}
                                            <div className="flex-1 flex flex-col justify-center min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold leading-none truncate">
                                                        {hudSubline}
                                                    </span>
                                                </div>

                                                <div className="text-sm font-bold text-white leading-tight mb-2 break-words max-h-[3.5em] overflow-hidden">
                                                    {isNavigating ? hudInstruction : (language === 'nl' ? 'Kies een bestemming' : 'Select a destination')}
                                                </div>

                                                {isNavigating && progressStats && progressStats.trip && (
                                                    <div className="mt-2 pt-2 border-t border-white/10 w-full flex flex-col gap-1 text-[10px] font-mono">
                                                        {/* Header Row */}
                                                        <div className="grid grid-cols-4 gap-2 px-1 mb-0.5 opacity-50 text-[9px] uppercase tracking-wider text-center">
                                                            <div className="text-left bg-transparent"></div> {/* Label Col */}
                                                            <div>{language === 'nl' ? 'Gedaan' : 'Done'}</div>
                                                            <div>{language === 'nl' ? 'Nog' : 'Left'}</div>
                                                            <div>{language === 'nl' ? 'Totaal' : 'Total'}</div>
                                                        </div>

                                                        {/* LEG Row */}
                                                        <div className="grid grid-cols-4 gap-2 px-1 items-center">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-blue-400 text-left">Leg</div>
                                                            <div className="text-white font-bold text-center">{progressStats.leg.done}</div>
                                                            <div className="text-slate-300 text-center">{progressStats.leg.left}</div>
                                                            <div className="text-slate-400 text-center">{progressStats.leg.total}</div>
                                                        </div>

                                                        {/* TRIP Row */}
                                                        <div className="grid grid-cols-4 gap-2 px-1 items-center">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 text-left">Trip</div>
                                                            <div className="text-white font-bold text-center">{navPhase === 'PRE_ROUTE' ? "0.0" : progressStats.trip.done}</div>
                                                            <div className="text-slate-300 text-center">
                                                                {navPhase === 'PRE_ROUTE'
                                                                    ? (progressStats.trip.total || "0.0")
                                                                    : progressStats.trip.left}
                                                            </div>
                                                            <div className="text-slate-400 text-center">{progressStats.trip.total}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Icons Cluster */}
                                            <div className="flex flex-col gap-2 shrink-0 items-end">
                                                {/* Compass */}
                                                <div className="bg-white/5 rounded-xl p-1.5 flex items-center justify-center w-10 h-10 border border-white/5">
                                                    <div style={{ transform: `rotate(${calcBearing(effectiveLocation, bearingTarget) - (effectiveLocation.heading || 0)}deg)`, transition: 'transform 0.5s ease-out' }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 drop-shadow-md">
                                                            <polygon points="12 2 22 22 12 18 2 22 12 2" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    {/* Start/Stop Navigation Button */}
                                                    <button
                                                        onClick={() => {
                                                            setUserHasInteracted(true);
                                                            setIsNavigating(!isNavigating);
                                                            if (!isNavigating) {
                                                                setViewAction('USER');
                                                            }
                                                        }}
                                                        className={`rounded-xl p-1.5 flex items-center justify-center w-10 h-10 border transition-all hover:scale-105 active:scale-95 ${isNavigating ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-green-500/20 text-green-500 border-green-500/30'}`}
                                                        title={language === 'nl' ? (isNavigating ? 'Stop Navigatie' : 'Start Navigatie') : (isNavigating ? 'Stop Navigation' : 'Start Navigation')}
                                                    >
                                                        {isNavigating ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                        )}
                                                    </button>

                                                    {/* Distance */}
                                                    <div className="bg-white/5 rounded-xl p-1.5 flex flex-col items-center justify-center w-10 h-10 border border-white/5 leading-none">
                                                        {(() => {
                                                            const distKm = hudDistance;
                                                            let displayVal, unit;
                                                            if (distKm < 1) {
                                                                displayVal = Math.round(distKm * 1000);
                                                                unit = "m";
                                                            } else {
                                                                displayVal = distKm.toFixed(1);
                                                                unit = "km";
                                                            }
                                                            return (
                                                                <>
                                                                    <span className="text-xs font-black text-white tracking-tighter">{displayVal}</span>
                                                                    <span className="text-[8px] text-slate-400 uppercase font-bold mt-0.5">{unit}</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        }

                        {/* Map Controls (Simulation) */}
                        {
                            !isInputMode && isSimulationEnabled && (
                                <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] flex flex-row items-center gap-3 bg-slate-900/60 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl transition-opacity ${isPopupOpen ? 'opacity-20' : 'opacity-100'}`}>
                                    {/* Speed Toggle (Only when simulating) */}
                                    {navigationPath && isSimulating && (
                                        <button
                                            onClick={() => {
                                                const nextSpeed = simulationSpeed === 1 ? 2 : (simulationSpeed === 2 ? 5 : 1);
                                                setSimulationSpeed(nextSpeed);
                                            }}
                                            className="p-3 rounded-xl border border-white/10 shadow-lg bg-slate-800/90 text-slate-200 hover:bg-slate-700 transition-all font-bold text-sm min-w-[48px]"
                                            title="Simulation Speed"
                                        >
                                            {simulationSpeed}x
                                        </button>
                                    )}

                                    {/* Test Button - Always Show if Path Exists */}
                                    {navigationPath && (
                                        <button
                                            onClick={() => {
                                                if (!isSimulating) {
                                                    playProximitySound(); // Init context on start
                                                    setIsNavigating(true); // Ensure fetcher is active
                                                }
                                                setIsSimulating(!isSimulating);
                                            }}
                                            className={`p-3 rounded-xl border border-white/10 shadow-lg transition-all ${isSimulating ? 'bg-green-600 text-white animate-pulse' : 'bg-slate-800/90 text-slate-200'}`}
                                            title={isSimulating ? "Pause Simulation" : "Start Simulation"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 1L5 17 10 21 17 5 19 1zM2 10l3-5" /></svg>
                                        </button>
                                    )}
                                </div>
                            )
                        }

                        {/* Bottom Right: View Controls with Zoom */}
                        {
                            !isInputMode && (
                                <>
                                    {/* Zoom Controls */}
                                    <ZoomControls
                                        language={language}
                                        isPopupOpen={isPopupOpen}
                                        setUserHasInteracted={setUserHasInteracted}
                                    />

                                    {/* Other View Controls */}
                                    <div className={`absolute bottom-[140px] right-4 z-[1000] flex flex-col gap-2 transition-opacity ${isPopupOpen ? 'opacity-20' : 'opacity-100'}`}>
                                        {/* Locate Me */}
                                        <button
                                            onClick={() => {
                                                setUserHasInteracted(true);
                                                setViewAction('USER');
                                            }}
                                            className="bg-black/20 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 border border-white/5 shadow-sm text-white/70 hover:text-white transition-all group"
                                            title={language === 'nl' ? 'Mijn Locatie' : 'Locate Me'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" /></svg>
                                        </button>

                                        {/* Fit Route */}
                                        <button
                                            onClick={() => {
                                                setUserHasInteracted(true);
                                                setViewAction('ROUTE');
                                            }}
                                            className="bg-black/20 hover:bg-black/60 backdrop-blur-sm rounded-full p-2.5 border border-white/5 shadow-sm text-white/70 hover:text-white transition-all group"
                                            title={language === 'nl' ? 'Toon Route' : 'Show Route'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                                        </button>
                                    </div>
                                </>
                            )
                        }

                        {/* Loading Indicator */}
                        {
                            isLoading && !isAiViewActive && (
                                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1500] bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-primary/30 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
                                    <div className="relative w-8 h-8 rounded-full border border-primary overflow-hidden bg-white shadow-lg">
                                        <img src="/guide-icon-round.jpg" alt="Guide" className="w-full h-full object-cover scale-125" />
                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-400 border-2 border-slate-900 rounded-full animate-ping"></div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white tracking-wide uppercase">{loadingText || (language === 'nl' ? "gids denkt na..." : "guide is thinking...")}</span>
                                        {loadingCount > 0 && <span className="text-[10px] text-primary font-medium animate-pulse">{loadingCount} {language === 'nl' ? 'spots gevonden' : 'spots found'}</span>}
                                    </div>
                                </div>
                            )
                        }

                    </>
                )}
            </LMapContainer>

        </div >
    );
};

export default MapContainer;

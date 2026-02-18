import React, { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
// import { PoiIntelligence } from './services/PoiIntelligence'; // Moved to dynamic import
const MapLibreContainer = React.lazy(() => import('./components/MapLibreContainer'));
const ItinerarySidebar = React.lazy(() => import('./components/ItinerarySidebar'));
import CitySelector from './components/CitySelector';
const ArView = React.lazy(() => import('./components/ArView'));
import './index.css';
import { getCombinedPOIs, fetchGenericSuggestions, getInterestSuggestions } from './utils/poiService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import * as smartPoiUtils from './utils/smartPoiUtils';
import { rotateCycle, reverseCycle, interleaveRouteItems } from './utils/routeUtils';
import { isLocationOnPath } from './utils/geometry';
import { transformOSRMCoords, sanitizePath } from './utils/coordinateUtils';
import { sanitizeRouteData, calculateRoutePath, getDistance } from './utils/routePathUtils';

import { getBestVoice } from './utils/speechUtils';
import { APP_THEMES, applyTheme } from './utils/themeUtils';
import * as locationService from './services/locationService';

// Async Persistence Helper
const saveToStorageAsync = (key, value) => {
  setTimeout(() => {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    } catch (e) {
      console.warn(`Failed to save ${key} to localStorage`, e);
    }
  }, 0);
};

// Navigation Phases for strict tracking
import RefinementModal from './components/RefinementModal';
import LimitConfirmationModal from './components/LimitConfirmationModal';
import ScanResultModal from './components/ScanResultModal';
import RouteEditPanel from './components/RouteEditPanel';
import PoiProposalModal from './components/PoiProposalModal';
import DistanceRefineConfirmation from './components/DistanceRefineConfirmation';

const NAV_PHASES = {
  PRE_ROUTE: 'PRE_ROUTE',   // Heading to the start point
  IN_ROUTE: 'IN_ROUTE',     // On the generated path
  COMPLETED: 'COMPLETED'    // Finished the loop
};



const APP_VERSION = "v3.5.1";
const APP_AUTHOR = "Geert Schepers";
const APP_LAST_UPDATED = "18 Feb 2026";

import NavigationOverlay from './components/NavigationOverlay';
import { apiFetch } from './utils/api.js';

function CityExplorerApp() {
  const { authFetch } = useAuth();

  // Cleanup: Magic Link logic removed as auth is disabled
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('token')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);



  const [routeData, setRouteData] = useState(() => {
    const saved = localStorage.getItem('app_route_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [isNavigationOpen, setIsNavigationOpen] = useState(() => localStorage.getItem('app_is_nav_open') === 'true'); // Navigation UI State
  // Map Pick Mode State
  const [isMapPickMode, setIsMapPickMode] = useState(false);
  const [isRouteEditMode, setIsRouteEditMode] = useState(false);
  const [mapPickContext, setMapPickContext] = useState(null); // To store callback or context if needed

  // Route Markers State (Temporary points for custom routing)
  const [routeMarkers, setRouteMarkers] = useState([]);
  const [isDiscoveryTriggered, setIsDiscoveryTriggered] = useState(false);
  const [selectedEditPointIndex, setSelectedEditPointIndex] = useState(-1);
  const [cumulativeDistances, setCumulativeDistances] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Exploring...');
  const [foundPoisCount, setFoundPoisCount] = useState(0);
  const [spokenCharCount, setSpokenCharCount] = useState(0);
  const [poiProposals, setPoiProposals] = useState(null);
  const [pendingDistanceRefinement, setPendingDistanceRefinement] = useState(null);
  const [isArMode, setIsArMode] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const speechUtteranceRef = useRef(null);
  const lastAutoSavedKeyRef = useRef(null);
  const processAIPromptRef = useRef(null);

  // Settings: Load from LocalStorage or Default
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'nl');
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('app_theme') || 'tech');
  const [descriptionLength, setDescriptionLength] = useState('short'); // short, medium, max
  const [shouldAutoFocusInterests, setShouldAutoFocusInterests] = useState(false);

  // NEW PROVIDER SETTINGS
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('app_ai_provider') || 'groq');
  const [searchProvider, setSearchProvider] = useState(() => localStorage.getItem('app_search_provider') || 'tavily');

  // Sync voice variant with language automatically
  useEffect(() => {
    setVoiceSettings(prev => ({
      ...prev,
      variant: language === 'en' ? 'en' : 'nl'
    }));
  }, [language]);

  const [searchSources, setSearchSources] = useState(() => {
    const saved = localStorage.getItem('searchSources');
    const defaults = { osm: true, foursquare: true, google: false };
    if (!saved) return defaults;
    try {
      return { ...defaults, ...JSON.parse(saved) };
    } catch (e) {
      return defaults;
    }
  });

  // Persist Settings
  useEffect(() => saveToStorageAsync('app_language', language), [language]);
  useEffect(() => saveToStorageAsync('app_theme', activeTheme), [activeTheme]);
  useEffect(() => saveToStorageAsync('app_ai_provider', aiProvider), [aiProvider]);
  useEffect(() => saveToStorageAsync('app_search_provider', searchProvider), [searchProvider]);
  useEffect(() => saveToStorageAsync('searchSources', searchSources), [searchSources]);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(() => localStorage.getItem('app_simulation_enabled') === 'true');

  // Persist Simulation Setting
  useEffect(() => saveToStorageAsync('app_simulation_enabled', isSimulationEnabled), [isSimulationEnabled]);

  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('app_auto_save') !== 'false');
  const [confidenceThreshold, setConfidenceThreshold] = useState(() => parseFloat(localStorage.getItem('app_confidence_threshold')) || 0.5);

  useEffect(() => saveToStorageAsync('app_auto_save', autoSave), [autoSave]);
  useEffect(() => saveToStorageAsync('app_confidence_threshold', confidenceThreshold), [confidenceThreshold]);


  // Apply Theme Effect
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  // Geolocation Tracking Effect
  // Geolocation Tracking Effect
  // Fix: Only start tracking after user interaction or when navigating to avoid browser console warnings.
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation || !isTrackingEnabled) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // console.log("[GPS] Position updated:", lat, lng);
        setUserLocation({ lat, lng });
      },
      (err) => {
        console.warn("[GPS] Watch failed or permission denied:", err.message);
      },
      { timeout: 30000, enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTrackingEnabled]);

  // Re-enrich POIs when Language changes
  useEffect(() => {
    // Only trigger if we have a valid route
    if (routeData && routeData.pois && routeData.pois.length > 0) {


      const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}, roundtrip)`;

      // Force reset of enrichment status for all POIs so they are re-fetched in new language
      const resetPois = routeData.pois.map(p => ({
        ...p,
        isFullyEnriched: false,
        isLoading: true,
        description: null,
        structured_info: null
      }));

      // Update state to show loading immediately and reset language-dependent fields
      setRouteData(prev => ({
        ...prev,
        pois: resetPois,
        startInfo: null,
        endInfo: null,
        explanation: null
      }));

      // Trigger enrichment with reset POIs
      enrichBackground(resetPois, city, language, descriptionLength, interests, routeCtx)
        .catch(err => console.warn("Language enrichment failed", err));
    }
  }, [language]);



  // Focused Location (for "Fly To" interaction)
  const [focusedLocation, setFocusedLocation] = useState(null);

  // Lifted User Location (shared between Map and NavigationOverlay)
  const [userLocation, setUserLocation] = useState(null);
  const [activePoiIndex, setActivePoiIndex] = useState(() => parseInt(localStorage.getItem('app_active_poi_idx')) || 0);

  // Form State (Persistence enabled)
  const [city, setCity] = useState(() => localStorage.getItem('app_city') || '');
  const [validatedCityData, setValidatedCityData] = useState(() => {
    const saved = localStorage.getItem('app_validated_city');
    return saved ? JSON.parse(saved) : null;
  });
  const [interests, setInterests] = useState(() => localStorage.getItem('app_interests') || '');
  const [constraintType, setConstraintType] = useState(() => localStorage.getItem('app_constraint_type') || 'distance');
  const [constraintValue, setConstraintValue] = useState(() => parseFloat(localStorage.getItem('app_constraint_value')) || 5);
  const [isRoundtrip, setIsRoundtrip] = useState(() => localStorage.getItem('app_is_roundtrip') !== 'false');
  const [startPoint, setStartPoint] = useState(() => localStorage.getItem('app_start_point') || '');
  const [stopPoint, setStopPoint] = useState(() => localStorage.getItem('app_stop_point') || '');
  const [searchMode, setSearchMode] = useState(() => localStorage.getItem('app_search_mode') || 'journey');
  const [aiChatHistory, setAiChatHistory] = useState(() => {
    const saved = localStorage.getItem('app_chat_history');
    if (saved) return JSON.parse(saved);
    return [
      {
        role: 'brain', text: language === 'nl'
          ? 'Hoi! Ik ben je gids van CityExplorer. Om je ideale route te plannen, heb ik wat info nodig:\n\n1. Welke **stad** wilt u verkennen?\n2. Gaat u **wandelen** of **fietsen**?\n3. Hoe **lang** (min) of hoe **ver** (km) wilt u gaan?\n4. Wat zijn uw **interesses**? (Indien leeg, toon ik de belangrijkste bezienswaardigheden).'
          : 'Hi! I am your guide from CityExplorer. To plan your perfect route, I need a few details:\n\n1. Which **city** do you want to explore?\n2. Will you be **walking** or **cycling**?\n3. How **long** (min) or how **far** (km) would you like to go?\n4. What are your **interests**? (If left empty, I will show you the main tourist highlights).'
      }
    ];
  });

  const [travelMode, setTravelMode] = useState(() => localStorage.getItem('app_travel_mode') || 'walking');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiViewActive, setIsAiViewActive] = useState(() => localStorage.getItem('app_ai_view_active') !== 'false');

  // Disambiguation State
  const [disambiguationOptions, setDisambiguationOptions] = useState(null);
  const [disambiguationContext, setDisambiguationContext] = useState(null); // 'blur' or 'submit'

  // Refinement State (No Results)
  const [refinementProposals, setRefinementProposals] = useState(null);
  const [lastAction, setLastAction] = useState(null); // 'start' or 'add'

  // Limit Confirmation State
  const [limitConfirmation, setLimitConfirmation] = useState(null); // { proposedRouteData, message }

  const [showCitySelector, setShowCitySelector] = useState(false);

  // Sidebar Visibility State (Lifted)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('app_sidebar_open') !== 'false');

  // View Action state (Lifted from MapContainer to coordinate with Sidebar)
  const [viewAction, setViewAction] = useState(null);

  // Navigation Phase State (Strict progress tracking)
  const [navPhase, setNavPhase] = useState(() => localStorage.getItem('app_nav_phase') || NAV_PHASES.PRE_ROUTE);

  // Re-enrich POIs when Description Length changes
  useEffect(() => {
    if (routeData && routeData.pois && routeData.pois.length > 0) {


      // Optimistically update ALL pois to the new mode so UI (popups/sidebar) reflects change immediately
      setRouteData(prev => ({
        ...prev,
        pois: prev.pois.map(p => ({ ...p, active_mode: descriptionLength }))
      }));

      setIsBackgroundUpdating(true);

      // Construct Route Context for engine
      const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}, roundtrip)`;

      enrichBackground(routeData.pois, city, language, descriptionLength, interests, routeCtx)
        .finally(() => {
          setIsBackgroundUpdating(false);
        });
    }
  }, [descriptionLength]); // Only trigger on length change

  // Persist State Changes
  useEffect(() => saveToStorageAsync('app_city', city), [city]);
  useEffect(() => saveToStorageAsync('app_interests', interests), [interests]);
  useEffect(() => saveToStorageAsync('app_search_mode', searchMode), [searchMode]);
  useEffect(() => saveToStorageAsync('app_constraint_type', constraintType), [constraintType]);
  useEffect(() => saveToStorageAsync('app_constraint_value', constraintValue), [constraintValue]);
  useEffect(() => saveToStorageAsync('app_is_roundtrip', isRoundtrip), [isRoundtrip]);
  useEffect(() => saveToStorageAsync('app_start_point', startPoint), [startPoint]);
  useEffect(() => saveToStorageAsync('app_stop_point', stopPoint), [stopPoint]);
  useEffect(() => saveToStorageAsync('app_travel_mode', travelMode), [travelMode]);
  useEffect(() => {
    if (routeData) {
      const safeData = sanitizeRouteData(routeData);
      saveToStorageAsync('app_route_data', safeData);
    } else {
      localStorage.removeItem('app_route_data');
    }
  }, [routeData]);
  useEffect(() => {
    if (validatedCityData) saveToStorageAsync('app_validated_city', validatedCityData);
    else localStorage.removeItem('app_validated_city');
  }, [validatedCityData]);
  useEffect(() => {
    saveToStorageAsync('app_chat_history', aiChatHistory);
  }, [aiChatHistory]);
  useEffect(() => saveToStorageAsync('app_active_poi_idx', activePoiIndex), [activePoiIndex]);
  useEffect(() => saveToStorageAsync('app_nav_phase', navPhase), [navPhase]);
  useEffect(() => saveToStorageAsync('app_ai_view_active', isAiViewActive), [isAiViewActive]);
  useEffect(() => saveToStorageAsync('app_is_nav_open', isNavigationOpen), [isNavigationOpen]);
  useEffect(() => saveToStorageAsync('app_sidebar_open', isSidebarOpen), [isSidebarOpen]);
  useEffect(() => {
    saveToStorageAsync('searchSources', searchSources);
  }, [searchSources]);

  // Calculate Past Legs Distance (for Total Done)
  // Sum distance of all legs BEFORE the current activePoiIndex
  // Note: This is an estimation using straight line or pre-calculated dists from POI list.
  // Since we don't store OSRM paths for past legs, we use haversine between POIs.
  const pastDistance = useMemo(() => {
    // Robustness check: if no routeData or pois, we can't calculate past distance.
    if (!routeData || !routeData.pois || routeData.pois.length === 0 || navPhase === NAV_PHASES.PRE_ROUTE || activePoiIndex === 0) {
      return 0;
    }

    let total = 0;
    // Helper to calc dist
    const calcD = (p1, p2) => {
      if (!p1 || !p2 || p1.lat === undefined || p2.lat === undefined) return 0;
      const R = 6371;
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Sum distances up to the current active index
    for (let i = 0; i < activePoiIndex; i++) {
      if (i === 0) {
        // Start -> POI 0. 
        // We use distFromCurr if available, which is calculated when the route is first generated.
        const firstPoi = routeData.pois[0];
        if (firstPoi && firstPoi.distFromCurr) {
          total += firstPoi.distFromCurr;
        }
      } else {
        // POI[i-1] -> POI[i]
        const p1 = routeData.pois[i - 1];
        const p2 = routeData.pois[i];

        if (p1 && p2) {
          // Add 30% buffer for walking/cycling actual distance vs straight line
          total += calcD(p1, p2) * 1.3;
        }
      }
    }
    return total;
  }, [routeData, activePoiIndex, navPhase]);

  // Effect: Recalculate Route whenever relevant data changes
  const poiFingerprint = useMemo(() => {
    const pIds = routeData?.pois?.map(p => p.id).join(',') || '';
    const mIds = routeData?.routeMarkers?.map(m => `${m.lat},${m.lng}`).join(',') || '';
    return `${pIds}|${mIds}`;
  }, [routeData?.pois, routeData?.routeMarkers]);

  useEffect(() => {
    const hasPois = routeData?.pois && routeData.pois.length > 0;
    const hasMarkers = routeData?.routeMarkers && routeData.routeMarkers.length > 0;

    if (routeData && (hasPois || hasMarkers)) {
      // In Edit Mode, we primarily follow markers. 
      // But we should really interleave them if we want a unified path.
      // For now, let's use the same logic as interleaveRouteItems to get the visitation order.
      // Actually, if in edit mode, we ONLY use markers (as the user is manually defining the path).
      // If NOT in edit mode, we interleave markers and POIs.

      let stops = [];
      const startLoc = (hasMarkers) ? [routeData.routeMarkers[0].lat, routeData.routeMarkers[0].lng] : routeData.center;

      if (isRouteEditMode && hasMarkers) {
        stops = routeData.routeMarkers.slice(1);
      } else if (hasMarkers && hasPois && routeData.routePath?.length > 0) {
        // Use interleaved order if we have a path to project onto
        const interleaved = interleaveRouteItems(routeData.routeMarkers, routeData.pois, routeData.routePath);
        stops = interleaved.slice(1); // Remove start
      } else {
        // Fallback: Just POIs or just Markers
        stops = hasPois ? routeData.pois : (routeData.routeMarkers?.slice(1) || []);
      }

      calculateRoutePath(stops, startLoc, travelMode, isRoundtrip, isRouteEditMode, language, routeData.stopCenter).then(res => {
        if (!res) return;
        setRouteData(prev => ({
          ...prev,
          routePath: res.path,
          navigationSteps: res.steps,
          legs: res.legs,
          stats: {
            ...prev.stats,
            totalDistance: res.dist,
            walkDistance: res.walkDist
          }
        }));
      });
    }
  }, [travelMode, isRoundtrip, isRouteEditMode, poiFingerprint]);

  // Save Route
  const handleSaveRoute = () => {
    if (!routeData) return;
    const dataToSave = {
      version: 1,
      timestamp: new Date().toISOString(),
      city,
      interests,
      constraintType,
      constraintValue,
      isRoundtrip,
      routeData,
      descriptionLength
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `city_explorer_${city.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Sync auto-save ref to avoid duplicate saving if manual save was done for the same state
    if (routeData && routeData.pois) {
      const currentKey = `${city}_${routeData.pois.length}_${routeData.pois.map(p => p.id).join('_')}`;
      lastAutoSavedKeyRef.current = currentKey;
    }
  };



  // Load Route
  const handleLoadRoute = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.routeData) {
        setCity(data.city || '');
        setInterests(data.interests || '');
        setConstraintType(data.constraintType || 'distance');
        setConstraintValue(data.constraintValue || 5);
        // isRoundtrip removed as it's now constant true
        setDescriptionLength(data.descriptionLength || 'medium');
        // Update auto-save ref to prevent immediate re-saving of the loaded file
        if (data.routeData.pois) {
          const currentKey = `${data.city || ''}_${data.routeData.pois.length}_${data.routeData.pois.map(p => p.id).join('_')}`;
          lastAutoSavedKeyRef.current = currentKey;
        }

        const sanitized = sanitizeRouteData(data.routeData);
        setRouteData(sanitized);
        setFoundPoisCount(sanitized.pois ? sanitized.pois.length : 0);
        setIsAiViewActive(false); // Switch to map view
        setIsSidebarOpen(true);   // Ensure sidebar is open
        setIsLoading(false);
      } else {
        alert("Invalid file format");
      }
    } catch (e) {
      console.error("Load error", e);
      alert("Failed to load file");
    }
  };

  // Main Enrichment Logic (Moved to top level for reuse)
  // Main Enrichment Logic (Two-Stage) - Moved to top level reference
  const enrichmentAbortController = useRef(null);

  // Main Enrichment Logic (Two-Stage)
  const enrichBackground = useCallback(async (pois, cityName, lang, lengthMode, userInterests = '', routeCtx = '') => {

    if (enrichmentAbortController.current) {
      enrichmentAbortController.current.abort();
    }
    const controller = new AbortController();
    enrichmentAbortController.current = controller;
    const signal = controller.signal;

    setIsBackgroundUpdating(true);

    const { PoiIntelligence } = await import('./services/PoiIntelligence');

    const engine = new PoiIntelligence({
      city: cityName,
      language: lang,
      lengthMode: lengthMode,
      interests: userInterests,
      routeContext: routeCtx,
      aiProvider: aiProvider,
      searchProvider: searchProvider
    });

    try {
      if (signal.aborted) return;
      const isRound = routeCtx.toLowerCase().includes('roundtrip');

      if (!routeData?.startInfo) {
        const startLabel = startPoint || cityName;
        const startInstr = await engine.fetchArrivalInstructions(startLabel, cityName, lang, signal);
        if (!signal.aborted) {
          setRouteData(prev => prev ? {
            ...prev,
            startInfo: startInstr,
            startName: startPoint
          } : prev);
        }
      }

      if (!isRound && pois.length > 0 && !routeData?.endInfo) {
        const lastPoi = pois[pois.length - 1];
        const endInstr = await engine.fetchArrivalInstructions(lastPoi.name, cityName, lang, signal);
        if (!signal.aborted && endInstr) {
          setRouteData(prev => prev ? { ...prev, endInfo: endInstr } : prev);
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn("Start/End Enrichment Failed:", e);
    }
    const shortDescMap = new Map();

    try {
      for (const poi of pois) {
        if (signal.aborted) return;
        if (poi.isFullyEnriched) continue;

        setRouteData((prev) => {
          if (!prev) return prev;
          const loadingPoi = { ...poi, isLoading: true };
          const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
          return {
            ...prev,
            startPoi: isStart ? loadingPoi : prev.startPoi,
            pois: prev.pois ? prev.pois.map(p => p.id === poi.id ? loadingPoi : p) : []
          };
        });


        try {
          let signals = [];
          const localCache = engine.getCachedShortDescription(poi);
          let shortData = localCache;

          if (shortData) {
            console.log(`[Source] ${poi.name}: Early Cache Hit (Short Description)`);
          } else {
            signals = await engine.gatherSignals(poi, signal);
            if (signal.aborted) return;
            shortData = await engine.fetchGeminiShortDescription(poi, signals, signal);
          }

          if (signal.aborted) return;

          if (shortData?.short_description) {
            shortDescMap.set(poi.id, shortData.short_description);
          }

          setRouteData((prev) => {
            if (!prev) return prev;
            const updatedPoi = {
              ...poi,
              ...shortData,
              _signals: signals,
              isFullyEnriched: false,
              isLoading: true
            };

            const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
            return {
              ...prev,
              startPoi: isStart ? updatedPoi : prev.startPoi,
              pois: prev.pois ? prev.pois.map(p => p.id === poi.id ? updatedPoi : p) : []
            };
          });

          if (!localCache) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn(`Stage 1 Failed for ${poi.name}`, err);
        }
      }

      for (const poi of pois) {
        if (signal.aborted) return;
        if (poi.isFullyEnriched) continue;

        const cachedFull = engine.getCachedFullDetails(poi);
        if (cachedFull) {
          console.log(`[Source] ${poi.name}: Early Full Cache Hit. skipping Stage 2 delay/fetch.`);
          setRouteData((prev) => {
            if (!prev) return prev;
            const updatedPoi = { ...poi, ...cachedFull, isFullyEnriched: true };
            const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
            return {
              ...prev,
              startPoi: isStart ? updatedPoi : prev.startPoi,
              pois: prev.pois ? prev.pois.map(p => p.id === poi.id ? updatedPoi : p) : []
            };
          });
          continue;
        }

        await new Promise(r => setTimeout(r, 1500));

        setRouteData((prev) => {
          if (!prev) return prev;
          const loadingPoi = { ...poi, isLoading: true };
          const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
          return {
            ...prev,
            startPoi: isStart ? loadingPoi : prev.startPoi,
            pois: prev.pois ? prev.pois.map(p => p.id === poi.id ? loadingPoi : p) : []
          };
        });


        try {
          const signals = await engine.gatherSignals(poi, signal);

          if (signal.aborted) return;

          const savedShortDesc = shortDescMap.get(poi.id) || null;

          const fullData = await engine.fetchGeminiFullDetails(poi, signals, savedShortDesc, signal);

          if (signal.aborted) return;

          setRouteData((prev) => {
            if (!prev) return prev;
            const updatedPoi = {
              ...poi,
              ...fullData,
              isFullyEnriched: true,
              isLoading: false
            };

            const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
            return {
              ...prev,
              startPoi: isStart ? updatedPoi : prev.startPoi,
              pois: prev.pois ? prev.pois.map(p => p.id === poi.id ? updatedPoi : p) : []
            };
          });

        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn(`Stage 2 Failed for ${poi.name}`, err);
          setRouteData((prev) => {
            if (!prev) return prev;
            const isStart = prev.startIsPoi && prev.startPoi?.id === poi.id;
            const update = (p) => p.id === poi.id ? { ...p, isFullyEnriched: true, isLoading: false } : p;

            return {
              ...prev,
              startPoi: isStart ? update(prev.startPoi) : prev.startPoi,
              pois: prev.pois ? prev.pois.map(update) : []
            };
          });
        }
      }
    } finally {
      if (enrichmentAbortController.current === controller) {
        setIsBackgroundUpdating(false);
        enrichmentAbortController.current = null;
      }
    }
  }, [aiProvider, searchProvider, routeData, startPoint, setIsBackgroundUpdating, setRouteData]);

  const handleTriggerEnrichment = useCallback(() => {
    if (routeData && routeData.pois && routeData.pois.length > 0) {
      const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}, roundtrip)`;

      enrichBackground(routeData.pois, city, language, descriptionLength, interests, routeCtx)
        .catch(err => console.warn("Enrichment trigger failed", err));
    }
  }, [routeData, searchMode, constraintValue, constraintType, city, language, descriptionLength, interests, enrichBackground]);

  const handlePauseEnrichment = useCallback(() => {
    if (enrichmentAbortController.current) {
      enrichmentAbortController.current.abort();
      setIsBackgroundUpdating(false);
      enrichmentAbortController.current = null;

      setRouteData(prev => prev ? ({
        ...prev,
        pois: prev.pois.map(p => ({ ...p, isLoading: false }))
      }) : prev);
    }
  }, [setIsBackgroundUpdating, setRouteData]);

  const handleEnrichSinglePoi = async (poi) => {
    if (!poi) return;
    const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}, roundtrip)`;
    // Re-use enrichment logic but only for this POI
    // We create a new instance to avoid aborting the main background process if running?
    // Actually simplicity: Just call enrichBackground with a single-item array?
    // But enrichBackground resets state for ALL provided POIs.
    // Better: We instantiate the engine here directly.

    // Force UI into loading state for this POI and clear old data to ensure fresh update
    setRouteData(prev => ({
      ...prev,
      pois: prev.pois.map(p => p.id === poi.id ? {
        ...p,
        isLoading: true,
        isFullyEnriched: false,
        // Clear old data to show we are truly fetching new info
        description: null,
        structured_info: null,
        fun_facts: [],
        visitor_tips: null
      } : p)
    }));

    const engine = new PoiIntelligence({
      city: city,
      language: language,
      lengthMode: poi.active_mode || descriptionLength,
      interests: interests,
      routeContext: routeCtx
    });

    try {
      const signals = await engine.gatherSignals(poi);
      // Fetch full details directly
      // Use existing short desc if available to save tokens?
      const fullData = await engine.fetchGeminiFullDetails(poi, signals, poi.short_description || null);

      if (fullData) {
        setRouteData(prev => ({
          ...prev,
          pois: prev.pois.map(p => p.id === poi.id ? {
            ...p,
            ...fullData,
            isFullyEnriched: true,
            isLoading: false
          } : p)
        }));
      }
    } catch (e) {
      console.error("Single POI enrichment failed", e);
      setRouteData(prev => ({
        ...prev,
        pois: prev.pois.map(p => p.id === poi.id ? { ...p, isLoading: false } : p)
      }));
    }
  };


  // Wrapper for city setter to invalidate validation on edit
  const handleSetCity = useCallback((val) => {
    if (val !== city) {
      setCity(val);
      setValidatedCityData(null);
      setStartPoint('');
    }
  }, [city]);

  const loadMapWithCity = useCallback(async (cityData, interestOverride = null, paramsOverride = null) => {
    const { lat, lon } = cityData;
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    let cityCenter = (typeof latNum === 'number' && !isNaN(latNum) && typeof lonNum === 'number' && !isNaN(lonNum))
      ? [latNum, lonNum]
      : [52.3676, 4.9041];

    const activeParams = paramsOverride || {};
    const effectiveTravelMode = activeParams.travelMode || travelMode;
    const effectiveConstraintType = activeParams.constraintType || constraintType;
    const effectiveConstraintValue = activeParams.constraintValue || constraintValue;
    const effectiveRoundtrip = (activeParams.isRoundtrip !== undefined) ? activeParams.isRoundtrip : isRoundtrip;
    const effectiveStartPoint = activeParams.startPoint || startPoint;
    const effectiveStopPoint = activeParams.stopPoint || stopPoint;

    const activeStart = effectiveStartPoint;
    const isCurrentLoc = activeStart && (activeStart.toLowerCase().includes('huidig') || activeStart.toLowerCase().includes('current') || activeStart.toLowerCase().includes('mijn locat'));

    let startDisplayName = activeStart || (cityData.address?.city || cityData.name);
    if (isCurrentLoc) {
      startDisplayName = language === 'nl' ? 'Huidige locatie' : 'Current Location';
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 20000, enableHighAccuracy: false });
        });
        cityCenter = [pos.coords.latitude, pos.coords.longitude];
      } catch (e) {
        console.warn("Geolocation failed, falling back to city center", e);
      }
    } else if (activeStart && activeStart.trim().length > 2) {
      try {
        const cityName = cityData.address?.city || cityData.name;
        const q = `${activeStart}, ${cityName}`;
        const res = await apiFetch(`/api/nominatim?q=${encodeURIComponent(q)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data[0]) {
          cityCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } else {
          const q2 = `${activeStart} ${cityName}`;
          const res2 = await apiFetch(`/api/nominatim?q=${encodeURIComponent(q2)}&format=json&limit=1`);
          const data2 = await res2.json();

          if (data2 && data2[0]) {
            cityCenter = [parseFloat(data2[0].lat), parseFloat(data2[0].lon)];
          } else {
            const res3 = await apiFetch(`/api/nominatim?q=${encodeURIComponent(activeStart)}&format=json&limit=1`);
            const data3 = await res3.json();
            if (data3 && data3[0]) {
              cityCenter = [parseFloat(data3[0].lat), parseFloat(data3[0].lon)];
            } else {
              console.warn("Start point geocoding failed entirely.");
            }
          }
        }
      } catch (e) {
        console.warn("Failed to geocode startPoint", e);
      }
    }

    let finalStopCenter = null;
    if (!effectiveRoundtrip) {
      if (effectiveStopPoint && effectiveStopPoint.trim().length > 2) {
        try {
          const cityName = cityData.address?.city || cityData.name;
          const q = `${effectiveStopPoint}, ${cityName}`;
          const res = await apiFetch(`/api/nominatim?q=${encodeURIComponent(q)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) {
            finalStopCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          } else {
            const res2 = await apiFetch(`/api/nominatim?q=${encodeURIComponent(effectiveStopPoint)}&format=json&limit=1`);
            const data2 = await res2.json();
            if (data2 && data2[0]) {
              finalStopCenter = [parseFloat(data2[0].lat), parseFloat(data2[0].lon)];
            }
          }
        } catch (e) {
          console.warn("Failed to geocode stopPoint", e);
        }
      }
    }

    const activeInterest = interestOverride || interests;

    const constraints = {
      type: effectiveConstraintType,
      value: effectiveConstraintValue,
      isRoundtrip: effectiveRoundtrip
    };

    const searchCityName = cityData.address?.city ||
      cityData.address?.town ||
      cityData.address?.village ||
      cityData.address?.municipality ||
      cityData.name ||
      cityData.display_name.split(',')[0];

    try {
      let searchRadiusKm = constraintValue;

      if (searchMode === 'radius') {
        searchRadiusKm = constraints.value;
      } else if (constraints.type === 'duration') {
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        searchRadiusKm = (constraints.value / 60) * speed;
      }

      const candidates = await getCombinedPOIs(cityData, activeInterest, searchCityName, searchRadiusKm, searchSources, language, (msg) => setLoadingText(msg));
      setFoundPoisCount(candidates.length);

      if (candidates.length === 0) {
        if (searchMode === 'prompt') {
          setIsAiViewActive(true);
          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? `Oei, ik kon helaas geen plekken vinden voor "${activeInterest}" in ${searchCityName}. Heb je misschien andere interesses of een andere plek in gedachten?`
              : `Oops, I couldn't find any spots for "${activeInterest}" in ${searchCityName}. Do you have other interests or maybe another place in mind?`
          }]);
          setIsSidebarOpen(true);
          setRouteData(null);
          return;
        }

        const refinementOptions = getInterestSuggestions(activeInterest, language);
        if (refinementOptions.length > 0) {
          setRefinementProposals(refinementOptions);
          setLastAction('start');
          setRouteData(null);
          return;
        }

        console.warn("No POIs found. Trying fallback...");

        let suggestions = [];
        try {
          suggestions = await fetchGenericSuggestions(searchCityName);
        } catch (e) { console.warn("Fallback failed", e); }

        let msg = `No matches found for "${activeInterest}" in ${searchCityName}.`;
        if (suggestions.length > 0) {
          msg += `\n\nMaybe try one of these nearby places:\n- ${[...new Set(suggestions)].slice(0, 3).join('\n- ')}`;
        } else {
          msg += `\n\nTry broader terms like "parks", "history", or "food".`;
        }

        setRouteData(null);
        setIsAiViewActive(true);

        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: msg
        }]);
        return;
      }

      if (candidates.failedKeywords && candidates.failedKeywords.length > 0) {
        const failedWords = candidates.failedKeywords.join(', ');
        const msg = language === 'nl'
          ? `Ik heb gezocht naar alles, maar ik kon geen resultaten vinden voor: "${failedWords}". Ik heb de route samengesteld met de andere plekjes.`
          : `I searched for everything, but I couldn't find any results for: "${failedWords}". I have built the route with the other spots.`;

        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: msg
        }]);
      }

      if (candidates.length > 0) {
        await new Promise(r => setTimeout(r, 800));
      }

      if (searchMode === 'radius') {
        const topCandidates = candidates.slice(0, 50);

        const initialPois = topCandidates.map(p => ({
          ...p,
          description: language === 'nl' ? 'Informatie ophalen...' : 'Fetching details...',
          isLoading: true,
          active_mode: descriptionLength
        }));

        setRouteData({
          center: cityCenter,
          pois: initialPois,
          routePath: [],
          stats: {
            totalDistance: "0",
            walkDistance: "0",
            limitKm: `Radius ${searchRadiusKm}`
          }
        });

        enrichBackground(topCandidates, cityData.name, language, descriptionLength, activeInterest, `Radius search (${searchRadiusKm} km)`);
        return;
      }

      const selectedPois = [];
      const visitedIds = new Set();
      let currentPos = { lat: cityCenter[0], lng: cityCenter[1] };
      let totalDistanceEstim = 0;

      let targetLimitKm = constraints.value;

      if (constraints.type === 'duration') {
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        targetLimitKm = (constraints.value / 60) * speed;
      }

      const maxLimitKm = targetLimitKm * 1.15;

      while (totalDistanceEstim < maxLimitKm && candidates.length > 0) {
        const potentialNext = candidates
          .filter(c => !visitedIds.has(c.id))
          .map(c => ({
            ...c,
            lat: parseFloat(c.lat),
            lng: parseFloat(c.lng),
            distFromCurr: getDistance(
              parseFloat(currentPos.lat), parseFloat(currentPos.lng),
              parseFloat(c.lat), parseFloat(c.lng)
            )
          }))
          .sort((a, b) => a.distFromCurr - b.distFromCurr);

        if (potentialNext.length === 0) break;

        let selected = null;

        for (let i = 0; i < Math.min(potentialNext.length, 5); i++) {
          const candidate = potentialNext[i];
          const walkingDist = candidate.distFromCurr * 1.3;

          const endPoint = finalStopCenter ? { lat: finalStopCenter[0], lng: finalStopCenter[1] } : { lat: cityCenter[0], lng: cityCenter[1] };
          const distToEnd = (effectiveRoundtrip || finalStopCenter)
            ? getDistance(candidate.lat, candidate.lng, endPoint.lat, endPoint.lng) * 1.3
            : 0;

          if (totalDistanceEstim + walkingDist + distToEnd <= maxLimitKm) {
            selected = candidate;
            break;
          }
        }

        if (selected) {
          selectedPois.push(selected);
          visitedIds.add(selected.id);
          totalDistanceEstim += (selected.distFromCurr * 1.3);
          currentPos = { lat: selected.lat, lng: selected.lng };
        } else {
          break;
        }
      }

      if (selectedPois.length === 0 && candidates.length > 0) {
        const d = getDistance(cityCenter[0], cityCenter[1], candidates[0].lat, candidates[0].lng);
        const returnD = effectiveRoundtrip ? d : 0;
        selectedPois.push(candidates[0]);
        totalDistanceEstim = (d + returnD) * 1.3;
      }

      let routeCoordinates = [];
      let realDistance = 0;
      let navigationSteps = [];
      let finalRouteResult = null;

      while (selectedPois.length > 0) {
        const routeResult = await calculateRoutePath(selectedPois, cityCenter, travelMode, finalStopCenter, effectiveRoundtrip, isRouteEditMode);
        const dKm = routeResult.dist;

        if (dKm <= maxLimitKm || selectedPois.length === 1) {
          routeCoordinates = routeResult.path;
          realDistance = dKm;
          navigationSteps = routeResult.steps;
          finalRouteResult = routeResult;
          break;
        } else {
          selectedPois.pop();
        }
      }

      const initialPois = selectedPois.map(p => ({
        ...p,
        description: language === 'nl' ? 'Informatie ophalen...' : 'Fetching details...',
        isLoading: true,
        active_mode: descriptionLength
      }));

      setRouteData({
        center: cityCenter,
        startName: startDisplayName,
        startIsPoi: false,
        startPoi: null,
        pois: initialPois,
        originalPois: initialPois,
        routePath: routeCoordinates,
        navigationSteps: navigationSteps,
        legs: finalRouteResult ? finalRouteResult.legs : [],
        stats: {
          totalDistance: realDistance.toFixed(1),
          walkDistance: (finalRouteResult?.walkDist || 0).toFixed(1),
          limitKm: targetLimitKm.toFixed(1),
          isRoundtrip: effectiveRoundtrip
        },
        stopCenter: finalStopCenter
      });

      const routeTypeLabel = searchMode === 'radius' ? 'Radius search' : (effectiveRoundtrip ? 'Roundtrip' : 'Point-to-Point');
      const routeCtx = `${routeTypeLabel} (${realDistance.toFixed(1)} km)`;
      enrichBackground(selectedPois, cityData.name, language, descriptionLength, activeInterest, routeCtx);

      setIsSidebarOpen(true);
      setIsAiViewActive(false);

    } catch (err) {
      console.error("Error fetching POIs", err);
      setRouteData(null);
      setIsSidebarOpen(true);
      alert(language === 'nl'
        ? "Er is een fout opgetreden bij het laden van de kaart. Probeer het opnieuw."
        : "An error occurred while loading the map. Please try again.");
    }
  }, [travelMode, constraintType, constraintValue, isRoundtrip, startPoint, stopPoint, language, interests, searchMode, searchSources, descriptionLength, isRouteEditMode, setIsLoading, setLoadingText, setAiChatHistory, setIsAiViewActive, setIsSidebarOpen, setRouteData, setFoundPoisCount, setRefinementProposals, setLastAction, enrichBackground, calculateRoutePath]);

  const handleCityValidation = useCallback(async (context = 'blur', queryOverride = null, interestOverride = null, paramsOverride = null) => {
    const query = queryOverride || city;
    if (!query || query.length < 2) return;

    if (!queryOverride && validatedCityData && !paramsOverride) {
      if (context === 'submit') {
        if (searchMode === 'manual') return;
        await loadMapWithCity(validatedCityData, interestOverride, paramsOverride);
      }
      return;
    }

    try {
      let results = await locationService.validateCity(query, language);

      if (!results || results.length === 0) {
        if (context === 'submit') {
          if (searchMode === 'prompt') {
            setIsAiViewActive(true);
            setAiChatHistory(prev => [...prev, {
              role: 'brain',
              text: language === 'nl'
                ? `Ik kon helaas geen stad of plek vinden met de naam "${query}". Weet je zeker dat de naam klopt?`
                : `I couldn't find a city or place called "${query}". Are you sure the name is correct?`
            }]);
          } else {
            alert("City not found. Please try again.");
            setIsSidebarOpen(true);
          }
        }
        return;
      }

      let cityData = locationService.deduplicateResults(results);

      if (userLocation && userLocation.lat) {
        if (cityData.length > 1) {
          cityData.forEach(r => {
            r._dist = getDistance(userLocation.lat, userLocation.lng, parseFloat(r.lat), parseFloat(r.lon));
          });
          cityData.sort((a, b) => a._dist - b._dist);
          if (cityData[0]._dist < 100) cityData = [cityData[0]];
        }
      }

      if (cityData.length > 1 && searchMode !== 'prompt' && searchMode !== 'manual') {
        setDisambiguationOptions(cityData);
        setDisambiguationContext(context);
        setIsSidebarOpen(true);
        return;
      }

      const match = cityData[0];
      setValidatedCityData(match);

      if (context === 'submit') {
        await loadMapWithCity(match, interestOverride, paramsOverride);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  }, [city, validatedCityData, searchMode, language, userLocation, loadMapWithCity]);
  const handleUseCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Locatie zoeken...' : 'Finding your location...');
    setIsTrackingEnabled(true);

    return new Promise((resolve) => {
      const processCoordinates = async (latitude, longitude) => {
        const resultData = await locationService.reverseGeocode(latitude, longitude, language);
        if (resultData) {
          setCity(resultData.display_name);
          setValidatedCityData(resultData);
          setFocusedLocation({ lat: latitude, lng: longitude });
          setUserLocation({ lat: latitude, lng: longitude });
        }
        setIsLoading(false);
        setLoadingText('Exploring...');
        return resultData;
      };

      const runIpFallback = async () => {
        console.log("GPS failed. Attempting IP fallback...");
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.latitude && data.longitude) {
            await processCoordinates(data.latitude, data.longitude);
          } else {
            throw new Error("Invalid IP data");
          }
        } catch (e) {
          console.error("IP Fallback failed", e);
          setIsLoading(false);
          setLoadingText('Exploring...');
          const manualLocation = prompt(language === 'nl'
            ? "Ik kon je locatie niet automatisch bepalen. Waar wil je vertrekken?"
            : "I couldn't find your location. Where do you want to start?");

          if (manualLocation && manualLocation.trim().length > 0) {
            setCity(manualLocation);
            resolve({ name: manualLocation, display_name: manualLocation });
          } else resolve(null);
        }
      };

      if (!navigator.geolocation) {
        runIpFallback();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => processCoordinates(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("Geolocation API error:", err.code, err.message);
          runIpFallback();
        },
        { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });
  }, [language, setIsLoading, setLoadingText, setIsTrackingEnabled, setCity, setValidatedCityData, setFocusedLocation, setUserLocation]);






  // New Handler for AI-triggered Searches - Revised for Smart Algorithm
  const handleAiSearchRequest = useCallback(async (rawQuery) => {
    const searchId = Date.now();
    console.log(`[AI Search #${searchId}] Starting for:`, rawQuery);

    let query = rawQuery;
    let locationContext = null;

    const nearSplit = rawQuery.split(/\s*\|\s*NEAR:\s*/i);
    if (nearSplit.length > 1) {
      query = nearSplit[0].trim();
      locationContext = nearSplit[1].trim();
    }

    setLoadingText(language === 'nl' ? `Zoeken naar ${query}...` : `Searching for ${query}...`);
    setIsLoading(true);

    try {
      const { getCombinedPOIs } = await import('./utils/poiService');

      let center = routeData?.center;
      let radius = 2;
      let contextFound = false;
      let referencePoiId = null;

      if (locationContext && routeData && routeData.pois) {
        const upperContext = locationContext.toUpperCase();
        if (upperContext === '@CURRENT_ROUTE' || upperContext === '@ROUTE') {
          center = routeData.center;
          radius = 10;
          contextFound = true;
        } else if (upperContext === '@MIDPOINT') {
          if (routeData.pois.length >= 2) {
            let totalDist = 0;
            const dists = [0];
            for (let i = 0; i < routeData.pois.length - 1; i++) {
              const d = getDistance(routeData.pois[i].lat, routeData.pois[i].lng, routeData.pois[i + 1].lat, routeData.pois[i + 1].lng);
              totalDist += d;
              dists.push(totalDist);
            }
            const halfDist = totalDist / 2;
            let midIndex = 0;
            for (let i = 0; i < dists.length; i++) {
              if (dists[i] >= halfDist) {
                midIndex = Math.max(0, i - 1);
                break;
              }
            }
            const midPoi = routeData.pois[midIndex];
            if (midPoi) {
              center = [midPoi.lat, midPoi.lng];
              radius = 5.0;
              contextFound = true;
              referencePoiId = midPoi.id;
            }
          }
        } else {
          let target = null;
          const indexMatch = locationContext.match(/(?:POI|punt|#)?\s*(\d+)/i);
          if (indexMatch) {
            const idx = parseInt(indexMatch[1]) - 1;
            if (idx >= 0 && idx < routeData.pois.length) target = routeData.pois[idx];
          }
          if (!target) {
            target = routeData.pois.find(p => p.name.toLowerCase().includes(locationContext.toLowerCase()));
          }
          if (target) {
            center = [target.lat, target.lng];
            radius = 5.0;
            contextFound = true;
            referencePoiId = target.id;
          }
        }
      }

      if (!contextFound) {
        if (userLocation && userLocation.lat) {
          center = [userLocation.lat, userLocation.lng];
          radius = 5.0;
        } else if (routeData?.center) {
          center = routeData.center;
          radius = 7.0;
        } else if (validatedCityData) {
          center = [validatedCityData.lat, validatedCityData.lon];
        }
      }

      if (!center || isNaN(center[0])) {
        center = validatedCityData ? [validatedCityData.lat, validatedCityData.lon] : [48.8566, 2.3522];
        radius = 15;
      }

      const tempCityData = { lat: center[0], lon: center[1], name: "Search Area" };
      const robustSources = { osm: true, foursquare: true, google: true };

      let candidates = await getCombinedPOIs(tempCityData, query, city || "Nearby", radius, robustSources, language, (msg) => setLoadingText(msg));
      if ((!candidates || candidates.length === 0) && radius < 15) {
        candidates = await getCombinedPOIs(tempCityData, query, city || "Nearby", 15, robustSources, language, (msg) => setLoadingText(msg));
      }

      if (candidates && candidates.length > 0) {
        const currentRoute = routeData?.pois || [];
        const travelModeForEstimation = travelMode === 'cycling' ? 'bike' : 'walk';

        const suggestions = candidates.slice(0, 3).map(cand => {
          let anchorIdx = -1;
          if (referencePoiId) {
            anchorIdx = currentRoute.findIndex(p => p.id === referencePoiId);
          }

          let primaryDetour = { added_distance_m: 0, added_duration_min: 0 };
          if (routeData && routeData.center) {
            try {
              primaryDetour = smartPoiUtils.added_detour_if_inserted_after(
                { center: routeData.center, pois: currentRoute },
                anchorIdx,
                cand,
                travelModeForEstimation
              );
            } catch (err) { console.warn("Detour calc failed", err); }
          }

          let bestAlternative = null;
          let minAlternativeDetour = primaryDetour.added_distance_m;

          if (routeData && routeData.center) {
            for (let i = -1; i < currentRoute.length; i++) {
              if (i === anchorIdx) continue;
              try {
                const altDetour = smartPoiUtils.added_detour_if_inserted_after(
                  { center: routeData.center, pois: currentRoute },
                  i,
                  cand,
                  travelModeForEstimation
                );
                if (altDetour.added_distance_m < minAlternativeDetour - 100) {
                  minAlternativeDetour = altDetour.added_distance_m;
                  const refPoi = i === -1 ? { name: language === 'nl' ? 'Start' : 'Start', index: -1 } : { ...currentRoute[i], index: i };
                  bestAlternative = {
                    suggest_after_poi_index: i,
                    poi_name: refPoi.name,
                    detour: altDetour,
                    why_better: language === 'nl'
                      ? `Slechts ${altDetour.added_distance_m}m omweg vs ${primaryDetour.added_distance_m}m.`
                      : `Only ${altDetour.added_distance_m}m detour vs ${primaryDetour.added_distance_m}m.`
                  };
                }
              } catch (e) { /* ignore */ }
            }
          }

          return {
            ...cand,
            detour_km: primaryDetour.added_distance_m / 1000,
            added_duration_min: primaryDetour.added_duration_min,
            anchorPoiIndex: anchorIdx,
            smartAlternative: bestAlternative
          };
        });

        setAiChatHistory(prev => [...prev, {
          role: 'system',
          type: 'poi_suggestions',
          data: suggestions,
          query: query,
          context: { referencePoiId, anchorPoiIndex: referencePoiId ? currentRoute.findIndex(p => p.id === referencePoiId) : -1 }
        }]);
      } else {
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl' ? `Ik heb helaas geen "${query}" gevonden in de buurt. Misschien staat het anders bekend?` : `I couldn't find any "${query}" nearby. Maybe it's known under a different name?`
        }]);
      }
    } catch (e) {
      console.error("AI Search CRASH:", e);
      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: language === 'nl' ? "Oei, er liep iets mis bij het zoeken. Probeer je het nog een keer met een andere omschrijving?" : "Oops, something went wrong while searching. Could you try again with a different description?"
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [language, setIsLoading, setLoadingText, routeData, userLocation, validatedCityData, city, travelMode, setAiChatHistory]);


  const handleAddToJourney = useCallback(async (e, interestOverride = null, paramsOverride = null) => {
    e && e.preventDefault();

    if (searchMode === 'prompt' && !interestOverride) {
      if (!aiPrompt.trim()) return;
      // Break circular dependency with Ref
      if (processAIPromptRef.current) {
        return await processAIPromptRef.current(aiPrompt);
      }
      return;
    }

    const activeInterest = interestOverride || interests || (language === 'nl' ? 'toeristische plekken' : 'tourist highlights');
    // NOTE: Removed empty interest guard. poiService.js now handles empty interests.

    if (interestOverride) setInterests(interestOverride);

    setIsLoading(true);
    setFoundPoisCount(0);

    try {
      const currentPois = routeData.pois;
      const cityCenter = routeData.center;

      const activeParams = paramsOverride || {};
      const effectiveTravelMode = activeParams.travelMode || travelMode;
      const effectiveConstraintType = activeParams.constraintType || constraintType;
      const effectiveConstraintValue = activeParams.constraintValue || constraintValue;
      const effectiveRoundtrip = activeParams.isRoundtrip !== undefined ? activeParams.isRoundtrip : isRoundtrip;

      const constraints = {
        type: effectiveConstraintType,
        value: effectiveConstraintValue,
        isRoundtrip: effectiveRoundtrip
      };

      // 1. Fetch NEW candidates
      let searchRadiusKm = constraints.value;
      if (constraints.type === 'duration') {
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        searchRadiusKm = (constraints.value / 60) * speed;
      }

      let targetCityData = validatedCityData;
      if (!targetCityData) {
        // Mock it
        targetCityData = { lat: cityCenter[0], lon: cityCenter[1], name: city };
      }

      let newCandidates = [];
      if (activeParams.directCandidates) {
        // USE PROVIDED CANDIDATES (From AI Chat)
        newCandidates = activeParams.directCandidates;
        console.log("AddJourney: Using direct candidates", newCandidates);
      } else {
        // FETCH NORMAL
        newCandidates = await getCombinedPOIs(targetCityData, activeInterest, city, searchRadiusKm, searchSources, language, (msg) => setLoadingText(msg));
      }

      console.log(`AddJourney: Found ${newCandidates.length} candidates for ${activeInterest}`);
      setFoundPoisCount(newCandidates.length);

      if (newCandidates.length === 0) {
        // ...
        if (searchMode === 'prompt') {
          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? `Ik heb gezocht naar "${activeInterest}", maar ik kon helaas geen nieuwe plekjes vinden in de buurt van je route.`
              : `I searched for "${activeInterest}", but unfortunately I couldn't find any new spots near your route.`
          }]);
        } else {
          // Propose Refinement
          const suggestions = getInterestSuggestions(activeInterest, language);
          if (suggestions.length > 0) {
            setRefinementProposals(suggestions);
            setLastAction('add');
            return;
          }
          alert(`No new spots found for "${activeInterest}".`);
        }
        return;
      }



      // 2. Filter New Candidates (Dedupe)
      const existingIds = new Set(currentPois.map(p => p.id || p.name));
      const uniqueNew = newCandidates.filter(p => !existingIds.has(p.id || p.name));
      console.log(`AddJourney: ${uniqueNew.length} unique candidates remaining after dedupe.`);

      if (uniqueNew.length === 0) {
        if (searchMode === 'prompt') {
          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? `Het lijkt erop dat alle gevonden plekjes voor "${activeInterest}" al in je trip staan!`
              : `It looks like all the spots I found for "${activeInterest}" are already in your trip!`
          }]);
        } else {
          alert('All found spots are already in your journey!');
        }
        return;
      }

      // 3. PROPOSAL SELECTION STEP
      // If we are NOT already in "direct add" mode (where we already picked a POI),
      // we show proposals first.
      if (!activeParams.directCandidates) {
        console.log("AddJourney: Showing proposals for", activeInterest);

        const activeIdx = activePoiIndex || 0;
        const proposalsWithDetour = uniqueNew.slice(0, 5).map(cand => {
          const detourResult = smartPoiUtils.added_detour_if_inserted_after(
            { center: routeData.center, pois: currentPois },
            activeIdx,
            cand,
            effectiveTravelMode
          );
          return { ...cand, detour_km: detourResult.added_distance_m / 1000 };
        });

        setPoiProposals({
          candidates: proposalsWithDetour,
          activeInterest,
          params: activeParams
        });
        setIsLoading(false);
        return;
      }

      // 4. Smart Insertion Logic

      const candidatePool = [...uniqueNew.slice(0, 3)];
      let optimizedPois = [];

      // If we haven't started (index 0) or simple add, treat as new set.
      // BUT if we have an active route (activePoiIndex > 0), we must respect visited history.

      const activeIdx = activePoiIndex || 0;

      if (activeIdx > 0 && routeData.pois && routeData.pois.length > 0) {
        // Strategy: Keep 0..activeIdx-1 (Visited) FIXED.
        // Insert new candidates roughly after activeIdx.
        // Then append the rest of the old route.
        // Ideally, we should optimize the "Future" methods, but for now simple insertion is safer 
        // to avoid jumping back and forth.

        const visitedPois = currentPois.slice(0, activeIdx);
        const upcomingPois = currentPois.slice(activeIdx);

        // Find optimal insertion for new candidates among upcoming?
        // Simple heuristic: Insert NEW ones right after visited (High Priority Stop), 
        // then the rest of upcoming.
        // Or: Insert new ones at the TOP of upcoming list. (Immediate Next Stop).

        // We will do: Visited -> [New Candidates Optimized] -> Upcoming
        // This ensures the user goes there NEXT.

        // Optimize New Candidates order relative to last visited
        let lastVisited = visitedPois[visitedPois.length - 1] || { lat: cityCenter[0], lng: cityCenter[1] };
        let remainingCandidates = [...candidatePool];
        let sortedNew = [];

        let curr = lastVisited;
        while (remainingCandidates.length > 0) {
          let nearestIdx = -1;
          let minDist = Infinity;
          for (let i = 0; i < remainingCandidates.length; i++) {
            const d = getDistance(curr.lat, curr.lng, remainingCandidates[i].lat, remainingCandidates[i].lng);
            if (d < minDist) {
              minDist = d;
              nearestIdx = i;
            }
          }
          const best = remainingCandidates.splice(nearestIdx, 1)[0];
          sortedNew.push(best);
          curr = best;
        }

        optimizedPois = [...visitedPois, ...sortedNew, ...upcomingPois];
        console.log("Smart Insertion: Added", sortedNew.length, "stops after index", activeIdx);

      } else {
        // No active progress (or at start): Reshuffle everything for global optimality
        // (Legacy Logic)
        const mergedList = [...currentPois, ...candidatePool];
        const visited = new Set();
        let curr = { lat: cityCenter[0], lng: cityCenter[1] };

        // NEW LOGIC: If route active/exists, use insertion. Else sort.
        if (currentPois.length > 0) {
          let currentRoute = [...currentPois];
          const startLoc = { lat: cityCenter[0], lng: cityCenter[1] };

          // Check if we have a preference reference (e.g. "After Modemuseum")
          const preferredRefId = activeParams?.referencePoiId;
          const explicitInsertIdx = activeParams?.insertAfterIndex;
          let refInsertIdx = -1;

          if (explicitInsertIdx !== undefined) {
            refInsertIdx = explicitInsertIdx + 1; // 0 for after start (-1 + 1), etc.
          } else if (preferredRefId) {
            const foundIdx = currentRoute.findIndex(p => p.id === preferredRefId);
            if (foundIdx !== -1) refInsertIdx = foundIdx + 1;
          }

          for (const cand of candidatePool) {
            let bestIdx = -1;

            if (refInsertIdx !== -1) {
              // Strict Insertion Context found
              bestIdx = refInsertIdx;
              refInsertIdx++; // Shift for next candidate to maintain order
            } else {
              // Standard Cheapest Insertion
              let minCost = Infinity;
              for (let i = 0; i <= currentRoute.length; i++) {
                const prev = (i === 0) ? startLoc : currentRoute[i - 1];
                const next = (i === currentRoute.length) ? null : currentRoute[i];
                const d1 = getDistance(prev.lat, prev.lng, cand.lat, cand.lng);
                let inc = 0;
                if (next) {
                  const d2 = getDistance(cand.lat, cand.lng, next.lat, next.lng);
                  const base = getDistance(prev.lat, prev.lng, next.lat, next.lng);
                  inc = d1 + d2 - base;
                } else inc = d1;
                if (inc < minCost) { minCost = inc; bestIdx = i; }
              }
            }

            if (bestIdx !== -1) currentRoute.splice(bestIdx, 0, cand);
            else currentRoute.push(cand);
          }
          optimizedPois = currentRoute;
        } else {
          // Basic Greedy Sort (Legacy)
          while (optimizedPois.length < mergedList.length) {
            let nearest = null;
            let minDist = Infinity;
            for (const p of mergedList) {
              if (visited.has(p.id)) continue;
              const d = getDistance(curr.lat, curr.lng, p.lat, p.lng);
              if (d < minDist) { minDist = d; nearest = p; }
            }
            if (nearest) { optimizedPois.push(nearest); visited.add(nearest.id); curr = { lat: nearest.lat, lng: nearest.lng }; }
            else break;
          }
        }
      }

      // 4. Enrich & Get Path
      // Initialize POIs with defaults and loading state for enrichment
      const fullyEnriched = optimizedPois.map(p => {
        // If it's already enriched, keep it.
        if (p.description && p.isFullyEnriched) return p;

        // Otherwise set as loading
        return {
          ...p,
          description: p.description || (language === 'nl' ? 'Informatie ophalen...' : 'Fetching details...'),
          isFullyEnriched: false,
          isLoading: true
        };
      });

      let finalDist = 0;

      // Calculate simple distance for immediate feedback
      finalDist = fullyEnriched.reduce((acc, p, i) => {
        const prev = (i === 0) ? { lat: cityCenter[0], lng: cityCenter[1] } : fullyEnriched[i - 1];
        return acc + getDistance(prev.lat, prev.lng, p.lat, p.lng);
      }, 0);


      // Define Limit with tolerance
      let targetLimitKm = constraints.value;
      if (constraints.type === 'duration') {
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        targetLimitKm = (constraints.value / 60) * speed;
      }
      const maxLimitKm = targetLimitKm * 1.15; // 15% Tolerance

      const newRouteData = {
        ...routeData,
        center: cityCenter,
        pois: fullyEnriched,
        originalPois: fullyEnriched,
        routePath: routeData.routePath || [], // Keep old path or empty
        navigationSteps: routeData.navigationSteps || [],
        legs: routeData.legs || [],
        stats: {
          ...routeData.stats,
          totalDistance: finalDist.toFixed(1),
          walkDistance: (finalDist || 0).toFixed(1),
          limitKm: targetLimitKm.toFixed(1),
          isRoundtrip: constraints.isRoundtrip
        }
      };

      // 5. Check Limit
      console.log(`AddJourney: New Dist ${finalDist.toFixed(1)}km vs Limit ${maxLimitKm.toFixed(1)}km`);

      // OPTIMISTIC UPDATE:
      // We first update the state with the NEW POIs and the OLD Path (or a direct line approximation).
      // Then we let the route calculation finish in background and update again.

      const optimisticRouteData = {
        ...routeData,
        center: cityCenter,
        pois: fullyEnriched,
        // Keep old path temporarily or use straight lines? 
        // Better to show straight lines or old path + lines to new points than nothing.
        // For now, let's just update POIs. The map will show them. Path will snap in a second.
        routePath: routeData.routePath || [],
        stats: {
          ...routeData.stats,
          totalDistance: "...", // Show it's calculating
        }
      };

      // 1. Immediate UI Update (Show markers)
      setRouteData(optimisticRouteData);
      setIsSidebarOpen(false); // Close sidebar immediately for responsiveness

      // 2. Background Route Calculation
      calculateRoutePath(fullyEnriched, cityCenter, travelMode, routeData?.stopCenter, isRoundtrip, isRouteEditMode)
        .then(routeResult => {
          if (!routeResult) return;

          const finalDist = routeResult.dist;

          // Re-check limit with actual distance
          if (finalDist > maxLimitKm) {
            console.log("AddJourney: Limit exceeded (Async). Triggering confirmation.");
            // We might need to keep the "Optimistic" state or revert? 
            // For a smooth UX, let's ask confirm. If they say no, we revert (which means setting routeData back to `activeParams`? No, we lost that).
            // Actually, if we already updated the state, "Confirmation" becomes "Warning/Undo".
            // But the current `handleConfirmLimit` expects to *apply* a proposed route.
            // So for now, let's just warn if it exceeds significantly, or trust the user.

            // Alternative: The original logic was "Ask BEFORE updating". 
            // To be truly optimistic, we update, and if it's too long, we show a warning "Trip is long (X km)".
            // But sticking to the exact original "Block if too long" logic makes "Optimistic" hard.

            // COMPROMISE: We updated POIs. Now we update Path.
            // If it exceeds limit, we show the confirmation dialog which (if accepted) keeps it, or (if declined) REVERTS to `routeData` (which is now the new one!).
            // Wait, we need the *original* route data to revert to.

            // Let's stick to the "Calculate first" flow but WITHOUT the arbitrary delay, 
            // AND we set `setIsLoading(false)` earlier if possible?
            // Actually, the OSRM calc IS the bottleneck (1-2s).

            // Revised Optimistic Approach:
            // 1. Show POIs on map (Grayed out? Or just markers).
            // 2. Calculate.
            // 3. If fits -> Solidify.
            // 4. If exceeds -> Ask.

            // Since this is a "Complexity 5" refactor, let's just remove the AWAIT.
            // We accept that the "Limit Check" happens *after* the calculation.

            setLimitConfirmation({
              proposedRouteData: {
                ...optimisticRouteData,
                routePath: routeResult.path,
                navigationSteps: routeResult.steps,
                legs: routeResult.legs,
                stats: {
                  ...optimisticRouteData.stats,
                  totalDistance: finalDist,
                  walkDistance: (routeResult?.walkDist || 0)
                }
              },
              message: language === 'nl'
                ? `Deze toevoeging maakt de reis ${finalDist.toFixed(1)} km. Je limiet is ${targetLimitKm.toFixed(1)} km. Wil je doorgaan?`
                : `This addition makes the journey ${finalDist.toFixed(1)} km. Your limit is ${targetLimitKm.toFixed(1)} km. Do you want to proceed?`
            });

            // We effectively "halt" the final path update until they confirm.
            // The points are visible (from optimistic update) but path is old/missing. 
            // This is an acceptable intermediate state.

          } else {
            // Fits! Update with full path
            setRouteData(prev => ({
              ...prev,
              routePath: routeResult.path,
              navigationSteps: routeResult.steps,
              legs: routeResult.legs,
              stats: {
                ...prev.stats,
                totalDistance: finalDist,
                walkDistance: (routeResult?.walkDist || 0)
              }
            }));

            // Trigger Enrichment
            enrichBackground(fullyEnriched, validatedCityData?.name || city, language, descriptionLength, activeInterest, "Added Spot Enrichment");

            if (searchMode === 'prompt') {
              setAiChatHistory(prev => [...prev, {
                role: 'brain',
                text: language === 'nl'
                  ? "Ik heb de nieuwe plekken toegevoegd aan je trip! Is er nog iets anders dat je wilt verbeteren of aanpassen? Ik help je graag verder."
                  : "I've added the new spots to your trip! Is there anything else you'd like to improve or adjust? I'm happy to help."
              }]);
            }
          }

        })
        .catch(err => {
          console.error("Async Route Calc failed", err);
          // Revert or just show error?
          // Ideally revert to `routeData` before optimistic update.
          // For now, alert.
        });


    } catch (err) {
      console.error("Add to journey failed", err);
      // Feedback to User
      if (searchMode === 'prompt') {
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl'
            ? "Oei, ik kon de plek niet toevoegen door een technische fout. Soms helpt het om de pagina te verversen."
            : "Oops, I couldn't add the spot due to a technical error. Refreshing the page might help."
        }]);
      } else {
        alert("Failed to add spot to route.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [searchMode, aiPrompt, interests, language, routeData, travelMode, constraintType, constraintValue, isRoundtrip, validatedCityData, city, searchSources, activePoiIndex, isRouteEditMode, descriptionLength, handleAiSearchRequest, handleCityValidation]);
  const processAIPrompt = useCallback(async (promptText, shouldAutoRead = false) => {
    if (!promptText.trim()) return;

    const newUserMsg = { role: 'user', text: promptText };
    setAiChatHistory(prev => [...prev, newUserMsg]);
    setAiPrompt('');

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'gids denkt na...' : 'guide is thinking...');

    try {
      const updatedHistory = [...aiChatHistory, newUserMsg];
      const engine = new PoiIntelligence({ language });
      const routeContext = routeData ? {
        isActive: true,
        city: validatedCityData?.name || validatedCityData?.address?.city || (routeData ? city : null),
        stats: routeData.stats,
        poiNames: routeData.pois ? routeData.pois.map(p => p.name).join(', ') : '',
        startName: routeData.startName || startPoint
      } : null;

      const result = await engine.parseNaturalLanguageInput(promptText, language, updatedHistory, routeContext);
      if (!result) throw new Error("Guide translation failed");

      let aiResponseText = result.message;
      let searchIntent = null;
      const searchMatch = aiResponseText.match(/\[{1,2}\s*SEARCH\s*:\s*([\s\S]*?)\s*\]{1,2}/i);
      const semanticMatch = aiResponseText.match(/(?:Ik zoek|I am searching for|Checking|Opzoeken van)\s+(?:de|het|een|an|a|the)?\s*([A-Z][a-zA-Z0-9\s\-\']+?)\s+(?:voor je op|for you|in de buurt|nearby)/i);

      if (searchMatch) {
        searchIntent = searchMatch[1];
        aiResponseText = aiResponseText.replace(searchMatch[0], '').trim();
      } else if (semanticMatch) {
        searchIntent = semanticMatch[1].trim();
      }

      setAiChatHistory(prev => [...prev, { role: 'brain', text: aiResponseText }]);

      if (searchIntent) {
        await handleAiSearchRequest(searchIntent);
      } else {
        if (result.params) {
          const p = result.params;
          if (p.city) setCity(p.city);
          if (p.interests) setInterests(p.interests);
          if (p.travelMode) setTravelMode(p.travelMode);
          if (p.constraintType) setConstraintType(p.constraintType);
          if (p.constraintValue) setConstraintValue(p.constraintValue);
          if (p.startPoint) setStartPoint(p.startPoint);
        }

        if (result.status === 'close') {
          setIsAiViewActive(false);
          return null;
        }

        if (result.status === 'complete') {
          const newCity = result.params?.city;
          const currentActiveCity = validatedCityData?.name || validatedCityData?.address?.city || (routeData ? city : null);
          const isCitySwitch = newCity && currentActiveCity && newCity.toLowerCase().trim() !== currentActiveCity.toLowerCase().trim();
          const effectiveInterests = result.params?.interests || interests;

          if (!routeData || isCitySwitch) {
            let finalCity = newCity || city;
            const startPointState = result.params?.startPoint || "";
            const isCurrentLoc = startPointState && (startPointState.toLowerCase().includes('huidig') || startPointState.toLowerCase().includes('current') || startPointState.toLowerCase().includes('mijn locat'));

            if (!finalCity && isCurrentLoc) {
              const cityData = await handleUseCurrentLocation();
              if (cityData && cityData.name) {
                finalCity = cityData.name;
                setCity(cityData.name);
              } else return null;
            }

            if (!finalCity) return null;

            setIsAiViewActive(true);
            await handleCityValidation('submit', finalCity, effectiveInterests, result.params);
            setTimeout(() => setIsAiViewActive(false), 1000);
            return;
          }

          if (routeData) {
            setIsAiViewActive(true);
            const actionRegex = /^(?:voeg|add|zoek|find|plaats|put)\b/i;
            const hasAction = actionRegex.test(promptText);
            let extractedInterest = null;
            if (hasAction) {
              let clean = promptText.replace(actionRegex, '').trim();
              clean = clean.replace(/[\.\?!]+$/, '');
              clean = clean.replace(/\b(?:toe|aan|in)\b$/i, '').trim();
              clean = clean.replace(/^(?:de|het|een|an|a|the)\b\s*/i, '').trim();
              clean = clean.replace(/^["']|["']$/g, '');
              if (clean.length > 2) extractedInterest = clean;
            }

            const userAskedForAdd = hasAction && !!extractedInterest;
            let targetInterest = (effectiveInterests && effectiveInterests !== interests) ? effectiveInterests : null;

            if (!targetInterest && userAskedForAdd && extractedInterest) {
              targetInterest = extractedInterest;
            }

            if (targetInterest) {
              await handleAiSearchRequest(targetInterest);
            } else {
              await handleAddToJourney(null, effectiveInterests, result.params);
              setTimeout(() => setIsAiViewActive(false), 1000);
            }
            return;
          }
        }
      }
      return null;
    } catch (err) {
      console.error("AI Prompt processing failed", err);
      setAiChatHistory(prev => [...prev, { role: 'brain', text: 'Oei, er liep iets mis bij het verwerken van je vraag. Probeer je het nog eens?' }]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [aiChatHistory, language, routeData, validatedCityData, city, startPoint, handleAiSearchRequest, setCity, setInterests, setTravelMode, setConstraintType, setConstraintValue, setStartPoint, setIsAiViewActive, interests, handleUseCurrentLocation, handleCityValidation, handleAddToJourney]);

  useEffect(() => {
    processAIPromptRef.current = processAIPrompt;
  }, [processAIPrompt]);

  // AR Scan Handler
  const handleArScan = useCallback(async (base64Image) => {
    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Object analyseren...' : 'Analyzing object...');

    try {
      const { PoiIntelligence } = await import('./services/PoiIntelligence');
      const intelligence = new PoiIntelligence({
        city: city || 'Unknown',
        language,
        interests
      });

      const result = await intelligence.analyzeImage(base64Image, userLocation);

      if (result) {
        setScanResult(result);
        setIsArMode(false);
      } else {
        alert(language === 'nl' ? 'Kon object niet identificeren.' : 'Could not identify object.');
      }
    } catch (error) {
      console.error("AR Scan error:", error);
      alert(language === 'nl' ? 'Er is een fout opgetreden.' : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [city, language, interests, userLocation, setIsLoading, setLoadingText, setScanResult, setIsArMode]);





  const handleJourneyStart = useCallback(async (e, interestOverride = null, promptOverride = null) => {
    e && e.preventDefault();

    if (searchMode === 'prompt') {
      const activePrompt = promptOverride || aiPrompt;
      if (!activePrompt.trim()) return;

      const isVoice = e && e.isVoice === true;
      await processAIPrompt(activePrompt, isVoice);
      return;
    }

    const activeInterest = interestOverride || interests || (language === 'nl' ? 'toeristische plekken' : 'tourist highlights');

    if (!city.trim()) {
      setShowCitySelector(true);
      return;
    }

    if (interestOverride) setInterests(interestOverride);

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Aan het verkennen...' : 'Exploring...');
    setFoundPoisCount(0);

    try {
      if (validatedCityData) {
        await loadMapWithCity(validatedCityData, activeInterest);
      } else {
        await handleCityValidation('submit', null, activeInterest);
      }
    } catch (err) {
      console.error("Journey start failed", err);
    } finally {
      setIsLoading(false);
      setNavPhase(NAV_PHASES.PRE_ROUTE);
    }
  }, [searchMode, aiPrompt, processAIPrompt, interests, language, city, validatedCityData, loadMapWithCity, handleCityValidation]);


  const handleSelectProposal = (poi) => {
    if (!poiProposals) return;
    const { activeInterest, params } = poiProposals;
    setPoiProposals(null);

    // Call handleAddToJourney with the specific chosen POI
    handleAddToJourney(null, activeInterest, {
      ...params,
      directCandidates: [poi]
    });
  };

  const handleCancelProposal = () => {
    setPoiProposals(null);
  };

  const handleConfirmLimit = (proceed) => {
    if (proceed && limitConfirmation) {
      setRouteData(limitConfirmation.proposedRouteData);

      // TRIGGER ENRICHMENT FOR NEW POIS (Post-Confirmation)
      const cityName = validatedCityData?.name || city;
      enrichBackground(limitConfirmation.proposedRouteData.pois, cityName, language, descriptionLength, interests, "Added Spot Enrichment");

      if (searchMode === 'prompt') {
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl'
            ? "Ik heb de nieuwe plekken toegevoegd aan je trip! Is er nog iets anders dat je wilt verbeteren of aanpassen? Ik help je graag verder."
            : "I've added the new spots to your trip! Is there anything else you'd like to improve or adjust? I'm happy to help."
        }]);
      } else {
        setIsSidebarOpen(false);
      }
    }
    setLimitConfirmation(null);
  };

  const handleDisambiguationSelect = async (selectedCityData) => {
    setDisambiguationOptions(null);

    // Update city name to a more descriptive one (e.g. "Hasselt, Belgium")
    const addr = selectedCityData.address || {};
    const name = addr.city || addr.town || addr.village || addr.municipality || selectedCityData.name;
    const country = addr.country;

    // Construct display name: "Name, Country"
    let displayName = name;
    if (country) {
      displayName = `${name}, ${country}`;
    } else if (selectedCityData.display_name) {
      // Fallback if structured address fails
      displayName = selectedCityData.display_name.split(',').slice(0, 2).join(',');
    }

    setCity(displayName);
    setValidatedCityData(selectedCityData); // Mark as valid

    if (disambiguationContext === 'submit') {
      // Show loading screen immediately
      setIsLoading(true);
      setIsSidebarOpen(false);
      setLoadingText(language === 'nl' ? 'Aan het verkennen...' : 'Exploring...');

      try {
        await loadMapWithCity(selectedCityData);
      } finally {
        setIsLoading(false);
      }
    }
    // If 'blur', we just corrected the name and return to form.
    setDisambiguationContext(null);
  };

  const handleDisambiguationCancel = () => {
    setDisambiguationOptions(null);
    setDisambiguationContext(null);
  };

  // Logic to update the start location of an existing route
  // This re-sorts the key POIs to be optimal from the NEW start location
  const handleUpdateStartLocation = useCallback(async (newStartInput) => {
    if (!routeData || !routeData.pois) return;

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Route herschikken...' : 'Reshuffling route...');

    try {
      let newStartCenter = routeData.center;
      const isCurrentLoc = newStartInput && (newStartInput.toLowerCase().includes('huidig') || newStartInput.toLowerCase().includes('current') || newStartInput.toLowerCase().includes('mijn locat'));

      if (isCurrentLoc) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          newStartCenter = [pos.coords.latitude, pos.coords.longitude];
        } catch (e) {
          console.warn("Geolocation failed", e);
          alert(language === 'nl' ? "Kon locatie niet bepalen." : "Could not determine location.");
          setIsLoading(false);
          return;
        }
      } else if (newStartInput && newStartInput.trim().length > 2) {
        try {
          const cityName = validatedCityData?.address?.city || city;
          const q = `${newStartInput}, ${cityName}`;
          const res = await apiFetch(`/api/nominatim?q=${encodeURIComponent(q)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) {
            newStartCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          } else {
            const res2 = await apiFetch(`/api/nominatim?q=${encodeURIComponent(newStartInput)}&format=json&limit=1`);
            const data2 = await res2.json();
            if (data2 && data2[0]) {
              newStartCenter = [parseFloat(data2[0].lat), parseFloat(data2[0].lon)];
            } else {
              alert(language === 'nl' ? "Startpunt niet gevonden." : "Start point not found.");
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn("Failed to geocode startPoint", e);
        }
      }

      const existingPois = [...routeData.pois];
      const optimizedPois = [];
      const visited = new Set();
      let curr = { lat: newStartCenter[0], lng: newStartCenter[1] };

      while (optimizedPois.length < existingPois.length) {
        let nearest = null;
        let minDist = Infinity;
        for (const p of existingPois) {
          if (visited.has(p.id)) continue;
          const d = getDistance(curr.lat, curr.lng, p.lat, p.lng);
          if (d < minDist) {
            minDist = d;
            nearest = p;
          }
        }
        if (nearest) {
          optimizedPois.push(nearest);
          visited.add(nearest.id);
          curr = { lat: nearest.lat, lng: nearest.lng };
        } else break;
      }

      const routeResult = await calculateRoutePath(optimizedPois, newStartCenter, travelMode, null, isRoundtrip, isRouteEditMode);

      const cityName = validatedCityData?.address?.city || city;
      const { PoiIntelligence } = await import('./services/PoiIntelligence');
      const engine = new PoiIntelligence({ city: cityName, language });
      const newStartInstr = await engine.fetchArrivalInstructions(newStartInput || cityName, cityName, language);

      let newEndInstr = routeData.endInfo;
      if (!routeData.stats?.isRoundtrip && optimizedPois.length > 0) {
        const lastPoi = optimizedPois[optimizedPois.length - 1];
        newEndInstr = await engine.fetchArrivalInstructions(lastPoi.name, cityName, language);
      }

      let startDisplayName = newStartInput || (language === 'nl' ? 'Startpunt' : 'Start Point');
      if (isCurrentLoc) {
        startDisplayName = language === 'nl' ? 'Huidige locatie' : 'Current Location';
      }

      const newRouteData = {
        ...routeData,
        center: newStartCenter,
        startName: startDisplayName,
        startIsPoi: false,
        startPoi: null,
        pois: optimizedPois,
        routePath: routeResult.path,
        navigationSteps: routeResult.steps,
        legs: routeResult.legs,
        startInfo: newStartInstr,
        endInfo: newEndInstr,
        stats: {
          ...routeData.stats,
          totalDistance: routeResult.dist.toFixed(1),
          walkDistance: (routeResult.walkDist || 0).toFixed(1)
        }
      };

      setRouteData(newRouteData);
      setStartPoint(newStartInput);

    } catch (e) {
      console.error("Update start failed", e);
      alert("Failed to update route.");
    } finally {
      setIsLoading(false);
    }
  }, [routeData, language, validatedCityData, city, travelMode, isRoundtrip, isRouteEditMode, setIsLoading, setLoadingText, setRouteData, setStartPoint, calculateRoutePath]);

  const handleSuggestionSelect = useCallback((suggestion) => {
    setRefinementProposals(null);
    if (lastAction === 'start') {
      handleJourneyStart(null, suggestion);
    } else if (lastAction === 'add') {
      handleAddToJourney(null, suggestion);
    }
  }, [lastAction, handleJourneyStart, handleAddToJourney]);


  const handleRemovePoi = useCallback(async (poiId) => {
    const updatedPois = routeData.pois.filter(p => p.id !== poiId);

    if (updatedPois.length === 0) {
      setRouteData(null);
      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: language === 'nl' ? "Je hebt alle punten verwijderd. Waar wil je nu heen?" : "You've removed all spots. Where to next?"
      }]);
      setIsAiViewActive(true);
      return;
    }

    setIsLoading(true);
    try {
      const cityCenter = routeData.center;
      const routeResult = await calculateRoutePath(updatedPois, cityCenter, travelMode, null, isRoundtrip, isRouteEditMode);

      setRouteData(prev => ({
        ...prev,
        pois: updatedPois,
        originalPois: updatedPois,
        routePath: routeResult.path,
        navigationSteps: routeResult.steps,
        stats: {
          ...prev.stats,
          totalDistance: routeResult.dist.toFixed(1),
          walkDistance: (routeResult.walkDist || 0).toFixed(1)
        }
      }));

      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: language === 'nl'
          ? "Route aangepast! Ik heb dat punt verwijderd en de snelste weg tussen de overgebleven plekken berekend."
          : "Route updated! I've removed that spot and recalculated the quickest path between the remaining ones."
      }]);

    } catch (err) {
      console.error("Failed to remove POI", err);
    } finally {
      setIsLoading(false);
    }
  }, [routeData, language, travelMode, isRoundtrip, isRouteEditMode, setIsLoading, setRouteData, setAiChatHistory, setIsAiViewActive, calculateRoutePath]);

  const handleStopsCountChange = useCallback(async (newCount) => {
    if (!routeData || !routeData.pois || routeData.pois.length === 0) return;

    const sourcePois = routeData.originalPois || routeData.pois;
    const currentCount = routeData.pois.length;

    if (newCount === currentCount && routeData.originalPois) return;

    const N = sourcePois.length;
    const K = newCount;

    if (K > N) return;

    const updatedPois = [];
    if (K <= 1) {
      updatedPois.push(sourcePois[0]);
    } else {
      for (let j = 0; j < K; j++) {
        const index = Math.round(j * (N - 1) / (K - 1));
        updatedPois.push(sourcePois[index]);
      }
    }

    setIsLoading(true);
    setLoadingText(language === 'nl' ? `Route aanpassen naar ${K} stops...` : `Adjusting route to ${K} stops...`);

    try {
      const cityCenter = routeData.center;
      const routeResult = await calculateRoutePath(updatedPois, cityCenter, travelMode, routeData.stopCenter, isRoundtrip, isRouteEditMode);

      setRouteData(prev => ({
        ...prev,
        pois: updatedPois,
        originalPois: sourcePois,
        routePath: routeResult.path,
        navigationSteps: routeResult.steps,
        legs: routeResult.legs || [],
        stats: {
          ...prev.stats,
          totalDistance: routeResult.dist.toFixed(1),
          walkDistance: (routeResult.walkDist || 0).toFixed(1)
        }
      }));
    } catch (err) {
      console.warn("Stops count change failed", err);
    } finally {
      setIsLoading(false);
    }
  }, [routeData, language, travelMode, isRoundtrip, isRouteEditMode, setIsLoading, setLoadingText, setRouteData, calculateRoutePath]);

  const handleConstraintValueFinal = (finalValue) => {
    if (!routeData) return;
    setPendingDistanceRefinement(finalValue);
  };

  const handleExecuteDistanceRefinement = async (finalValue) => {
    if (!routeData) return;
    setPendingDistanceRefinement(null);

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Nieuwe route berekenen...' : 'Calculating new route...');

    try {
      // Sync state and define override params
      setConstraintValue(finalValue);
      const paramsOverride = { constraintValue: finalValue };

      // Trigger recalculation using validated city data (cache) if available
      if (validatedCityData) {
        await loadMapWithCity(validatedCityData, interests, paramsOverride);
      } else {
        // Fallback to validation but ensure queryOverride is null to trigger cache check
        await handleCityValidation('submit', null, interests, paramsOverride);
      }

      // Return to map view
      setIsAiViewActive(false);
    } catch (err) {
      console.error("Distance refinement execution failed", err);
    } finally {
      setIsLoading(false);
    }
  };


  /**
  * Cyclically rotates the entire route so that a selected POI becomes the new start point.
  * POI-namen zijn immutable; startpunt is een rol, geen naam.
  */
  const handleCycleStart = useCallback(async (selectedPoiId) => {
    if (!routeData || !routeData.pois || !isRoundtrip) return;

    if (!routeData.startIsPoi) {
      const targetIdx = routeData.pois.findIndex(p => p.id === selectedPoiId);
      if (targetIdx === -1) return;

      setIsLoading(true);
      setLoadingText(language === 'nl' ? 'Nieuw startpunt instellen...' : 'Setting new start point...');

      try {
        const rotatedPois = rotateCycle(routeData.pois, targetIdx);
        const newStartPoi = { ...rotatedPois[0], isSpecial: true };
        const remainingPois = rotatedPois.slice(1);

        const newStartCenter = [newStartPoi.lat, newStartPoi.lng];
        const routeResult = await calculateRoutePath(remainingPois, newStartCenter, travelMode, null, isRoundtrip, isRouteEditMode);

        const cityName = validatedCityData?.address?.city || city;
        const { PoiIntelligence } = await import('./services/PoiIntelligence');
        const engine = new PoiIntelligence({ city: cityName, language });
        const newStartInstr = await engine.fetchArrivalInstructions(newStartPoi.name, cityName, language);

        setRouteData(prev => ({
          ...prev,
          center: newStartCenter,
          startName: newStartPoi.name,
          startPoiId: newStartPoi.id,
          startPoi: newStartPoi,
          startIsPoi: true,
          startInfo: newStartInstr,
          pois: remainingPois,
          routePath: routeResult.path,
          navigationSteps: routeResult.steps,
          legs: routeResult.legs,
          stats: {
            ...prev.stats,
            totalDistance: routeResult.dist.toFixed(1),
            walkDistance: (routeResult.walkDist || 0).toFixed(1)
          }
        }));

        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl'
            ? `Route aangepast! Je start nu bij **${newStartPoi.name}**.`
            : `Route updated! You now start at **${newStartPoi.name}**.`
        }]);

      } catch (err) {
        console.error("Failed to cycle start", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const currentStartPoi = routeData.startPoi;
    const allStops = [currentStartPoi, ...routeData.pois];
    const targetIdx = allStops.findIndex(p => p.id === selectedPoiId);
    if (targetIdx === -1) return;

    const rotatedStops = rotateCycle(allStops, targetIdx);
    const newStartPoi = { ...rotatedStops[0], isSpecial: true };
    const newCenter = [newStartPoi.lat, newStartPoi.lng];

    const newPois = rotatedStops.slice(1).map(p => {
      if (p.id === currentStartPoi.id) {
        return { ...p, isSpecial: false };
      }
      return p;
    });

    let newPath = routeData.routePath;
    let newSteps = routeData.navigationSteps;
    let newLegs = routeData.legs;

    if (routeData.legs && routeData.legs.length === allStops.length) {
      const rotatedLegs = rotateCycle(routeData.legs, targetIdx);

      if (rotatedLegs.every(l => l && l.geometry)) {
        newPath = rotatedLegs.flatMap((leg, idx) => {
          const coords = transformOSRMCoords(leg.geometry.coordinates, `rotated_leg_${idx}`);
          return idx === 0 ? coords : coords.slice(1);
        });

        newSteps = rotatedLegs.flatMap(l => l.steps || []);
        newLegs = rotatedLegs;
      }
    }

    const cityName = validatedCityData?.address?.city || city;
    import('./services/PoiIntelligence').then(({ PoiIntelligence }) => {
      const engine = new PoiIntelligence({ city: cityName, language });
      engine.fetchArrivalInstructions(newStartPoi.name, cityName, language).then(newStartInstr => {
        if (newStartInstr) {
          setRouteData(prev => (prev && prev.startPoiId === newStartPoi.id) ? { ...prev, startInfo: newStartInstr } : prev);
        }
      });
    });

    setRouteData(prev => ({
      ...prev,
      center: newCenter,
      startName: newStartPoi.name,
      startPoiId: newStartPoi.id,
      startPoi: newStartPoi,
      pois: newPois,
      routePath: newPath,
      navigationSteps: newSteps,
      legs: newLegs,
      stats: {
        ...prev.stats,
        walkDistance: (newLegs && newLegs.length > 2)
          ? (newLegs.slice(1, -1).reduce((acc, leg) => acc + leg.distance, 0) / 1000).toFixed(1)
          : prev.stats.walkDistance
      }
    }));

    setAiChatHistory(prev => [...prev, {
      role: 'brain',
      text: language === 'nl'
        ? `Startpunt verplaatst naar **${newStartPoi.name}**.`
        : `Start point moved to **${newStartPoi.name}**.`
    }]);
  }, [routeData, isRoundtrip, setIsLoading, setLoadingText, language, travelMode, isRouteEditMode, validatedCityData, city, setRouteData, setAiChatHistory, calculateRoutePath]);

  /**
   * Reverses the direction of the current route while keeping the start point FIXED.
   * Requirement: Pure in-memory reversal of POIs and geometry.
   */
  const handleReverseDirection = useCallback(() => {
    if (!routeData || !routeData.pois || !isRoundtrip) return;

    const startObj = {
      ...(routeData.startIsPoi ? routeData.startPoi : {}),
      id: routeData.startPoiId || 'current-start-anchor',
      lat: routeData.center[0],
      lng: routeData.center[1],
      name: routeData.startName || (language === 'nl' ? 'Startpunt' : 'Start Point'),
      isSpecial: true,
      description: routeData.startIsPoi
        ? (routeData.startPoi?.description || routeData.startInfo)
        : routeData.startInfo
    };

    const fullCycle = [startObj, ...routeData.pois];
    const reveredCycle = reverseCycle(fullCycle);

    const reversedPois = reveredCycle.slice(1).map(p => {
      if (p.id === 'current-start-anchor') return { ...p, isSpecial: false };
      return p;
    });

    let newPath = routeData.routePath;
    let newSteps = routeData.navigationSteps;
    let newLegs = routeData.legs;

    if (routeData.legs && routeData.legs.length > 0) {
      const reversedOriginalLegs = [...routeData.legs].reverse();

      if (reversedOriginalLegs.every(l => l && l.geometry)) {
        newLegs = reversedOriginalLegs.map(leg => ({
          ...leg,
          geometry: {
            ...leg.geometry,
            coordinates: sanitizePath([...leg.geometry.coordinates], `reverse_leg_coords`).reverse()
          },
          steps: [...leg.steps].reverse()
        }));

        newPath = newLegs.flatMap((leg, idx) => {
          const coords = transformOSRMCoords(leg.geometry.coordinates, `reversed_leg_${idx}`);
          return idx === 0 ? coords : coords.slice(1);
        });

        newSteps = newLegs.flatMap(l => l.steps);
      }
    }

    setRouteData(prev => ({
      ...prev,
      pois: reversedPois,
      routePath: newPath,
      navigationSteps: newSteps,
      legs: newLegs,
      stats: {
        ...prev.stats,
        walkDistance: (newLegs && newLegs.length > 2)
          ? (newLegs.slice(1, -1).reduce((acc, leg) => acc + leg.distance, 0) / 1000).toFixed(1)
          : prev.stats.walkDistance
      }
    }));

    setAiChatHistory(prev => [...prev, {
      role: 'brain',
      text: language === 'nl'
        ? "Looprichting omgedraaid! De route blijft hetzelfde, maar je loopt hem nu andersom."
        : "Direction reversed! The route remains the same, but you are now walking it in the opposite direction."
    }]);
  }, [routeData, isRoundtrip, language, setRouteData, setAiChatHistory]);

  const resetSearch = () => {
    // Stop any background enrichment immediately
    if (enrichmentAbortController.current) {
      enrichmentAbortController.current.abort();
    }

    setRouteData(null);
    setDisambiguationOptions(null);
    setValidatedCityData(null);
    setCity('');
    setInterests('');
    setConstraintValue(5);
    setStartPoint('');
    setStopPoint('');
    setAiPrompt('');
    setAiChatHistory([
      {
        role: 'brain', text: language === 'nl'
          ? 'Hoi! Ik ben je gids van CityExplorer. Om je ideale route te plannen, heb ik wat info nodig:\n\n1. Welke **stad** wil je verkennen?\n2. Ga je **wandelen** of **fietsen**?\n3. Hoe **lang** (min) of hoe **ver** (km) wil je gaan?\n4. Wat zijn je **interesses**? (Indien leeg, toon ik je de belangrijkste bezienswaardigheden).'
          : 'Hi! I am your guide from CityExplorer. To plan your perfect route, I need a few details:\n\n1. Which **city** do you want to explore?\n2. Will you be **walking** or **cycling**?\n3. How **long** (min) or how **far** (km) would you like to go?\n4. What are your **interests**? (If left empty, I will show you the main tourist highlights).'
      }
    ]);
    setSearchMode('journey');
    setIsAiViewActive(true);
    setIsSidebarOpen(true);
    setNavPhase(NAV_PHASES.PRE_ROUTE);
  };

  const handleSaveRouteAsJSON = async () => {
    if (!routeData) {
      alert(language === 'nl' ? 'Er is geen route om op te slaan.' : 'No route to save.');
      return;
    }

    try {
      const dataToSave = {
        city: city,
        interests: interests,
        isRoundtrip: isRoundtrip,
        routeData: routeData,
        timestamp: new Date().toISOString()
      };

      console.log("[PDF] Requesting booklet generation...");
      const response = await apiFetch('/api/build-booklet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.url) {
        console.log("[PDF] Generation successful:", result.url);
        // Open the PDF in a new tab (using the server's port)
        window.open(`http://localhost:3001${result.url}`, '_blank');
      }
    } catch (err) {
      console.error("[PDF] Generation error:", err);
      alert(language === 'nl' ? 'Fout bij het genereren van de PDF.' : 'Error generating PDF.');
    }
  };

  // Audio State
  const [speakingId, setSpeakingId] = useState(null);
  const [currentSpeakingPoi, setCurrentSpeakingPoi] = useState(null); // Track object for auto-restart
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [autoAudio, setAutoAudio] = useState(() => localStorage.getItem('app_auto_audio') === 'true');
  const [spokenNavigationEnabled, setSpokenNavigationEnabled] = useState(() => localStorage.getItem('app_spoken_navigation') === 'true');

  useEffect(() => saveToStorageAsync('app_auto_audio', autoAudio), [autoAudio]);
  useEffect(() => saveToStorageAsync('app_spoken_navigation', spokenNavigationEnabled), [spokenNavigationEnabled]);

  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('app_voice_settings');
    return saved ? JSON.parse(saved) : { variant: 'nl', gender: 'female' };
  });

  useEffect(() => saveToStorageAsync('app_voice_settings', voiceSettings), [voiceSettings]);

  // Auto-restart speech when voice settings change
  useEffect(() => {
    if (currentSpeakingPoi && speakingId) {
      // Force restart with new settings
      handleSpeak(currentSpeakingPoi, true);
    }
  }, [voiceSettings]);

  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Only update if count changed to avoid render loops
        setAvailableVoices(prev => (prev.length === voices.length) ? prev : voices);
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const stopSpeech = useCallback(() => {
    if (speakingId) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setCurrentSpeakingPoi(null);
    setSpokenCharCount(0);
    setIsSpeechPaused(false);
  }, [speakingId]);

  const handleSpeak = useCallback((poiOrText, forceOrId = false) => {
    let isTextMode = typeof poiOrText === 'string';
    let textToRead = '';
    let uniqueId = '';
    let shouldForce = false;

    if (isTextMode) {
      textToRead = poiOrText;
      uniqueId = forceOrId;
      shouldForce = true;
    } else {
      if (!poiOrText) return;
      textToRead = poiOrText.description || '';
      uniqueId = poiOrText.id;
      shouldForce = forceOrId === true;

      if (poiOrText.structured_info) {
        const info = poiOrText.structured_info;
        const parts = [];
        const full = (info.full_description || '').toLowerCase().trim().replace(/[".]/g, '');
        const unknownTerms = ['onbekend', 'unknown', 'updating', 'bezig met bijwerken'];
        const hasFullDesc = info.full_description && !unknownTerms.some(term => full.includes(term));

        if (info.short_description && !hasFullDesc) parts.push(info.short_description);
        if (info.full_description && hasFullDesc) parts.push(info.full_description);
        if (info.matching_reasons && info.matching_reasons.length > 0) {
          const prefix = language === 'nl' ? "Waarom dit bij je past: " : "Why this matches your interests: ";
          parts.push(prefix + info.matching_reasons.join(". "));
        }
        if (info.fun_facts && info.fun_facts.length > 0) {
          const prefix = language === 'nl' ? "Wist je dat? " : "Did you know? ";
          parts.push(prefix + info.fun_facts.join(". "));
        }
        if (info.two_minute_highlight) {
          const prefix = language === 'nl' ? "Als je maar twee minuten hebt: " : "If you only have two minuten: ";
          parts.push(prefix + info.two_minute_highlight);
        }
        if (info.visitor_tips) {
          const prefix = language === 'nl' ? "Tips: " : "Tips: ";
          parts.push(prefix + info.visitor_tips);
        }
        textToRead = parts.join("\n\n");
      } else {
        textToRead = poiOrText.description || '';
      }
    }

    const isSame = speakingId === uniqueId;
    if (isSame && !shouldForce) {
      if (isSpeechPaused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
      }
      return;
    }

    setSpokenCharCount(0);
    setSpeakingId(uniqueId);
    if (!isTextMode) setCurrentSpeakingPoi(poiOrText);

    const u = new SpeechSynthesisUtterance(textToRead);
    if (!speechUtteranceRef.current) speechUtteranceRef.current = new Set();
    if (speechUtteranceRef.current instanceof Set) {
      speechUtteranceRef.current.add(u);
      u.onend = () => {
        speechUtteranceRef.current.delete(u);
        setSpeakingId(null);
        setCurrentSpeakingPoi(null);
        setSpokenCharCount(0);
        setIsSpeechPaused(false);
      };
      u.onerror = () => {
        speechUtteranceRef.current.delete(u);
        setSpeakingId(null);
      };
    } else {
      const old = speechUtteranceRef.current;
      speechUtteranceRef.current = new Set();
      if (old) speechUtteranceRef.current.add(old);
      speechUtteranceRef.current.add(u);
    }

    const targetLang = voiceSettings.variant === 'en' ? 'en-US' : (voiceSettings.variant === 'be' ? 'nl-BE' : 'nl-NL');
    const selectedVoice = getBestVoice(availableVoices, targetLang, voiceSettings.gender);

    if (selectedVoice) {
      u.voice = selectedVoice;
      u.lang = selectedVoice.lang;
    } else {
      u.lang = targetLang;
    }

    u.onend = () => {
      setSpeakingId(null);
      setCurrentSpeakingPoi(null);
      setSpokenCharCount(0);
      setIsSpeechPaused(false);
    };

    u.onboundary = (event) => setSpokenCharCount(event.charIndex);
    setIsSpeechPaused(false);
    window.speechSynthesis.speak(u);
  }, [speakingId, isSpeechPaused, language, voiceSettings, availableVoices]);

  // Handler for Sidebar Click
  const handlePoiClick = useCallback((poi, forcedMode = null) => {
    setFocusedLocation(poi);
    if (autoAudio) {
      const poiToSpeak = forcedMode ? { ...poi, active_mode: forcedMode } : poi;
      handleSpeak(poiToSpeak, true);
    }
  }, [autoAudio, handleSpeak]);

  const handleUpdatePoiDescription = async (poi, lengthMode) => {
    // 1. Mark as loading (optional, or optimistically update UI inside Sidebar)
    console.log("Updating POI", poi.name, "to length:", lengthMode);

    // Optimistic UI Update: Show "Updating..." and switch mode immediately for visual feedback
    setRouteData((prev) => {
      if (!prev || !prev.pois) return prev;
      return {
        ...prev,
        pois: prev.pois.map(p => p.id === poi.id ? {
          ...p,
          active_mode: lengthMode,
          description: language === 'nl' ? 'Bezig met bijwerken...' : 'Updating...'
        } : p)
      };
    });

    const actualDist = routeData?.stats?.totalDistance ? `${routeData.stats.totalDistance} km` : `${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}`;
    const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${actualDist}, roundtrip)`;
    const engine = new PoiIntelligence({
      city: city,
      language: language,
      lengthMode: lengthMode,
      interests: interests,
      routeContext: routeCtx
    });

    try {
      const enriched = await engine.evaluatePoi(poi);
      setRouteData((prev) => {
        if (!prev || !prev.pois) return prev;
        return {
          ...prev,
          pois: prev.pois.map(p => p.id === poi.id ? { ...enriched, isLoading: false, active_mode: lengthMode } : p)
        };
      });
    } catch (err) {
      console.warn("POI update failed", err);
    }
  };

  const handleNavigationRouteFetched = (steps) => {
    setRouteData(prev => {
      if (!prev) return prev;

      // Guard: If we already have navigation steps and they are effectively the same,
      // skip update to prevent re-render loops.
      if (prev.navigationSteps && prev.navigationSteps.length === steps.length) {
        const lastOld = prev.navigationSteps[prev.navigationSteps.length - 1]?.maneuver?.location;
        const lastNew = steps[steps.length - 1]?.maneuver?.location;

        if (lastOld && lastNew && lastOld[0] === lastNew[0] && lastOld[1] === lastNew[1]) {
          return prev;
        }
      }

      console.log("Navigation steps updated from MapContainer:", steps.length);
      return {
        ...prev,
        navigationSteps: steps
      };
    });
    // Removed automatic opening of navigation overlay
    // setIsNavigationOpen(true);
  };

  /**
   * Search for food/drink stop options near a specific POI
   * Used by RouteRefiner's extra stop wizard
   */
  const handleSearchStopOptions = async (searchParams) => {
    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Opties zoeken...' : 'Finding options...');
    const { stopType, afterStopIndex, referencePoi } = searchParams;

    if (!referencePoi || !routeData) {
      console.warn('Missing reference POI or route data for stop search');
      return [];
    }

    try {
      // Build search query based on stop type
      const query = stopType === 'food'
        ? (language === 'nl' ? 'restaurant eetcafé bistro' : 'restaurant bistro eatery')
        : (language === 'nl' ? 'café bar kroeg terras' : 'café bar pub terrace');

      // Use the reference POI's location as search center
      const searchCenter = {
        lat: referencePoi.lat,
        lon: referencePoi.lng || referencePoi.lon,
        name: referencePoi.name
      };

      // Search within ~500m of the reference POI
      const searchRadiusKm = 0.5;

      const candidates = await getCombinedPOIs(
        searchCenter,
        query,
        city || 'Nearby',
        searchRadiusKm,
        searchSources,
        language,
        (msg) => setLoadingText(msg)
      );

      // Filter out POIs already in the route
      const existingIds = new Set(routeData.pois.map(p => p.id || p.name));
      const uniqueCandidates = candidates.filter(p => !existingIds.has(p.id || p.name));

      // Sort by distance to reference POI
      const sortedCandidates = uniqueCandidates.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.lat - searchCenter.lat, 2) + Math.pow((a.lng || a.lon) - searchCenter.lon, 2));
        const distB = Math.sqrt(Math.pow(b.lat - searchCenter.lat, 2) + Math.pow((b.lng || b.lon) - searchCenter.lon, 2));
        return distA - distB;
      });

      // Return top 5 results with normalized coordinates
      return sortedCandidates.slice(0, 5).map(p => ({
        ...p,
        lat: typeof p.lat === 'number' && !isNaN(p.lat) ? p.lat : (typeof p.latitude === 'number' && !isNaN(p.latitude) ? p.latitude : parseFloat(p.lat || p.latitude || 0)),
        lng: typeof p.lng === 'number' && !isNaN(p.lng) ? p.lng : (typeof p.lon === 'number' && !isNaN(p.lon) ? p.lon : (typeof p.longitude === 'number' && !isNaN(p.longitude) ? p.longitude : parseFloat(p.lng || p.lon || p.longitude || 0)))
      }));
    } catch (err) {
      console.error('Stop search failed:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle selection of a stop option from the search results
   */
  const handleSelectStopOption = async (poi, afterStopIndex) => {
    if (!poi || !routeData) return;

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Stop toevoegen aan route...' : 'Adding stop to route...');

    // Normalize coordinates
    const normalizedPoi = {
      ...poi,
      lat: typeof poi.lat === 'number' && !isNaN(poi.lat) ? poi.lat : (typeof poi.latitude === 'number' && !isNaN(poi.latitude) ? poi.latitude : parseFloat(poi.lat || poi.latitude)),
      lng: typeof poi.lng === 'number' && !isNaN(poi.lng) ? poi.lng : (typeof poi.lon === 'number' && !isNaN(poi.lon) ? poi.lon : (typeof poi.longitude === 'number' && !isNaN(poi.longitude) ? poi.longitude : parseFloat(poi.lng || poi.lon || poi.longitude)))
    };

    if (isNaN(normalizedPoi.lat) || isNaN(normalizedPoi.lng)) {
      console.error('Cannot add stop: Invalid coordinates', poi);
      setIsLoading(false);
      return;
    }

    try {
      // Determine if we are adding to a purely manual route
      const isManualRoute = routeData.routeMarkers && routeData.routeMarkers.length > 0 && (routeData.pois.length === 0);

      // Insert the POI after the specified index
      let newPois;
      let spliceIndex;

      if (isManualRoute) {
        // Fallback to route markers if no POIs exist yet
        // We exclude the start point (index 0) because it's the center
        newPois = routeData.routeMarkers.slice(1).map((m, i) => ({
          ...m,
          id: m.id || `manual-${i + 1}`,
          isManualStop: true
        }));
        // afterStopIndex 0 from RouteRefiner means "After Start"
        // In our newPois array, index 0 is M1. So splice at 0 puts it after Start.
        spliceIndex = afterStopIndex;
      } else {
        newPois = [...routeData.pois];
        spliceIndex = afterStopIndex + 1;
      }

      newPois.splice(spliceIndex, 0, {
        ...normalizedPoi,
        id: normalizedPoi.id || `stop-${Date.now()}`,
        isExtraStop: true,
        type: normalizedPoi.type || (normalizedPoi.category || 'Café')
      });

      // Recalculate the route with the new POI list
      const cityCenter = routeData.center;
      const routeResult = await calculateRoutePath(newPois, cityCenter, travelMode, routeData.stopCenter, isRoundtrip, isRouteEditMode);

      // Update route data with new POI list and recalculated route
      setRouteData(prev => ({
        ...prev,
        pois: newPois,
        originalPois: newPois,
        routeMarkers: isManualRoute ? [] : (prev.routeMarkers || []),
        routePath: routeResult?.path || prev.routePath,
        navigationSteps: routeResult?.steps || prev.navigationSteps,
        legs: routeResult?.legs || prev.legs,
        stats: {
          ...prev.stats,
          totalDistance: routeResult?.dist || 0,
          walkDistance: routeResult?.walkDist || 0
        }
      }));

      // TRIGGER ENRICHMENT FOR NEW POIS
      const cityName = validatedCityData?.name || city;
      enrichBackground(newPois, cityName, language, descriptionLength, interests, "Added Stop Enrichment");

      // Add chat message about the addition
      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: language === 'nl'
          ? `**${poi.name}** is toegevoegd aan je route na stop ${afterStopIndex + 1}. De route is herberekend!`
          : `**${poi.name}** has been added to your route after stop ${afterStopIndex + 1}. Route recalculated!`
      }]);

      // Navigate to map view to show the updated route
      setIsAiViewActive(false);
      setIsSidebarOpen(true);

    } catch (err) {
      console.error('Failed to add stop:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Search for POIs based on interest or specific place name
   * Used by RouteRefiner's inline search flow
   */
  const handleSearchPOIs = async (searchParams) => {
    const { type, query } = searchParams;
    setIsLoading(true);
    setLoadingText(language === 'nl' ? `Zoeken naar "${query}"...` : `Searching for "${query}"...`);

    if (!query || !routeData) {
      console.warn('Missing query or route data for POI search');
      return [];
    }

    try {
      // Use route center as search location
      const searchCenter = {
        lat: routeData.center[0],
        lon: routeData.center[1],
        name: city || 'Nearby'
      };

      // Determine search radius based on current constraint
      let searchRadiusKm = constraintValue;
      if (constraintType === 'duration') {
        const speed = travelMode === 'cycling' ? 15 : 5;
        searchRadiusKm = (constraintValue / 60) * speed;
      }

      const candidates = await getCombinedPOIs(
        searchCenter,
        query,
        city || 'Nearby',
        searchRadiusKm,
        searchSources,
        language,
        (msg) => setLoadingText(msg)
      );

      // Filter out POIs already in the route
      const existingIds = new Set(routeData.pois.map(p => p.id || p.name));
      const uniqueCandidates = candidates.filter(p => !existingIds.has(p.id || p.name));

      // Calculate detour for each candidate
      const activeIdx = activePoiIndex || 0;
      const withDetour = uniqueCandidates.slice(0, 8).map(cand => {
        try {
          const detourResult = smartPoiUtils.added_detour_if_inserted_after(
            { center: routeData.center, pois: routeData.pois },
            activeIdx,
            cand,
            travelMode
          );
          return { ...cand, detour_km: detourResult.added_distance_m / 1000 };
        } catch {
          return { ...cand, detour_km: 0 };
        }
      });

      // Sort by detour (smallest first)
      withDetour.sort((a, b) => (a.detour_km || 0) - (b.detour_km || 0));

      console.log(`SearchPOIs: Found ${withDetour.length} results for "${query}" (type: ${type})`);
      return withDetour.slice(0, 5);
    } catch (err) {
      console.error('POI search failed:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };



  /**
   * Enter Map Pick Mode
   */
  const handleStartMapPick = async (cityQuery, keepExisting = false) => {
    setIsMapPickMode(true);
    setIsSidebarOpen(false);
    setIsRoundtrip(true); // Manual routes are always loops per user request

    // Enable Route Edit Mode
    setIsRouteEditMode(true);
    setRouteMarkers([]);
    setSelectedEditPointIndex(-1);
    setCumulativeDistances([]);
    setIsDiscoveryTriggered(keepExisting ? isDiscoveryTriggered : false); // Only reset if NOT keeping existing route

    if (keepExisting && routeData) {
      console.log("Initializing Map Pick Mode - Keeping Existing Route");

      // Construct points list from current route or markers
      const points = [];

      // 1. Start Point
      if (routeData.startPoi) {
        points.push(routeData.startPoi);
      } else {
        // Create a point from center
        points.push({
          id: 'start-anchor',
          name: routeData.startName || (language === 'nl' ? 'Startpunt' : 'Start Point'),
          lat: routeData.center[0],
          lng: routeData.center[1],
          type: 'custom'
        });
      }

      // 2. Markers (formerly points/pois in edit mode)
      if (routeData.routeMarkers && routeData.routeMarkers.length > 0) {
        points.push(...routeData.routeMarkers);
      } else {
        // NOTE: We used to copy routeData.pois here, but that loses their identity 
        // as POIs. We now keep them separate so they remain active POIs.
      }

      setRouteMarkers(points);

      // 3. Cumulative Distances
      if (routeData.legs) {
        let total = 0;
        const dists = [0];
        routeData.legs.forEach(leg => {
          total += ((leg.distance || 0) / 1000);
          dists.push(total);
        });
        setCumulativeDistances(dists);
      } else {
        setCumulativeDistances(points.map(() => 0));
      }

      return; // SKIP RESET
    }

    console.log("Initializing Map Pick Mode - Triggering Full Reset");

    // COMPLETE RESET: Create fresh routeData object without any previous state
    // This ensures no old POIs or routes are visible
    const defaultCenter = [52.3676, 4.9041]; // Default to Amsterdam if no city
    setRouteData({
      center: defaultCenter,
      pois: [],
      startPoi: null,
      startIsPoi: false,
      startName: null,
      navigationSteps: [],
      routePath: [],
      legs: [],
      originalPois: null,
      stats: { totalDistance: 0, walkDistance: 0, limitKm: 5 }
    });

    // Clear auxiliary state
    setPoiProposals(null);
    setRefinementProposals(null);
    setLimitConfirmation(null);
    setActivePoiIndex(0);
    setNavPhase(NAV_PHASES.PRE_ROUTE);
    setFoundPoisCount(0);
    setStartPoint('');
    setStopPoint('');

    // Geocode if city is provided
    if (cityQuery && cityQuery.trim().length > 2) {
      setIsLoading(true);
      setLoadingText(language === 'nl' ? 'Kaart centreren...' : 'Centering map...');

      try {
        // Use proxy to avoid CORS
        const res = await apiFetch(`/api/nominatim?q=${encodeURIComponent(cityQuery)}&format=json&limit=1`);
        const data = await res.json();
        console.log("[MapPick] Geocoding response for", cityQuery, ":", data);
        if (data && data[0]) {
          const newCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          console.log("[MapPick] Setting new center to:", newCenter);
          // Update ONLY the center, keep everything else empty
          setRouteData({
            center: newCenter,
            pois: [],
            startPoi: null,
            startIsPoi: false,
            startName: null,
            navigationSteps: [],
            routePath: [],
            legs: [],
            originalPois: null,
            stats: { totalDistance: 0, walkDistance: 0, limitKm: 5 }
          });
          // Force map to fly to new center
          setFocusedLocation({ lat: newCenter[0], lng: newCenter[1] });
        } else {
          console.warn("[MapPick] No geocoding results for:", cityQuery);
        }
      } catch (e) {
        console.warn("Failed to center map on pick start:", e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Handle Click on Map in Pick Mode
   */
  const handleMapPick = async (latlng) => {
    // In route edit mode, we always keep picking active
    if (searchMode !== 'manual' && !isRouteEditMode) {
      setIsMapPickMode(false);
    }

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Locatie details ophalen...' : 'Fetching location details...');

    try {
      // 1. Reverse Geocode (use proxy to avoid CORS)
      const response = await apiFetch(`/api/nominatim?lat=${latlng.lat}&lon=${latlng.lng}&format=json&zoom=18&addressdetails=1`);
      const data = await response.json();

      const name = data.name ||
        (data.address && (data.address.amenity || data.address.shop || data.address.tourism || data.address.road)) ||
        (language === 'nl' ? 'Gekozen locatie' : 'Picked Location');

      const poi = {
        id: `pick-${Date.now()}`,
        name: name,
        lat: parseFloat(latlng.lat),
        lng: parseFloat(latlng.lng),
        type: data.type || 'custom',
        description: data.display_name,
        address: data.address
      };

      // 2. Route Edit Mode Logic - Update routeMarkers
      if (isRouteEditMode) {
        const newMarkers = [...routeMarkers, poi];
        setRouteMarkers(newMarkers);

        // Calculate cumulative distances
        if (newMarkers.length === 1) {
          // First point (start) has 0 distance
          setCumulativeDistances([0]);

          // Set as route center - use FRESH object, not spread from prev
          setRouteData({
            center: [poi.lat, poi.lng],
            pois: routeData?.pois || [], // Preserve existing POIs even if starting fresh pick
            routeMarkers: [poi], // Initialize markers in routeData
            startPoi: poi,
            startName: poi.name,
            startIsPoi: true,
            navigationSteps: [],
            routePath: [],
            legs: [],
            originalPois: null,
            stats: { totalDistance: 0, walkDistance: 0, limitKm: 5 }
          });

          // Update city if missing
          if (!city && data.address && (data.address.city || data.address.town)) {
            setCity(data.address.city || data.address.town);
          }
        } else {
          // Calculate route to this point
          const startCoords = [newMarkers[0].lat, newMarkers[0].lng];
          const activeMode = travelMode || 'walking';

          try {
            // Calculate full route through all markers (except we don't close the loop yet)
            const routeResult = await calculateRoutePath(
              newMarkers.slice(1),
              startCoords,
              activeMode,
              null,
              isRoundtrip,
              isRouteEditMode
            );

            // Calculate cumulative distances for each marker
            const newDistances = [0]; // Start is 0
            let cumulative = 0;

            if (routeResult.legs && routeResult.legs.length > 0) {
              routeResult.legs.forEach((leg, idx) => {
                cumulative += (leg.distance / 1000); // Convert m to km
                newDistances.push(cumulative);
              });
            } else {
              // Fallback: use total distance distributed evenly
              const distPerPoint = routeResult.dist / (newMarkers.length - 1);
              for (let i = 1; i < newMarkers.length; i++) {
                newDistances.push(distPerPoint * i);
              }
            }

            setCumulativeDistances(newDistances);

            // Update route data for visualization - markers are separate from POIs
            setRouteData(prev => ({
              ...prev,
              center: [newMarkers[0].lat, newMarkers[0].lng],
              routeMarkers: newMarkers,
              pois: prev.pois || [], // Preserve POIs while editing/adding markers
              startPoi: newMarkers[0],
              startName: newMarkers[0].name,
              startIsPoi: true,
              routePath: routeResult.path,
              navigationSteps: routeResult.steps,
              legs: routeResult.legs,
              stats: {
                totalDistance: routeResult.dist,
                walkDistance: routeResult.walkDist || routeResult.dist,
                limitKm: Math.ceil(routeResult.dist) || 5
              }
            }));

          } catch (calcErr) {
            console.error("Route calculation failed:", calcErr);
            // Still add the point, just estimate distance
            const lastPoint = newMarkers[newMarkers.length - 2];
            const dist = smartPoiUtils.getDistance(lastPoint.lat, lastPoint.lng, poi.lat, poi.lng);
            const lastDist = cumulativeDistances[cumulativeDistances.length - 1] || 0;
            setCumulativeDistances([...cumulativeDistances, lastDist + dist]);

            setRouteData(prev => ({
              ...prev,
              routeMarkers: newMarkers,
              pois: []
            }));
          }
        }

        setIsLoading(false);
        return; // Exit early for route edit mode
      }

      // 3. Legacy mode: Add to Route Logic (for non-edit mode)
      if (!routeData || (!routeData.startPoi && (!routeData.pois || routeData.pois.length === 0))) {
        console.log("Map Pick: Starting new route with", poi.name);
        setRouteData({
          center: [poi.lat, poi.lng],
          startPoi: poi,
          startPoiId: poi.id,
          startName: poi.name,
          startIsPoi: true,
          pois: [],
          navigationSteps: [],
          routePath: [],
          legs: [],
          stats: { totalDistance: 0, walkDistance: 0, limitKm: 5 }
        });

        if (!city && data.address && (data.address.city || data.address.town)) {
          setCity(data.address.city || data.address.town);
        }

        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl'
            ? `Route gestart bij **${poi.name}**. Kies nu je volgende punt.`
            : `Route started at **${poi.name}**. Now pick your next stop.`
        }]);

      } else {
        const currentPois = [...(routeData.pois || [])];
        currentPois.push(poi);

        const startCoords = routeData.center;
        const stopCoords = routeData.stopCenter; // respect the destination if one exists
        const activeMode = travelMode || 'walking';

        try {
          // Trigger recalculation with the new point added to the end
          const routeResult = await calculateRoutePath(currentPois, startCoords, activeMode, stopCoords, isRoundtrip, isRouteEditMode);

          setRouteData(prev => ({
            ...prev,
            pois: currentPois,
            routePath: routeResult?.path || prev.routePath,
            navigationSteps: routeResult?.steps || prev.navigationSteps,
            legs: routeResult?.legs || prev.legs,
            stats: {
              ...prev.stats,
              totalDistance: routeResult?.dist || 0,
              walkDistance: routeResult?.walkDist || prev.stats.walkDistance
            }
          }));

          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? `**${poi.name}** toegevoegd (+${(routeResult?.dist || 0).toFixed(1)} km).`
              : `**${poi.name}** added (+${(routeResult?.dist || 0).toFixed(1)} km).`
          }]);

        } catch (calcErr) {
          console.error("Route calculation failed:", calcErr);
          // Still add the point even if path calculation fails temporarily (straight lines fallback handles it in calculateRoutePath)
          setRouteData(prev => ({
            ...prev,
            pois: currentPois
          }));
        }
      }

    } catch (err) {
      console.error("Map pick failed:", err);
      alert(language === 'nl' ? 'Kon locatie niet ophalen.' : 'Could not fetch location.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a point from route edit mode
   */
  const handleDeleteMarker = useCallback(async (index) => {
    if (index < 0 || index >= routeMarkers.length) return;

    const newMarkers = routeMarkers.filter((_, i) => i !== index);
    setRouteMarkers(newMarkers);
    setSelectedEditPointIndex(-1);

    if (newMarkers.length === 0) {
      setCumulativeDistances([]);
      setRouteData(prev => ({
        ...prev,
        pois: [],
        routeMarkers: [],
        routePath: [],
        stats: { ...prev.stats, totalDistance: 0 }
      }));
      return;
    }

    if (newMarkers.length >= 2) {
      const startCoords = [newMarkers[0].lat, newMarkers[0].lng];
      const activeMode = travelMode || 'walking';

      try {
        setIsLoading(true);
        setLoadingText(language === 'nl' ? 'Route herberekenen...' : 'Recalculating route...');

        const routeResult = await calculateRoutePath(
          newMarkers.slice(1),
          startCoords,
          activeMode,
          routeData?.stopCenter,
          isRoundtrip,
          isRouteEditMode
        );

        const newDistances = [0];
        let cumulative = 0;
        if (routeResult.legs) {
          routeResult.legs.forEach((leg) => {
            cumulative += (leg.distance / 1000);
            newDistances.push(cumulative);
          });
        }
        setCumulativeDistances(newDistances);

        setRouteData(prev => ({
          ...prev,
          center: [newMarkers[0].lat, newMarkers[0].lng],
          routeMarkers: newMarkers,
          pois: [],
          routePath: routeResult?.path || [],
          legs: routeResult?.legs || [],
          stats: { ...prev.stats, totalDistance: routeResult?.dist || 0 }
        }));

      } catch (err) {
        console.error("Route recalculation failed:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setCumulativeDistances([0]);
      setRouteData(prev => ({
        ...prev,
        center: [newMarkers[0].lat, newMarkers[0].lng],
        routeMarkers: newMarkers,
        pois: [],
        routePath: [],
        stats: { ...prev.stats, totalDistance: 0 }
      }));
    }
  }, [routeMarkers, travelMode, routeData, isRoundtrip, isRouteEditMode, language, setRouteMarkers, setCumulativeDistances, setRouteData, setIsLoading, setLoadingText, setSelectedEditPointIndex, calculateRoutePath]);

  /**
   * Move a point and recalculate route
   */
  const handleMoveMarker = useCallback(async (index, newLatLng) => {
    if (index < 0 || index >= routeMarkers.length) return;

    const newMarkers = [...routeMarkers];
    newMarkers[index] = { ...newMarkers[index], lat: newLatLng.lat, lng: newLatLng.lng };
    setRouteMarkers(newMarkers);

    if (newMarkers.length >= 1) {
      const startCoords = [newMarkers[0].lat, newMarkers[0].lng];
      const activeMode = travelMode || 'walking';

      try {
        if (newMarkers.length >= 2) {
          setIsLoading(true);
          setLoadingText(language === 'nl' ? 'Route bijwerken...' : 'Updating route...');

          const routeResult = await calculateRoutePath(
            newMarkers.slice(1),
            startCoords,
            activeMode,
            routeData?.stopCenter,
            isRoundtrip,
            isRouteEditMode
          );

          const newDistances = [0];
          let cumulative = 0;
          if (routeResult.legs) {
            routeResult.legs.forEach((leg) => {
              cumulative += (leg.distance / 1000);
              newDistances.push(cumulative);
            });
          }
          setCumulativeDistances(newDistances);

          setRouteData(prev => ({
            ...prev,
            center: startCoords,
            routeMarkers: newMarkers,
            routePath: routeResult?.path || [],
            legs: routeResult?.legs || [],
            stats: { ...prev.stats, totalDistance: routeResult?.dist || 0 }
          }));
        } else {
          setCumulativeDistances([0]);
          setRouteData(prev => ({
            ...prev,
            center: startCoords,
            routeMarkers: newMarkers,
            routePath: [],
            stats: { ...prev.stats, totalDistance: 0 }
          }));
        }

      } catch (err) {
        console.error("Route move failed:", err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [routeMarkers, travelMode, routeData, isRoundtrip, isRouteEditMode, language, setRouteMarkers, setCumulativeDistances, setRouteData, setIsLoading, setLoadingText, calculateRoutePath]);

  /**
   * Finalize route - close the loop and exit edit mode
   */
  const handleFinalizeRoute = useCallback(async () => {
    if (routeMarkers.length < 2) {
      alert(language === 'nl' ? 'Voeg minimaal 2 punten toe.' : 'Add at least 2 points.');
      return;
    }

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Route afronden...' : 'Finalizing route...');

    try {
      const startCoords = [routeMarkers[0].lat, routeMarkers[0].lng];
      const activeMode = travelMode || 'walking';

      const routeResult = await calculateRoutePath(
        routeMarkers.slice(1),
        startCoords,
        activeMode,
        startCoords,
        isRoundtrip,
        isRouteEditMode
      );

      setRouteData(prev => ({
        ...prev,
        center: startCoords,
        startPoi: routeMarkers[0],
        startName: routeMarkers[0].name,
        startIsPoi: true,
        routeMarkers: [...routeMarkers],
        pois: prev.pois || [],
        routePath: routeResult?.path || prev.routePath,
        navigationSteps: routeResult?.steps || prev.navigationSteps,
        legs: routeResult?.legs || prev.legs,
        stats: {
          totalDistance: routeResult?.dist || 0,
          walkDistance: routeResult?.walkDist || routeResult?.dist || 0,
          limitKm: Math.ceil(routeResult?.dist || 0)
        }
      }));

      setIsRoundtrip(true);
      setIsRouteEditMode(false);
      setIsMapPickMode(false);
      setRouteMarkers([]);
      setCumulativeDistances([]);
      setSelectedEditPointIndex(-1);
      setIsSidebarOpen(true);
      setViewAction(null);
      setIsAiViewActive(false);

      const finalizeMsg = language === 'nl'
        ? `🎉 Route afgerond! Totale afstand: **${routeResult.dist.toFixed(1)} km** met ${routeMarkers.length} stops.\n\nZal ik op zoek gaan naar interessante plekjes langs deze route? Klik op de **"Nu ontdekken"** knop in de zijbalk!`
        : `🎉 Route finalized! Total distance: **${routeResult.dist.toFixed(1)} km** with ${routeMarkers.length} stops.\n\nShould I find interesting spots along this route? Click the **"Discover now"** button in the sidebar!`;

      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: finalizeMsg
      }]);

      if (autoAudio) {
        handleSpeak(language === 'nl'
          ? "Route afgerond! Zal ik op zoek gaan naar interessante plekjes langs deze route? Klik op de knop Nu ontdekken."
          : "Route finalized! Should I find interesting spots along this route? Click the Discover now button.",
          'finalize-ask'
        );
      }

      setRefinementProposals(null);

    } catch (err) {
      console.error("Route finalization failed:", err);
      alert(language === 'nl' ? 'Kon route niet afronden.' : 'Could not finalize route.');
    } finally {
      setIsLoading(false);
    }
  }, [routeMarkers, language, travelMode, isRoundtrip, isRouteEditMode, autoAudio, setIsLoading, setLoadingText, setRouteData, setIsRoundtrip, setIsRouteEditMode, setIsMapPickMode, setRouteMarkers, setCumulativeDistances, setSelectedEditPointIndex, setIsSidebarOpen, setViewAction, setIsAiViewActive, setAiChatHistory, handleSpeak, calculateRoutePath]);

  const handleFindPoisAlongRoute = useCallback(async (customInterests = null) => {
    if (!routeData || !routeData.routePath || routeData.routePath.length === 0) {
      alert(language === 'nl' ? 'Plan eerst een route.' : 'Plan a route first.');
      return;
    }

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Plekken ontdekken...' : 'Discovering places...');

    try {
      const { getCombinedPOIs } = await import('./utils/poiService');
      const interestLine = customInterests || interests || 'top sights, landmark, museum, park';
      const radiusKm = 10;
      const sources = searchSources;

      const rawDiscoveredPois = await getCombinedPOIs(
        validatedCityData || { name: city },
        interestLine,
        city,
        radiusKm,
        sources,
        language,
        (msg) => setLoadingText(msg)
      );

      const discoveredPois = rawDiscoveredPois.filter(poi =>
        isLocationOnPath({ lat: poi.lat, lng: poi.lng }, routeData.routePath, 0.1)
      );

      if (!discoveredPois || discoveredPois.length === 0) {
        alert(language === 'nl' ? 'Geen nieuwe plekken gevonden langs deze route.' : 'No new places found along this route.');
      } else {
        const routeCtx = `Discovery along route in ${city}`;

        setRouteData(prev => ({
          ...prev,
          pois: discoveredPois
        }));

        setIsDiscoveryTriggered(true);

        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl'
            ? `✨ Ik heb **${discoveredPois.length}** interessante plekken gevonden langs je route!`
            : `✨ I found **${discoveredPois.length}** interesting stops along your route!`
        }]);

        enrichBackground(discoveredPois, city, language, descriptionLength, interestLine, routeCtx)
          .catch(err => console.warn("Discovery enrichment failed", err));
      }
    } catch (err) {
      console.error("Discovery failed:", err);
      alert(language === 'nl' ? 'Fout bij het zoeken naar plekken.' : 'Error searching for places.');
    } finally {
      setIsLoading(false);
    }
  }, [routeData, language, interests, searchSources, validatedCityData, city, descriptionLength, setIsLoading, setLoadingText, setRouteData, setIsDiscoveryTriggered, setAiChatHistory, enrichBackground]);

  const handleOpenArMode = useCallback(() => setIsArMode(true), [setIsArMode]);
  const handleArClose = useCallback(() => setIsArMode(false), [setIsArMode]);
  const handleNavigationClose = useCallback(() => setIsNavigationOpen(false), [setIsNavigationOpen]);
  const handleCancelRefinement = useCallback(() => setRefinementProposals(null), [setRefinementProposals]);
  const handleSetScanResultNull = useCallback(() => setScanResult(null), [setScanResult]);

  /**
   * Cancel route edit mode
   */
  const handleCancelEditMode = useCallback(() => {
    // If we have a valid route (POIs or Path), effectively "Cancel" just means exit edit mode
    // but KEEP the route so we return to RouteRefiner view.
    const hasExistingRoute = routeData && (
      (routeData.pois && routeData.pois.length > 0) ||
      (routeData.routePath && routeData.routePath.length > 0)
    );

    setIsRouteEditMode(false);
    setIsMapPickMode(false);
    setRouteMarkers([]);
    setCumulativeDistances([]);
    setSelectedEditPointIndex(-1);
    setIsSidebarOpen(true);

    // Only wipe route data if we didn't have a valid route to begin with
    // (e.g. we started "Pick on Map" from scratch and cancelled)
    if (!hasExistingRoute) {
      setRouteData(null);
    }
  }, [setIsRouteEditMode, setIsMapPickMode, setRouteMarkers, setCumulativeDistances, setSelectedEditPointIndex, setIsSidebarOpen, setRouteData, routeData]);

  const handleToggleNavigation = useCallback(() => setIsNavigationOpen(prev => !prev), [setIsNavigationOpen]);
  const handlePopupClose = useCallback(() => { setFocusedLocation(null); stopSpeech(); }, [setFocusedLocation, stopSpeech]);
  const handleOpenAiChat = useCallback(() => {
    setIsAiViewActive(true);
    setIsSidebarOpen(true);
  }, [setIsAiViewActive, setIsSidebarOpen]);
  const handleEditPointClick = useCallback((idx) => setSelectedEditPointIndex(idx), [setSelectedEditPointIndex]);
  const handleSkipDiscovery = useCallback(() => {
    setIsDiscoveryTriggered(true);
    setIsSidebarOpen(false);
    setIsNavigationOpen(false);
    setNavPhase(NAV_PHASES.ACTIVE_ROUTE);
  }, [setIsDiscoveryTriggered, setIsSidebarOpen, setIsNavigationOpen, setNavPhase]);

  const handleConfirmLimitCancel = useCallback(() => handleConfirmLimit(false), [handleConfirmLimit]);
  const handleConfirmLimitProceed = useCallback(() => handleConfirmLimit(true), [handleConfirmLimit]);
  const handleCancelPendingRefinement = useCallback(() => setPendingDistanceRefinement(null), [setPendingDistanceRefinement]);
  const handleExecutePendingRefinement = useCallback(() => handleExecuteDistanceRefinement(pendingDistanceRefinement), [pendingDistanceRefinement, handleExecuteDistanceRefinement]);
  const handleCitySelectorFadeOut = useCallback(() => {
    if (interests && interests.trim().length > 0) {
      setIsLoading(true);
    }
  }, [interests, setIsLoading]);
  const handleCitySelection = useCallback(async (selectedCity) => {
    setCity(selectedCity);
    setShowCitySelector(false);
    const hasInterests = interests && interests.trim().length > 0;
    if (hasInterests) {
      setIsLoading(true);
      setLoadingText(language === 'nl' ? 'Bestemming verifiëren...' : 'Verifying destination...');
      try {
        await handleCityValidation('submit', selectedCity, interests);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsSidebarOpen(true);
      setShouldAutoFocusInterests(true);
    }
  }, [interests, language, setCity, setShowCitySelector, handleCityValidation, setIsLoading, setLoadingText, setIsSidebarOpen, setShouldAutoFocusInterests]);

  // Auth Guards removed (Auth disabled)


  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white relative transition-all duration-500"
      style={{
        boxShadow: isSimulating ? `inset 0 0 0 4px ${APP_THEMES[activeTheme]?.colors?.accent || '#60a5fa'}` : 'none'
      }}
    >
      {/* Journey Input Overlay */}

      {/* Background Update Indicator */}
      {isBackgroundUpdating && (
        <div className="absolute top-0 left-0 right-0 z-[2000] h-1 bg-slate-800 w-full overflow-hidden">
          <div className="h-full bg-blue-500 animate-[progress-indeterminate_1.5s_infinite_linear] origin-left w-full"></div>
          <div className="absolute top-2 right-4 bg-slate-900/80 backdrop-blur text-xs px-3 py-1 rounded-full border border-blue-500/30 text-blue-200 shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            {language === 'nl' ? 'Info bijwerken...' : 'Updating info...'}
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full w-full bg-slate-900 text-white">Loading Map...</div>}>
          <MapLibreContainer
            routeData={routeData}
            searchMode={searchMode}
            focusedLocation={focusedLocation}
            userLocation={userLocation}
            setUserLocation={setUserLocation}
            language={language}
            onPoiClick={handlePoiClick}
            onPopupClose={handlePopupClose}
            activePoiIndex={activePoiIndex}
            setActivePoiIndex={setActivePoiIndex}
            pastDistance={pastDistance}
            speakingId={speakingId}
            isSpeechPaused={isSpeechPaused}
            onSpeak={handleSpeak}
            onStopSpeech={stopSpeech}
            voiceSettings={voiceSettings}
            availableVoices={availableVoices}
            spokenCharCount={spokenCharCount}
            isLoading={isLoading}
            loadingText={loadingText}
            loadingCount={foundPoisCount}
            onUpdatePoiDescription={handleUpdatePoiDescription}
            onNavigationRouteFetched={handleNavigationRouteFetched}
            onToggleNavigation={handleToggleNavigation}
            autoAudio={autoAudio}
            setAutoAudio={setAutoAudio}
            spokenNavigationEnabled={spokenNavigationEnabled}
            setSpokenNavigationEnabled={setSpokenNavigationEnabled}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            isSimulationEnabled={isSimulationEnabled}
            userSelectedStyle={travelMode}
            onStyleChange={setTravelMode}
            isAiViewActive={isAiViewActive}
            onOpenAiChat={handleOpenAiChat}
            viewAction={viewAction}
            setViewAction={setViewAction}
            navPhase={navPhase}
            setNavPhase={setNavPhase}
            routeStart={routeData?.center}
            isMapPickMode={isMapPickMode}
            onMapPick={handleMapPick}
            isRouteEditMode={isRouteEditMode}
            routeMarkers={routeMarkers}
            cumulativeDistances={cumulativeDistances}
            selectedEditPointIndex={selectedEditPointIndex}
            onEditPointClick={handleEditPointClick}
            onDeletePoint={handleDeleteMarker}
            onMovePoint={handleMoveMarker}
            onOpenArMode={handleOpenArMode}
          />
        </Suspense>

        {/* Route Edit Panel - shown during route edit mode */}
        {isRouteEditMode && (
          <RouteEditPanel
            points={routeMarkers}
            cumulativeDistances={cumulativeDistances}
            totalDistance={routeData?.stats?.totalDistance || 0}
            travelMode={travelMode}
            language={language}
            onDeletePoint={handleDeleteMarker}
            onFinalize={handleFinalizeRoute}
            onCancel={handleCancelEditMode}
            onPointClick={(idx) => setSelectedEditPointIndex(idx)}
            selectedPointIndex={selectedEditPointIndex}
            isCalculating={isLoading}
          />
        )}
      </div>

      {/* Navigation Overlay (Turn-by-Turn) - Only visible when NOT editing route */}
      {!isRouteEditMode && (
        <NavigationOverlay
          steps={routeData?.navigationSteps}
          pois={routeData?.pois}
          language={language}
          userLocation={userLocation}
          isOpen={isNavigationOpen}
          onClose={handleNavigationClose}
          onToggle={handleToggleNavigation}
          pastDistance={pastDistance}
          totalTripDistance={routeData?.stats?.totalDistance}
          navPhase={navPhase}
          routeStart={routeData?.center}
        />
      )}

      {/* Sidebar (Always Visible) */}
      <ItinerarySidebar
        routeData={routeData}
        onPoiClick={handlePoiClick}
        onRemovePoi={handleRemovePoi}
        onStopsCountChange={handleStopsCountChange}
        activePoiIndex={activePoiIndex}
        userLocation={userLocation}
        onUpdateStartLocation={handleUpdateStartLocation}
        onCycleStart={handleCycleStart}
        onReverseDirection={handleReverseDirection}
        onReset={resetSearch}
        language={language}
        setLanguage={setLanguage} // Add setter for sidebar toggle
        setViewAction={setViewAction}

        voiceSettings={voiceSettings}
        setVoiceSettings={setVoiceSettings}

        speakingId={speakingId}
        isSpeechPaused={isSpeechPaused}
        spokenCharCount={spokenCharCount}
        onSpeak={handleSpeak}
        onStopSpeech={stopSpeech}
        autoAudio={autoAudio}
        setAutoAudio={setAutoAudio}
        spokenNavigationEnabled={spokenNavigationEnabled}
        setSpokenNavigationEnabled={setSpokenNavigationEnabled}
        focusedLocation={focusedLocation}

        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        isSimulationEnabled={isSimulationEnabled}
        setIsSimulationEnabled={setIsSimulationEnabled}

        // Form Props
        city={city} setCity={handleSetCity}
        interests={interests} setInterests={setInterests}
        constraintType={constraintType} setConstraintType={setConstraintType}
        constraintValue={constraintValue} onConstraintValueChange={setConstraintValue}
        onConstraintValueFinal={handleConstraintValueFinal}
        isRoundtrip={isRoundtrip} setIsRoundtrip={setIsRoundtrip}
        startPoint={startPoint} setStartPoint={setStartPoint}
        stopPoint={stopPoint} setStopPoint={setStopPoint}
        searchSources={searchSources} setSearchSources={setSearchSources}
        aiProvider={aiProvider} setAiProvider={setAiProvider}
        searchProvider={searchProvider} setSearchProvider={setSearchProvider}
        onJourneyStart={handleJourneyStart}
        onAddToJourney={handleAddToJourney}
        onSearchStopOptions={handleSearchStopOptions}
        onSearchPOIs={handleSearchPOIs}
        onSelectStopOption={handleSelectStopOption}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        loadingText={loadingText}
        setLoadingText={setLoadingText}
        onCityValidation={handleCityValidation}
        disambiguationOptions={disambiguationOptions}
        onDisambiguationSelect={handleDisambiguationSelect}
        onDisambiguationCancel={handleDisambiguationCancel}
        onUseCurrentLocation={handleUseCurrentLocation}
        searchMode={searchMode}
        setSearchMode={setSearchMode}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onUpdatePoiDescription={handleUpdatePoiDescription}
        descriptionLength={descriptionLength}
        setDescriptionLength={setDescriptionLength}

        activeTheme={activeTheme}
        setActiveTheme={setActiveTheme}
        availableThemes={APP_THEMES}
        onSave={handleSaveRoute}
        onSaveAs={handleSaveRouteAsJSON}
        isAiViewActive={isAiViewActive}
        setIsAiViewActive={setIsAiViewActive}
        onLoad={handleLoadRoute}
        travelMode={travelMode}
        onStyleChange={setTravelMode}
        onPopupClose={handlePopupClose}

        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiChatHistory={aiChatHistory}
        onStartMapPick={handleStartMapPick}
        isRouteEditMode={isRouteEditMode}
        isEnriching={isBackgroundUpdating}
        onEnrichSinglePoi={handleEnrichSinglePoi}
        onStartEnrichment={handleTriggerEnrichment}
        onPauseEnrichment={handlePauseEnrichment}
        onFindPoisAlongRoute={handleFindPoisAlongRoute}
        onSkipDiscovery={handleSkipDiscovery}
        isDiscoveryTriggered={isDiscoveryTriggered}
        autoSave={autoSave}
        setAutoSave={setAutoSave}
        confidenceThreshold={confidenceThreshold}
        setConfidenceThreshold={setConfidenceThreshold}
        version={APP_VERSION}
        author={APP_AUTHOR}
        lastUpdated={APP_LAST_UPDATED}
        shouldAutoFocusInterests={shouldAutoFocusInterests}
        setShouldAutoFocusInterests={setShouldAutoFocusInterests}
      />

      {/* Map Pick Instruction Overlay - REMOVED per user request */}

      {/* Refinement Modal */}
      <RefinementModal
        proposals={refinementProposals}
        interests={interests}
        onSelect={handleSuggestionSelect}
        onCancel={handleCancelRefinement}
        language={language}
      />

      {/* Limit Confirmation Modal - Moved Outside */}
      <LimitConfirmationModal
        confirmation={limitConfirmation}
        onCancel={handleConfirmLimitCancel}
        onProceed={handleConfirmLimitProceed}
        language={language}
      />



      {/* Spot Selection Proposal */}
      <PoiProposalModal
        isOpen={!!poiProposals}
        onClose={handleCancelProposal}
        proposals={poiProposals?.candidates}
        onSelect={handleSelectProposal}
        language={language}
        primaryColor={APP_THEMES[activeTheme]?.colors?.primary}
      />

      {/* Distance Refinement Confirmation */}
      <DistanceRefineConfirmation
        isOpen={!!pendingDistanceRefinement}
        onClose={handleCancelPendingRefinement}
        onConfirm={handleExecutePendingRefinement}
        currentStats={routeData?.stats}
        currentPoisCount={routeData?.pois?.length}
        newTargetValue={pendingDistanceRefinement}
        constraintType={constraintType}
        language={language}
        primaryColor={APP_THEMES[activeTheme]?.colors?.primary}
      />

      {/* City Picker Overlay */}
      {showCitySelector && (
        <CitySelector
          onStartFadeOut={handleCitySelectorFadeOut}
          onCitySelect={handleCitySelection}
        />
      )}

      {/* AR View Overlay */}
      {isArMode && (
        <Suspense fallback={<div className="fixed inset-0 z-[2000] bg-black text-white flex items-center justify-center">Initializing AR...</div>}>
          <ArView
            onScan={handleArScan}
            onClose={handleArClose}
            language={language}
            pois={routeData?.pois || []}
            userLocation={userLocation}
            isSimulating={isSimulating}
          />
        </Suspense>
      )}

      {/* Scan Result Modal */}
      <ScanResultModal
        result={scanResult}
        onClose={handleSetScanResultNull}
        language={language}
      />

    </div>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <CityExplorerApp />
    </AuthProvider>
  );
}

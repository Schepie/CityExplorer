import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PoiIntelligence } from './services/PoiIntelligence';
import MapContainer from './components/MapContainer';
import ItinerarySidebar from './components/ItinerarySidebar';
import CitySelector from './components/CitySelector';
import './index.css'; // Ensure styles are loaded
import { getCombinedPOIs, fetchGenericSuggestions, getInterestSuggestions, setAuthToken } from './utils/poiService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginModal from './components/auth/LoginModal';
import * as smartPoiUtils from './utils/smartPoiUtils';
import { rotateCycle, reverseCycle } from './utils/routeUtils';

// Theme Definitions
// Theme Definitions
// Consolidated App Themes
const APP_THEMES = {
  tech: {
    id: 'tech',
    label: { en: 'Tech', nl: 'Tech' },
    colors: { primary: '#6366f1', hover: '#4f46e5', accent: '#f472b6', bgStart: '#0f172a', bgEnd: '#1e293b' } // Indigo + Slate
  },
  nature: {
    id: 'nature',
    label: { en: 'Nature', nl: 'Natuur' },
    colors: { primary: '#10b981', hover: '#059669', accent: '#3b82f6', bgStart: '#022c22', bgEnd: '#064e3b' } // Emerald + Forest
  },
  urban: {
    id: 'urban',
    label: { en: 'Urban', nl: 'Stads' },
    colors: { primary: '#06b6d4', hover: '#0891b2', accent: '#f59e0b', bgStart: '#083344', bgEnd: '#164e63' } // Cyan + Ocean
  },
  sunset: {
    id: 'sunset',
    label: { en: 'Sunset', nl: 'Zonsondergang' },
    colors: { primary: '#f43f5e', hover: '#e11d48', accent: '#a855f7', bgStart: '#4c0519', bgEnd: '#881337' } // Rose + Wine
  },
  warmth: {
    id: 'warmth',
    label: { en: 'Warmth', nl: 'Warmte' },
    colors: { primary: '#f59e0b', hover: '#d97706', accent: '#06b6d4', bgStart: '#451a03', bgEnd: '#78350f' } // Amber + Coffee
  }
};

// Navigation Phases for strict tracking
export const NAV_PHASES = {
  PRE_ROUTE: 'PRE_ROUTE',   // Heading to the start point
  IN_ROUTE: 'IN_ROUTE',     // On the generated path
  COMPLETED: 'COMPLETED'    // Finished the loop
};



import NavigationOverlay from './components/NavigationOverlay';

function CityExplorerApp() {
  const { user, sessionToken, verifyMagicLink, isLoading: authLoading, isBlocked } = useAuth();

  useEffect(() => {
    // Magic Link Verification
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      verifyMagicLink(token).then(status => {
        if (status === true) window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, []);

  useEffect(() => {
    setAuthToken(sessionToken);
  }, [sessionToken]);

  const [routeData, setRouteData] = useState(null);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false); // Navigation UI State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Exploring...');
  const [foundPoisCount, setFoundPoisCount] = useState(0);
  const [spokenCharCount, setSpokenCharCount] = useState(0);

  // Settings: Load from LocalStorage or Default
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'nl');
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('app_theme') || 'tech');
  const [descriptionLength, setDescriptionLength] = useState('short'); // short, medium, max

  // Persist Settings
  useEffect(() => localStorage.setItem('app_language', language), [language]);
  useEffect(() => localStorage.setItem('app_theme', activeTheme), [activeTheme]);
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(() => localStorage.getItem('app_simulation_enabled') === 'true');

  // Persist Simulation Setting
  useEffect(() => localStorage.setItem('app_simulation_enabled', isSimulationEnabled), [isSimulationEnabled]);

  // Apply Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    const theme = APP_THEMES[activeTheme];

    if (theme && theme.colors) {
      const c = theme.colors;
      root.style.setProperty('--primary', c.primary);
      root.style.setProperty('--primary-hover', c.hover);
      root.style.setProperty('--accent', c.accent);
      root.style.setProperty('--bg-gradient-start', c.bgStart);
      root.style.setProperty('--bg-gradient-end', c.bgEnd);

      // Update button text color (default to white if undefined)
      root.style.setProperty('--btn-text-color', c.btnText || 'white');

      // Update global text colors (default to light values if undefined)
      root.style.setProperty('--text-main', c.textMain || '#f8fafc');
      root.style.setProperty('--text-muted', c.textMuted || '#94a3b8');


    }
  }, [activeTheme]);



  // Focused Location (for "Fly To" interaction)
  const [focusedLocation, setFocusedLocation] = useState(null);

  // Lifted User Location (shared between Map and NavigationOverlay)
  const [userLocation, setUserLocation] = useState(null);
  const [activePoiIndex, setActivePoiIndex] = useState(0);

  // Form State (Lifted from JourneyInput)
  const [city, setCity] = useState('');
  const [validatedCityData, setValidatedCityData] = useState(null); // Store resolved city data
  const [interests, setInterests] = useState('');
  const [constraintType, setConstraintType] = useState('distance');
  const [constraintValue, setConstraintValue] = useState(5);
  const isRoundtrip = true;
  const [startPoint, setStartPoint] = useState('');
  // Default to Google only as requested
  const [searchMode, setSearchMode] = useState('prompt'); // 'radius', 'journey', or 'prompt'
  const [searchSources, setSearchSources] = useState({ osm: false, foursquare: false, google: true });
  const [travelMode, setTravelMode] = useState('walking'); // 'walking' or 'cycling'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState([
    {
      role: 'brain', text: language === 'nl'
        ? 'Hoi! Ik ben je gids van CityExplorer. Om je ideale route te plannen, heb ik wat info nodig:\n\n1. Welke **stad** wil je verkennen?\n2. Ga je **wandelen** of **fietsen**?\n3. Hoe **lang** (min) of hoe **ver** (km) wil je gaan?\n4. Wat zijn je **interesses**? (Indien leeg, toon ik je de belangrijkste bezienswaardigheden).'
        : 'Hi! I am your guide from CityExplorer. To plan your perfect route, I need a few details:\n\n1. Which **city** do you want to explore?\n2. Will you be **walking** or **cycling**?\n3. How **long** (min) or how **far** (km) would you like to go?\n4. What are your **interests**? (If left empty, I will show you the main tourist highlights).'
    }
  ]);
  const [isAiViewActive, setIsAiViewActive] = useState(true);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // View Action state (Lifted from MapContainer to coordinate with Sidebar)
  const [viewAction, setViewAction] = useState(null);

  // Navigation Phase State (Strict progress tracking)
  const [navPhase, setNavPhase] = useState(NAV_PHASES.PRE_ROUTE);

  // Re-enrich POIs when Description Length changes
  useEffect(() => {
    if (routeData && routeData.pois && routeData.pois.length > 0) {
      console.log("Description length changed to:", descriptionLength);

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

  // Calculate Past Legs Distance (for Total Done)
  // Sum distance of all legs BEFORE the current activePoiIndex
  // Note: This is an estimation using straight line or pre-calculated dists from POI list.
  // Since we don't store OSRM paths for past legs, we use haversine between POIs.
  const pastDistance = useMemo(() => {
    if (!routeData || !routeData.pois || navPhase === NAV_PHASES.PRE_ROUTE || activePoiIndex === 0) return 0;

    let total = 0;
    // Helper to calc dist
    const calcD = (p1, p2) => {
      const R = 6371;
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // 1. Distance from Start -> POI 0 (Approximation: Use User Location if available, else omit or assume close)
    // Actually better to start from POI 0 -> POI 1 etc.
    // If activePoiIndex is 0, we are at start.
    // If activePoiIndex is 1, we finished Leg 0 (Start->POI0).

    // We can't easily guess Start->POI0 distance without initial user loc stored.
    // But we can sum POI 0 -> POI 1 -> ... POI [active-1].

    for (let i = 0; i < activePoiIndex; i++) {
      // Distance from Previous (or Start) to POI[i]
      // If i=0, it's Start -> POI0. We roughly approximate this or ignore.
      // Let's assume the user was near the first POI or use the first leg distance if routeData has it?
      // routeData.navigationSteps is only current.

      // BETTER: Sum distance between POI[i] and POI[i+1].
      // If we are at POI 2 (index 2), we completed POI0->POI1 + POI1->POI2? No.
      // activePoiIndex = target index.
      // If activePoiIndex=0, target is POI0. Done=0.
      // If activePoiIndex=1, target is POI1. We completed Start->POI0.
      // If activePoiIndex=2, target is POI2. We completed Start->POI0 + POI0->POI1.

      if (i === 0) {
        // Start->POI0. Hard to know. Let's assume a small value or 0 if unknown.
        // OR: If we have routeData.pois[0].distFromCurr (calculated at search time), use that!
        if (routeData.pois[0].distFromCurr) total += routeData.pois[0].distFromCurr;
      } else {
        // POI[i-1] -> POI[i]
        const p1 = routeData.pois[i - 1];
        const p2 = routeData.pois[i];
        // Add 30% buffer for walking routes
        total += calcD({ lat: p1.lat, lng: p1.lng }, { lat: p2.lat, lng: p2.lng }) * 1.3;
      }
    }
    return total;
  }, [routeData, activePoiIndex]);

  // Haversine Distance Helper (km)
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Helper: Calculate Route Path & Steps
  const calculateRoutePath = async (pois, center, mode) => {
    const waypoints = [
      `${center[1]},${center[0]}`,
      ...pois.map(p => `${p.lng},${p.lat}`)
    ];
    if (isRoundtrip) waypoints.push(`${center[1]},${center[0]}`);

    try {
      const profile = mode === 'cycling' ? 'routed-bike' : 'routed-foot';
      const osrmUrl = `https://routing.openstreetmap.de/${profile}/route/v1/driving/${waypoints.join(';')}?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(osrmUrl);
      const json = await res.json();

      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const path = route.geometry.coordinates.map(c => [c[1], c[0]]);
        const dist = route.distance / 1000;
        let walkDist = 0;
        let steps = [];
        if (route.legs && route.legs.length > 1) {
          const poiLegs = isRoundtrip ? route.legs.slice(1, -1) : route.legs.slice(1);
          walkDist = poiLegs.reduce((acc, leg) => acc + leg.distance, 0) / 1000;
        }
        if (route.legs) {
          route.legs.forEach(leg => {
            if (leg.steps && leg.steps.length > 0) {
              leg.geometry = {
                type: 'LineString',
                coordinates: leg.steps.flatMap((s, idx) =>
                  idx === 0 ? s.geometry.coordinates : s.geometry.coordinates.slice(1)
                )
              };
            }
          });
          steps = route.legs.flatMap(l => l.steps);
        }
        return { path, dist, walkDist, steps, legs: route.legs };
      }
    } catch (e) {
      console.warn("Route calc failed", e);
    }

    // Fallback: Straight lines
    const pts = [center, ...pois.map(p => [p.lat, p.lng])];
    if (isRoundtrip) pts.push(center);

    // Generate fallback legs
    const fallbackLegs = pts.slice(0, -1).map((p, i) => {
      const next = pts[i + 1];
      return {
        distance: getDistance(p[0], p[1], next[0], next[1]) * 1000,
        duration: (getDistance(p[0], p[1], next[0], next[1]) / (mode === 'cycling' ? 15 : 5)) * 3600,
        steps: [],
        geometry: {
          type: 'LineString',
          coordinates: [[p[1], p[0]], [next[1], next[0]]]
        }
      };
    });

    // Fallback steps
    const fallbackSteps = pois.map(p => ({
      maneuver: { type: 'depart', modifier: 'straight', location: [p.lng, p.lat] },
      name: language === 'nl' ? `Ga naar ${p.name}` : `Walk to ${p.name}`,
      distance: 0
    }));
    // Calc simple dist
    let fallbackDist = 0;
    let fallbackWalkDist = 0;
    let prevPoint = { lat: center[0], lng: center[1] };
    pois.forEach((p, idx) => {
      const d = getDistance(prevPoint.lat, prevPoint.lng, p.lat, p.lng);
      fallbackDist += d;
      if (idx > 0) fallbackWalkDist += d;
      prevPoint = p;
    });
    if (isRoundtrip) {
      const last = pois[pois.length - 1];
      fallbackDist += getDistance(last.lat, last.lng, center[0], center[1]);
    }

    return {
      path: pts,
      dist: fallbackDist * 1.3,
      walkDist: fallbackWalkDist * 1.3,
      steps: fallbackSteps,
      legs: fallbackLegs
    };
  };

  // Effect: Recalculate Route when Travel Mode changes
  useEffect(() => {
    if (routeData && routeData.pois && routeData.pois.length > 0 && searchMode !== 'radius') {
      calculateRoutePath(routeData.pois, routeData.center, travelMode).then(res => {
        setRouteData(prev => ({
          ...prev,
          routePath: res.path,
          navigationSteps: res.steps,
          stats: {
            ...prev.stats,
            totalDistance: res.dist.toFixed(1),
            walkDistance: res.walkDist.toFixed(1)
          }
        }));
      });
    }
  }, [travelMode]);

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

  // Auto-Save Effect: Triggers when all POIs are fully enriched
  const lastAutoSavedKeyRef = useRef('');
  useEffect(() => {
    if (!routeData || !routeData.pois || routeData.pois.length === 0) return;

    // Check if all POIs are fully enriched (have full descriptions from Gemini/Stage 2)
    const isAllEnriched = routeData.pois.every(p => p.isFullyEnriched);
    if (!isAllEnriched) return;

    // Create a unique key to prevent multiple auto-saves for the same finished route
    const currentKey = `${city}_${routeData.pois.length}_${routeData.pois.map(p => p.id).join('_')}`;

    if (lastAutoSavedKeyRef.current !== currentKey) {
      console.log("[AutoSave] All POIs enriched. Saving route in background...");
      handleSaveRoute();
      lastAutoSavedKeyRef.current = currentKey;
    }
  }, [routeData, city]); // Re-run when data or city changes

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

        setRouteData(data.routeData);
        setFoundPoisCount(data.routeData.pois ? data.routeData.pois.length : 0);
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
  // Main Enrichment Logic (Two-Stage)
  const enrichmentAbortController = useRef(null);

  // Main Enrichment Logic (Two-Stage)
  const enrichBackground = async (pois, cityName, lang, lengthMode, userInterests = '', routeCtx = '') => {

    // 1. Abort previous unfinished runs
    if (enrichmentAbortController.current) {
      enrichmentAbortController.current.abort();
    }
    // 2. Create new controller for this run
    const controller = new AbortController();
    enrichmentAbortController.current = controller;
    const signal = controller.signal;

    setIsBackgroundUpdating(true); // START Indicator

    const engine = new PoiIntelligence({
      city: cityName,
      language: lang,
      lengthMode: lengthMode,
      interests: userInterests,
      routeContext: routeCtx
    });

    // --- NEW: STAGE 0: ENRICH START/END ---
    try {
      if (signal.aborted) return;
      const isRound = routeCtx.toLowerCase().includes('roundtrip');

      // Start Info
      const startLabel = startPoint || cityName;
      const startInstr = await engine.fetchArrivalInstructions(startLabel, cityName, lang);
      if (!signal.aborted) {
        setRouteData(prev => prev ? {
          ...prev,
          startInfo: startInstr,
          // Store specific name if user provided one
          startName: startPoint
        } : prev);
      }

      // End Info (Only if not roundtrip)
      if (!isRound && pois.length > 0) {
        const lastPoi = pois[pois.length - 1];
        const endInstr = await engine.fetchArrivalInstructions(lastPoi.name, cityName, lang);
        if (!signal.aborted && endInstr) {
          setRouteData(prev => prev ? { ...prev, endInfo: endInstr } : prev);
        }
      }
    } catch (e) {
      console.warn("Start/End Enrichment Failed:", e);
    }

    // Local cache to persist short descriptions between Stage 1 and Stage 2
    const shortDescMap = new Map();

    try {
      // --- STAGE 1: FAST FETCH (Short Description + Signals) ---
      // We do this for ALL POIs first so the user sees results quickly.
      for (const poi of pois) {
        if (signal.aborted) return; // Exit if reset
        // New: Skip if already done
        if (poi.isFullyEnriched) continue;


        try {
          // Step 1: Gather Signals (Triangulation)
          const signals = await engine.gatherSignals(poi);

          if (signal.aborted) return;

          // Step 2: Get Short Description Only
          const shortData = await engine.fetchGeminiShortDescription(poi, signals, signal);

          if (signal.aborted) return;

          // Save short description for Stage 2
          if (shortData?.short_description) {
            shortDescMap.set(poi.id, shortData.short_description);
          }

          // Update State with "Intermediate" Shell
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
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn(`Stage 1 Failed for ${poi.name}`, err);
        }
      }

      // --- STAGE 2: DEEP FETCH (Full Details) ---
      // Now iterate again to get the heavy content
      for (const poi of pois) {
        if (signal.aborted) return; // Exit if reset
        // New: Skip if already done
        if (poi.isFullyEnriched) continue;


        try {
          // Retrieve stored signals (or should we re-fetch? Stored is better)
          // But we need to access the LATEST state to get the signals back if we didn't store them externally.
          // Actually, we passed 'signals' into the state update, so let's try to get them if possible, 
          // OR just rely on the engine to handle it (but engine is stateless per POI).
          // Optimization: Let's just re-gather or pass the signals through a local map if we want to save API calls.
          // For now, let's just re-use the engine context.

          // Actually, we can't easily access the "current" state in this loop without a ref or complex logic.
          // Let's just re-gather signals (cached by browser mostly) or better:
          // Just assume we want to proceed. Providing signals again is best.
          // To do this right without complex state management, let's just re-gather. It's safe.
          const signals = await engine.gatherSignals(poi);

          if (signal.aborted) return;

          // Retrieve saved short description
          const savedShortDesc = shortDescMap.get(poi.id) || null;

          // Get Full Details
          // Note: We need the short description too, to avoid re-generating it? 
          // The prompt handles "we already have short".
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
        setIsBackgroundUpdating(false); // STOP Indicator only if we are the current runner
        enrichmentAbortController.current = null;
      }
    }
  };

  // Wrapper for city setter to invalidate validation on edit
  const handleSetCity = (val) => {
    // Wrap setCity to clear validation when user types
    if (val !== city) {
      setCity(val);
      setValidatedCityData(null);
      setStartPoint(''); // Reset start point when city changes
    }
  };

  const handleCityValidation = async (context = 'blur', queryOverride = null, interestOverride = null, paramsOverride = null) => {
    const query = queryOverride || city;
    if (!query || query.length < 2) return;

    // If already validated and input hasn't changed (data exists), skip fetch
    // Only ignore cache if we have an explicit override or new params
    if (!queryOverride && validatedCityData && !paramsOverride) {
      if (context === 'submit') {
        loadMapWithCity(validatedCityData, interestOverride, paramsOverride);
      }
      return;
    }

    try {
      // ... Nominatim logic continues ...
      // In the successful match block (around line 430), pass paramsOverride:
      // await loadMapWithCity(bestMatch, interestOverride, paramsOverride);
      let results = [];
      try {
        // 1. Try Nominatim (via Local Proxy to avoid CORS)
        const cityResponse = await fetch(`/api/nominatim?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
          headers: { 'Accept-Language': language },
          signal: AbortSignal.timeout(8000)
        });

        // Check if response is actually JSON (proxy might return HTML on 404/500)
        const contentType = cityResponse.headers.get("content-type");
        if (cityResponse.ok && contentType && contentType.includes("application/json")) {
          results = await cityResponse.json();
        } else {
          // If proxy returns HTML error page (e.g. 500), text() to debug but throw to trigger fallback
          const errText = await cityResponse.text().catch(() => "Unknown error");
          throw new Error(`Nominatim Proxy failed: ${cityResponse.status} ${errText.substring(0, 50)}`);
        }
      } catch (err) {
        console.warn("Nominatim search failed, trying Photon fallback...", err);

        try {
          // 2. Try Photon API (Fallback)
          // Photon is very lenient and fast.
          // Note: Photon supports limited languages (en, de, fr, it). Defaulting to 'en' to avoid 400 errors.
          const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`, {
            signal: AbortSignal.timeout(5000)
          });
          const photonData = await photonRes.json();

          if (photonData && photonData.features) {
            // Map Photon GeoJSON to pseudo-Nominatim format
            results = photonData.features.map(f => {
              const p = f.properties;
              // Construct display name
              const parts = [p.name, p.city, p.state, p.country].filter(Boolean);
              return {
                lat: f.geometry.coordinates[1].toString(), // Photon is [lon, lat]
                lon: f.geometry.coordinates[0].toString(),
                display_name: parts.join(", "),
                name: p.name,
                address: {
                  city: p.city || p.name,
                  state: p.state,
                  country: p.country
                },
                // Add a flag to identify source preference if needed
                importance: 0.5 // Default importance
              };
            });
          }
        } catch (errPhoton) {
          console.warn("Photon search failed, trying OpenMeteo fallback...", errPhoton);

          // 3. Try OpenMeteo Geocoding (Robust Fallback)
          const omRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${language}&format=json`, {
            signal: AbortSignal.timeout(5000)
          });
          const omData = await omRes.json();

          if (omData && omData.results) {
            results = omData.results.map(r => ({
              lat: r.latitude.toString(),
              lon: r.longitude.toString(),
              display_name: `${r.name}, ${r.country}`,
              name: r.name,
              address: {
                city: r.name,
                state: r.admin1,
                country: r.country
              },
              importance: 0.4
            }));
          }
        }
      }

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
            setIsSidebarOpen(true); // Re-open sidebar on error
          }
        }
        return;
      }

      const cityData = results;

      if (cityData.length > 1 && searchMode !== 'prompt') {
        setDisambiguationOptions(cityData);
        setDisambiguationContext(context);
        setIsSidebarOpen(true); // Re-open sidebar for disambiguation
        return;
      }

      // Exact match / Single result
      const match = cityData[0];
      setValidatedCityData(match); // Mark as valid

      if (context === 'submit') {
        // Proceed to map
        await loadMapWithCity(match, interestOverride, paramsOverride);
      } else {
        // On blur, maybe autofill
      }

    } catch (error) {
      console.error('Validation error:', error);
    }
  };
  const handleUseCurrentLocation = async () => {
    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Locatie zoeken...' : 'Finding your location...');

    return new Promise((resolve) => {
      // Helper: Process Coordinates into City Data
      const processCoordinates = async (latitude, longitude) => {
        let foundCity = null;
        let displayName = null;
        let address = null;
        let resultData = null;

        // 1. Try Nominatim (OSM) - High Quality
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
            headers: {
              'Accept-Language': language === 'nl' ? 'nl' : 'en'
            }
          });
          if (!res.ok) throw new Error(res.statusText);
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            foundCity = addr.city || addr.town || addr.village || addr.municipality;
            displayName = foundCity;
            if (addr.country) displayName += `, ${addr.country}`;
            address = data.address;
          }
        } catch (err) {
          console.warn("Nominatim Reverse Geocode failed, trying fallback...", err);
        }

        // 2. Fallback: BigDataCloud (Client-side friendly)
        if (!foundCity) {
          try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language === 'nl' ? 'nl' : 'en'}`);
            const data = await res.json();
            if (data && (data.city || data.locality)) {
              foundCity = data.city || data.locality;
              displayName = foundCity;
              if (data.countryName) displayName += `, ${data.countryName}`;
              // Construct pseudo-address object for compatibility
              address = { city: foundCity, country: data.countryName };
            }
          } catch (err) {
            console.warn("BigDataCloud fallback failed", err);
          }
        }

        // 3. Final Result or Coordinate Fallback
        if (foundCity) {
          setCity(displayName);
          resultData = {
            lat: latitude.toString(),
            lon: longitude.toString(),
            name: foundCity,
            display_name: displayName,
            address: address
          };
          setValidatedCityData(resultData);
          setFocusedLocation({ lat: latitude, lng: longitude });
        } else {
          // Absolute Fallback: Coordinates
          const name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setCity(name);
          resultData = { lat: latitude, lon: longitude, name: name, display_name: name };
          setValidatedCityData(resultData);
          setFocusedLocation({ lat: latitude, lng: longitude });
        }

        setIsLoading(false);
        setLoadingText('Exploring...');
        resolve(resultData);
      };

      // Fallback: IP-based Location
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

          // User requested change: If location fails, ask user instead of deciding
          const manualLocation = prompt(language === 'nl'
            ? "Ik kon je locatie niet automatisch bepalen. Waar wil je vertrekken?"
            : "I couldn't find your location. Where do you want to start?");

          if (manualLocation && manualLocation.trim().length > 0) {
            // User provided manual input -> Resolve with this "city" name
            setCity(manualLocation);
            // We return a mock object so flow continues. Validation will happen later.
            resolve({ name: manualLocation, display_name: manualLocation });
          } else {
            resolve(null);
          }
        }
      };

      if (!navigator.geolocation) {
        runIpFallback();
        return;
      }

      // Try Standard Geolocation (Low Accuracy for Speed/Reliability)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          processCoordinates(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("Geolocation API error:", err.code, err.message);
          // On error (Permission denied or Timeout), try IP fallback
          runIpFallback();
        },
        { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });
  };

  // Helper to fetch Wikipedia summary
  const fetchWikipediaSummary = async (query, lang = 'en', context = '') => {
    try {
      // Append context (City Name) to the search query to avoid generic definitions
      // But avoid duplicating it if already present (e.g. "Museum Hasselt" + "Hasselt")
      const hasContext = context && query.toLowerCase().includes(context.toLowerCase());
      const fullQuery = (context && !hasContext) ? `${query} ${context}` : query;
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fullQuery)}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.query?.search?.length) {
        // Fallback 1: Try raw name, BUT only if it looks specific (multi-word) to avoid generic dictionary defs like "Park".
        if (context && query.trim().split(' ').length > 1) {
          return fetchWikipediaSummary(query, lang, ''); // Recursive call without context
        }

        // Fallback 2: Search for the POI *inside* the City's Wikipedia page.
        // This mimics reading a guide book about the city.
        if (context) {
          try {
            const citySearchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&titles=${encodeURIComponent(context)}&format=json&origin=*`;
            const cityRes = await fetch(citySearchUrl);
            const cityData = await cityRes.json();
            const cityPages = cityData.query?.pages;
            const cityPageId = Object.keys(cityPages || {})[0];

            if (cityPageId && cityPageId !== '-1') {
              const cityText = cityPages[cityPageId].extract;
              // Simple regex to find the POI name in the text
              // We look for the name, allowing for case insensitivity
              const escQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
              // Look for sentence containing the query
              const regex = new RegExp(`([^.]*?${escQuery}[^.]*\\.)`, 'i');
              const match = cityText.match(regex);

              if (match && match[1]) {
                // Found a sentence! Let's grab it and maybe the next one.
                // Find index of match
                const idx = match.index;
                // Grab a chunk of text around it (e.g. 500 chars)
                const start = Math.max(0, idx - 100);
                const end = Math.min(cityText.length, idx + 400);
                const snippet = cityText.substring(start, end);

                // Clean up leading/trailing partial sentences
                let validSentences = snippet.match(/[^.!?]+[.!?]+/g);
                if (validSentences) {
                  // Filter for the one containing the query
                  const relSentences = validSentences.filter(s => s.toLowerCase().includes(query.toLowerCase()));
                  if (relSentences.length > 0) {
                    // Return the matching sentence and neighbors if possible, or just the snippet cleaned
                    const cityLink = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(context)}`;
                    return { description: validSentences.join(' ').trim(), link: cityLink, source: "Wikipedia (City Mention)" };
                  }
                }
              }
            }
          } catch (eInner) { console.warn("City fallback failed", eInner); }
        }

        // No Wiki results found. Throw error to trigger catch block and subsequent fallbacks (DDG/Google).
        throw new Error("Wiki search returned no results.");
      }

      let title = searchData.query.search[0].title;

      // REFINEMENT: If the result is just the City Name itself (but our query was more specific),
      // it means Wiki couldn't find the POI and defaulted to the City. This is bad (results in generic city info).
      // We should REJECT this result and try a "Clean Name" search (POI name without City).
      if (context && title.toLowerCase() === context.toLowerCase() && query.length > context.length) {
        // Trigger Fallback logic below by throwing error, OR try cleaned name immediately.
        // Let's try cleaned name immediately.
        const cleanName = query.replace(new RegExp(context, 'gi'), '').trim();
        if (cleanName.length > 3) {
          console.log("Wiki returned city page for specific POI. Retrying with clean name:", cleanName);
          return fetchWikipediaSummary(cleanName, lang, ''); // Recurse without context
        }
      }
      // Fetch intro. We'll handle truncation client-side to ensure sentence integrity.
      const detailsUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      const pages = detailsData.query?.pages;
      // if (!pages) return null; // BAD: Aborts fallbacks
      if (!pages) throw new Error("Wiki details pages missing.");

      const pageId = Object.keys(pages)[0];
      if (pageId === '-1') throw new Error("Wikipedia page not found.");

      let extract = pages[pageId].extract;
      if (!extract) throw new Error("No extract found for Wikipedia page.");

      // Cleaning: Remove parenthetical text (pronunciations) and reference brackets [1], [2]
      extract = extract.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '');

      // Return a much longer summary for "Tour Guide" experience (~30-60s speech).
      // Average speaking rate is ~130-150 words per minute.
      // 30-60 seconds = ~75-150 words.
      // 3 sentences is often too short. We'll try to find a natural break after ~800-1000 characters or just return the whole intro if reasonable.

      // Let's aim for the first few substantial paragraphs.
      // If we just return the cleaned extract, it might be the whole page intro, which is good!
      // But let's cap it slightly to safeguard against massive walls of text if the intro is huge.
      const sentences = extract.split('. ');

      // If intro is short (< 8 sentences), return all of it.
      if (sentences.length <= 8) return extract;

      // Otherwise, take first 8 sentences which should be roughly 1 minute of speech.
      const descText = sentences.slice(0, 8).join('. ') + '.';
      const wikiLink = `https://${lang}.wikipedia.org/?curid=${pageId}`;
      return { description: descText, link: wikiLink, source: "Wikipedia" };

    } catch (e) {
      console.warn("Wiki fetch failed for", query, e.message);
    }

    // Fallback: DuckDuckGo Instant Answer API (Zero-click info)
    // This often catches smaller POIs that don't have a Wiki page but have web presence.
    try {
      const fullQuery = context ? `${query} ${context}` : query;
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(fullQuery)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl);
      const ddgData = await ddgRes.json();

      if (ddgData.AbstractText) {
        return { description: ddgData.AbstractText, link: ddgData.AbstractURL, source: "DuckDuckGo" };
      }
    } catch (e) {
      console.warn("DDG fallback failed", e);
    }

    // Fallback: Google Custom Search JSON API (Programmable Search Engine)
    try {
      // Construct query: Avoid duplicating city name if already in POI name
      let fullQuery = query;
      if (context && !query.toLowerCase().includes(context.toLowerCase())) {
        fullQuery = `${query} ${context}`;
      }

      // Exclude social media to avoid "4287 likes" type descriptions. We want guide content.
      // We want tourism sites, wikis, blogs.
      fullQuery += " -site:facebook.com -site:instagram.com -site:twitter.com -site:linkedin.com";

      // Call Proxy
      // We rely on the server to have the API KEY and CX configured.
      const searchUrl = `/api/google-search?q=${encodeURIComponent(fullQuery)}`;

      let gRes = await fetch(searchUrl);
      let gData = await gRes.json();

      // RETRY LOGIC: If context search failed, try raw name
      // (If server returned empty items)
      if ((!gData.items || gData.items.length === 0) && fullQuery !== query) {
        // console.log("Google Context Search failed. Retrying raw:", query);
        const retryUrl = `/api/google-search?q=${encodeURIComponent(query)}`;
        gRes = await fetch(retryUrl);
        gData = await gRes.json();
      }

      if (gData.error) {
        console.error("Google Search Proxy Error:", gData.error.message);
      }

      if (gData.items && gData.items.length > 0) {
        const item = gData.items[0];
        let bestText = item.snippet;

        // Try to get a longer/better description from OpenGraph tags (meta description)
        if (item.pagemap && item.pagemap.metatags && item.pagemap.metatags.length > 0) {
          const tags = item.pagemap.metatags[0];
          if (tags['og:description'] && tags['og:description'].length > bestText.length) {
            bestText = tags['og:description'];
          } else if (tags['description'] && tags['description'].length > bestText.length) {
            bestText = tags['description'];
          }
        }

        // Clean up text
        const finalDesc = bestText.replace(/^\w{3} \d{1,2}, \d{4} \.\.\. /g, '').replace(/\n/g, ' ');
        return { description: finalDesc, link: item.link, source: "Web Result" };
      } else {
        return null;
      }

    } catch (e) {
      console.warn("Google Search fallback failed", e);
    }
  };



  const processAIPrompt = async (promptText, shouldAutoRead = false) => {
    if (!promptText.trim()) return;

    // Add user message to history
    const newUserMsg = { role: 'user', text: promptText };
    setAiChatHistory(prev => [...prev, newUserMsg]);
    setAiPrompt(''); // Clear input

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'gids denkt na...' : 'guide is thinking...');

    try {
      const updatedHistory = [...aiChatHistory, newUserMsg];
      const engine = new PoiIntelligence({ language });
      // Pass isRouteActive = true if routeData exists
      const isRouteActive = !!routeData;
      console.log("Processing AI Prompt with isRouteActive:", isRouteActive);
      const result = await engine.parseNaturalLanguageInput(promptText, language, updatedHistory, isRouteActive);

      console.log("AI Result:", result);

      if (!result) throw new Error("Guide translation failed");

      // Update local history with AI message
      let aiResponseText = result.message;
      let searchIntent = null;

      // DETECT SEARCH INTENT
      // Regex: Case insensitive "SEARCH", allow newlines, optional spaces
      // Supports both [[SEARCH:...]] and [SEARCH:...]
      const searchMatch = aiResponseText.match(/\[{1,2}\s*SEARCH\s*:\s*([\s\S]*?)\s*\]{1,2}/i);

      // FALLBACK: Semantic Promise Detection
      // If AI says "Ik zoek [X] voor je op", it means valid intent even if tag is missing.
      const semanticMatch = aiResponseText.match(/(?:Ik zoek|I am searching for|Checking|Opzoeken van)\s+(?:de|het|een|an|a|the)?\s*([A-Z][a-zA-Z0-9\s\-\']+?)\s+(?:voor je op|for you|in de buurt|nearby)/i);

      if (searchMatch) {
        searchIntent = searchMatch[1];
        aiResponseText = aiResponseText.replace(searchMatch[0], '').trim();
      } else if (semanticMatch) {
        console.log("[AI] Semantic Search Promise detected:", semanticMatch[1]);
        searchIntent = semanticMatch[1].trim();
        // Don't remove text, let the user see the confirmation
      }

      setAiChatHistory(prev => [...prev, { role: 'brain', text: aiResponseText }]);

      // EXECUTE SEARCH IF DETECTED
      if (searchIntent) {
        // Run in background but show loading in chat (handled by async nature or custom msg)
        await handleAiSearchRequest(searchIntent);
      } else {

        // STANDARD LOGIC (Params extraction etc)
        // Extract and update state if params found
        if (result.params) {
          const p = result.params;
          if (p.city) setCity(p.city);
          if (p.interests) setInterests(p.interests);
          if (p.travelMode) setTravelMode(p.travelMode);
          if (p.constraintType) setConstraintType(p.constraintType);
          if (p.constraintValue) setConstraintValue(p.constraintValue);
          // isRoundtrip removed as it's now constant true
          if (p.startPoint) setStartPoint(p.startPoint);
        }

        // Action based on status
        if (result.status === 'close') {
          setIsAiViewActive(false);
          return null;
        }

        if (result.status === 'complete') {
          const newCity = result.params?.city;
          const currentActiveCity = validatedCityData?.name || validatedCityData?.address?.city || (routeData ? city : null);
          const isCitySwitch = newCity && currentActiveCity && newCity.toLowerCase().trim() !== currentActiveCity.toLowerCase().trim();

          // Fallback for interests
          const effectiveInterests = result.params?.interests || interests;

          // CASE A: Start New / Regenerate
          // Fix: Don't force new route if just using prompt mode with existing route (unless switching cities)
          if (!routeData || isCitySwitch) {
            let finalCity = newCity || city;

            // Fix: If city is null but startPoint implies current location, use current location
            const startPoint = result.params?.startPoint || "";
            const isCurrentLoc = startPoint && (startPoint.toLowerCase().includes('huidig') || startPoint.toLowerCase().includes('current') || startPoint.toLowerCase().includes('mijn locat'));

            if (!finalCity && isCurrentLoc) {
              console.log("AI implied current location start without city. Triggering GPS & continuing...");
              // Trigger Use Current Location flow and wait for data
              const cityData = await handleUseCurrentLocation();

              if (cityData && cityData.name) {
                finalCity = cityData.name;
                // Also set the state just in case, though handleUseCurrentLocation does it
                setCity(cityData.name);
              } else {
                // Failed to get location
                return null;
              }
            }

            // NEW: Interests are now optional, so we only block if finalCity is missing
            if (!finalCity) return null;

            setIsAiViewActive(true);
            await handleCityValidation('submit', finalCity, effectiveInterests, result.params);

            // Switch to itinerary view after a small delay (Reduced to 1s)
            setTimeout(() => setIsAiViewActive(false), 1000);
            return;
          }

          // CASE B: ADD to current journey
          if (routeData) {
            setIsAiViewActive(true);

            // 1. Check if user explicitly asked for an ADD/SEARCH
            // Regex tries to capture the object: "Voeg [Molenpoort] toe", "Zoek [Koffie]"
            // Robust cleaning: explicit steps are safer than one giant regex
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

            // 2. Determine target interest (AI param OR Regex fallback)
            // If AI gave a NEW interest, use it. If not, but user asked for Add, use extracted.
            let targetInterest = (effectiveInterests && effectiveInterests !== interests) ? effectiveInterests : null;

            if (!targetInterest && userAskedForAdd && extractedInterest) {
              console.log("[AI] Missing AI params but valid User Intent. Using extracted:", extractedInterest);
              // DEBUG: Notify user that we are using the fallback - REMOVED

              targetInterest = extractedInterest;
            }

            if (targetInterest) {
              console.log("[AI] Redirecting to Search Proposal:", targetInterest);
              await handleAiSearchRequest(targetInterest);
            } else {
              // Just updating parameters (travel mode, distance etc) is okay to do automatically
              await handleAddToJourney(null, effectiveInterests, result.params);
              setTimeout(() => setIsAiViewActive(false), 1000);
            }
            return;
          }
        }
      }

      // Still interactive or missing city
      return null;
    } catch (err) {
      console.error("AI Prompt processing failed", err);
      setAiChatHistory(prev => [...prev, { role: 'brain', text: 'Oei, er liep iets mis bij het verwerken van je vraag. Probeer je het nog eens?' }]);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // New Handler for AI-triggered Searches - Revised for Smart Algorithm
  const handleAiSearchRequest = async (rawQuery) => {
    const searchId = Date.now();
    console.log(`[AI Search #${searchId}] Starting for:`, rawQuery);

    let query = rawQuery;
    let locationContext = null;

    // Regex split to handle NEAR/near/Near with optional spaces
    const nearSplit = rawQuery.split(/\s*\|\s*NEAR:\s*/i);

    if (nearSplit.length > 1) {
      query = nearSplit[0].trim();
      locationContext = nearSplit[1].trim();
    }

    setLoadingText(language === 'nl' ? `Zoeken naar ${query}...` : `Searching for ${query}...`);
    setIsLoading(true);

    // DEBUG: Explicit confirmation in chat - REMOVED

    try {
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
          console.log(`[AI Search #${searchId}] Context: Whole Route (10km)`);
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
              console.log(`[AI Search #${searchId}] Context: Midpoint @ ${midPoi.name}`);
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
            console.log(`[AI Search #${searchId}] Context: Anchor POI ${target.name}`);
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
          radius = 10.0;
        }
      }

      if (!center || isNaN(center[0])) {
        console.warn(`[AI Search #${searchId}] No center found. Fallback to city defaults.`);
        center = validatedCityData ? [validatedCityData.lat, validatedCityData.lon] : [48.8566, 2.3522]; // Paris fallback
        radius = 15;
      }

      const tempCityData = { lat: center[0], lon: center[1], name: "Search Area" };
      const robustSources = { osm: true, foursquare: true, google: true };

      console.log(`[AI Search #${searchId}] Fetching for "${query}" at ${center} (Sources: All)`);
      let candidates = await getCombinedPOIs(tempCityData, query, city || "Nearby", radius, robustSources);

      if ((!candidates || candidates.length === 0) && radius < 15) {
        console.log(`[AI Search #${searchId}] Retrying broader (15km) search...`);
        candidates = await getCombinedPOIs(tempCityData, query, city || "Nearby", 15, robustSources);
      }

      if (candidates && candidates.length > 0) {
        console.log(`[AI Search #${searchId}] Found ${candidates.length} results.`);
        const currentRoute = routeData?.pois || [];
        const travelModeForEstimation = travelMode === 'cycling' ? 'bike' : 'walk';

        const suggestions = candidates.slice(0, 3).map(cand => {
          let anchorIdx = -1;
          if (referencePoiId) {
            anchorIdx = currentRoute.findIndex(p => p.id === referencePoiId);
          }

          // Safety check for detour calculation
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
        console.warn(`[AI Search #${searchId}] No candidates found.`);
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: language === 'nl' ? `Ik heb helaas geen "${query}" gevonden in de buurt. Misschien staat het anders bekend?` : `I couldn't find any "${query}" nearby. Maybe it's known under a different name?`
        }]);
      }

    } catch (e) {
      console.error(`[AI Search #${searchId}] CRASH:`, e);
      setAiChatHistory(prev => [...prev, {
        role: 'brain',
        text: language === 'nl' ? "Oei, er liep iets mis bij het zoeken. Probeer je het nog een keer met een andere omschrijving?" : "Oops, something went wrong while searching. Could you try again with a different description?"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJourneyStart = async (e, interestOverride = null, promptOverride = null) => {
    e && e.preventDefault();

    if (searchMode === 'prompt') {
      const activePrompt = promptOverride || aiPrompt;
      if (!activePrompt.trim()) return;

      const isVoice = e && e.isVoice === true;
      await processAIPrompt(activePrompt, isVoice);
      return;
    }

    const activeInterest = interestOverride || interests;

    // NOTE: Removed empty interest guard. poiService.js now handles empty interests 
    // by defaulting to popular tourist categories.

    if (!city.trim()) {
      setShowCitySelector(true);
      return;
    }

    // Update state if override used
    if (interestOverride) setInterests(interestOverride);

    // console.log("handleJourneyStart called. City:", city, "Interest:", activeInterest);
    setIsLoading(true);
    setIsSidebarOpen(false); // Close sidebar immediately on start
    setLoadingText(language === 'nl' ? 'Aan het verkennen...' : 'Exploring...');
    setFoundPoisCount(0); // Reset count

    try {
      // Efficiently use cached validation
      if (validatedCityData) {
        // console.log("Using cached city data:", validatedCityData);
        await loadMapWithCity(validatedCityData, activeInterest);
      } else {
        // console.log("Validating city:", city);
        // Note: This calls loadMapWithCity internally if successful
        await handleCityValidation('submit', null, activeInterest);
      }
    } catch (err) {
      console.error("Journey start failed", err);
      // alert("Something went wrong starting your journey: " + err.message);
    } finally {
      setIsLoading(false);
      setNavPhase(NAV_PHASES.PRE_ROUTE);
    }
  };

  const handleAddToJourney = async (e, interestOverride = null, paramsOverride = null) => {
    e && e.preventDefault();

    // AI ADDING SUPPORT: Use the unified conversational agent
    if (searchMode === 'prompt' && !interestOverride) {
      if (!aiPrompt.trim()) return;
      return await processAIPrompt(aiPrompt);
    }

    const activeInterest = interestOverride || interests;
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

      // Use effective constraints
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
        newCandidates = await getCombinedPOIs(targetCityData, activeInterest, city, searchRadiusKm, searchSources);
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

      await new Promise(r => setTimeout(r, 800));

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

      // 3. Smart Insertion Logic
      // Instead of completely reshuffling, we want to insert the new POIs into the route
      // specifically AFTER the current active POI (where the user is or heading to).

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

      let finalPath = [];
      let finalDist = 0;
      let finalSteps = [];
      let walkDist = 0;
      let finalLegs = [];

      try {
        const routeResult = await calculateRoutePath(fullyEnriched, cityCenter, travelMode);
        finalPath = routeResult.path;
        finalDist = routeResult.dist;
        finalSteps = routeResult.steps;
        walkDist = routeResult.walkDist || 0;
        finalLegs = routeResult.legs || [];
      } catch (calcErr) {
        console.error("OSRM Route Calculation Failed in AddToJourney:", calcErr);
        finalPath = [];
        finalDist = fullyEnriched.reduce((acc, p, i) => {
          if (i === 0) return acc + getDistance(cityCenter[0], cityCenter[1], p.lat, p.lng);
          return acc + getDistance(fullyEnriched[i - 1].lat, fullyEnriched[i - 1].lng, p.lat, p.lng);
        }, 0);
      }

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
        routePath: finalPath,
        navigationSteps: finalSteps,
        legs: finalLegs,
        stats: {
          ...routeData.stats,
          totalDistance: finalDist.toFixed(1),
          walkDistance: (walkDist || 0).toFixed(1),
          limitKm: targetLimitKm.toFixed(1),
          isRoundtrip: constraints.isRoundtrip
        }
      };

      // 5. Check Limit
      // 5. Check Limit
      console.log(`AddJourney: New Dist ${finalDist.toFixed(1)}km vs Limit ${maxLimitKm.toFixed(1)}km`);

      if (finalDist > maxLimitKm) {
        console.log("AddJourney: Limit exceeded. Triggering confirmation.");
        setLimitConfirmation({
          proposedRouteData: newRouteData,
          message: language === 'nl'
            ? `Deze toevoeging maakt de reis ${finalDist.toFixed(1)} km. Je limiet is ${targetLimitKm.toFixed(1)} km. Wil je doorgaan?`
            : `This addition makes the journey ${finalDist.toFixed(1)} km. Your limit is ${targetLimitKm.toFixed(1)} km. Do you want to proceed?`
        });
      } else {
        // Fits! Update directly
        console.log("AddJourney: Fits within limit. Updating route directly.");
        setRouteData(newRouteData);

        // TRIGGER ENRICHMENT FOR NEW POIS
        enrichBackground(newRouteData.pois, validatedCityData?.name || city, language, descriptionLength, activeInterest, "Added Spot Enrichment");

        if (searchMode === 'prompt') {
          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? "Ik heb de nieuwe plekken toegevoegd aan je trip! Is er nog iets anders dat je wilt verbeteren of aanpassen? Ik help je graag verder."
              : "I've added the new spots to your trip! Is there anything else you'd like to improve or adjust? I'm happy to help."
          }]);
        } else {
          setIsSidebarOpen(false); // Close sidebar for standard modes
        }
      }

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
  const handleUpdateStartLocation = async (newStartInput) => {
    if (!routeData || !routeData.pois) return;

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Route herschikken...' : 'Reshuffling route...');

    try {
      let newStartCenter = routeData.center;

      // 1. Resolve Location
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
          // Geocode relative to current city to avoid jumps
          const cityName = validatedCityData?.address?.city || city;
          const q = `${newStartInput}, ${cityName}`;
          const res = await fetch(`/api/nominatim?q=${encodeURIComponent(q)}&format=json&limit=1`);
          const data = await res.json();
          if (data && data[0]) {
            newStartCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          } else {
            // Try global
            const res2 = await fetch(`/api/nominatim?q=${encodeURIComponent(newStartInput)}&format=json&limit=1`);
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

      // 2. Re-optimize POI Order (Nearest Neighbor from New Start)
      // Keep existing POIs, just change order
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

      // Calculate dist back to start if roundtrip
      const returnDesc = isRoundtrip ? (language === 'nl' ? "Terug naar start" : "Back to start") : "";

      // 3. Recalculate Path (OSRM)
      // Note: We use the existing POI descriptions/images, no need to re-enrich
      const routeResult = await calculateRoutePath(optimizedPois, newStartCenter, travelMode);

      // 4. Fetch New Start/End Instructions
      const cityName = validatedCityData?.address?.city || city;
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
        center: newStartCenter, // Update center to behave as new start
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
      setStartPoint(newStartInput); // Update form state

    } catch (e) {
      console.error("Update start failed", e);
      alert("Failed to update route.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setRefinementProposals(null);
    if (lastAction === 'start') {
      handleJourneyStart(null, suggestion);
    } else if (lastAction === 'add') {
      handleAddToJourney(null, suggestion);
    }
  };

  const loadMapWithCity = async (cityData, interestOverride = null, paramsOverride = null) => {
    const { lat, lon } = cityData;
    let cityCenter = [parseFloat(lat), parseFloat(lon)];

    // Constraints object constructed from state OR override
    const activeParams = paramsOverride || {};
    const effectiveTravelMode = activeParams.travelMode || travelMode;
    const effectiveConstraintType = activeParams.constraintType || constraintType;
    const effectiveConstraintValue = activeParams.constraintValue || constraintValue;
    const effectiveRoundtrip = activeParams.isRoundtrip !== undefined ? activeParams.isRoundtrip : isRoundtrip;
    const effectiveStartPoint = activeParams.startPoint || startPoint;

    // Handle Start Point (if provided by AI or user)
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
        const res = await fetch(`/api/nominatim?q=${encodeURIComponent(q)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data[0]) {
          cityCenter = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } else {
          // Fallback 1: Try space instead of comma ( Nominatim sometimes prefers "Place City" over "Place, City" )
          const q2 = `${activeStart} ${cityName}`;
          const res2 = await fetch(`/api/nominatim?q=${encodeURIComponent(q2)}&format=json&limit=1`);
          const data2 = await res2.json();

          if (data2 && data2[0]) {
            cityCenter = [parseFloat(data2[0].lat), parseFloat(data2[0].lon)];
          } else {
            // Fallback 2: Try searching for the start point globally (maybe it contains the city name itself or is unique)
            console.log("Start point context search failed. Retrying global search:", activeStart);
            const res3 = await fetch(`/api/nominatim?q=${encodeURIComponent(activeStart)}&format=json&limit=1`);
            const data3 = await res3.json();
            if (data3 && data3[0]) {
              cityCenter = [parseFloat(data3[0].lat), parseFloat(data3[0].lon)];
            } else {
              console.warn("Start point geocoding failed entirely. Defaulting to city center.");
            }
          }
        }
      } catch (e) {
        console.warn("Failed to geocode startPoint", e);
      }
    }

    // Ensure we use the latest interest if overridden
    const activeInterest = interestOverride || interests;

    // Constraints object constructed from state
    const constraints = {
      type: effectiveConstraintType,
      value: effectiveConstraintValue,
      isRoundtrip: effectiveRoundtrip
    };

    // Use the city name from the data to improve the POI search
    // Prioritize specific locality names
    const cityName = cityData.address?.city ||
      cityData.address?.town ||
      cityData.address?.village ||
      cityData.address?.municipality ||
      cityData.name ||
      cityData.display_name.split(',')[0];

    try {
      // 3. Get POIs
      // Smart Search Strategy
      // Calculate search radius
      let searchRadiusKm = constraintValue;

      // MODE 1: RADIUS MODE (Fixed 15km or User Value? User said "15 km radius")
      // We will default to 15km for this mode if we want to be strict, but using the slider value is more flexible.
      // However, the prompt says "1. POIs found in a 15 km radius". Let's enforce 15km for this specific mode request to match description exactly.
      if (searchMode === 'radius') {
        searchRadiusKm = constraints.value;
      } else if (constraints.type === 'duration') {
        // Speed lookup: Walking ~5km/h, Cycling ~15km/h
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        searchRadiusKm = (constraints.value / 60) * speed;
      }

      const candidates = await getCombinedPOIs(cityData, activeInterest, cityName, searchRadiusKm, searchSources);
      setFoundPoisCount(candidates.length);

      if (candidates.length === 0) {
        if (searchMode === 'prompt') {
          setIsAiViewActive(true);
          setAiChatHistory(prev => [...prev, {
            role: 'brain',
            text: language === 'nl'
              ? `Oei, ik kon helaas geen plekken vinden voor "${activeInterest}" in ${cityName}. Heb je misschien andere interesses of een andere plek in gedachten?`
              : `Oops, I couldn't find any spots for "${activeInterest}" in ${cityName}. Do you have other interests or maybe another place in mind?`
          }]);
          setIsSidebarOpen(true);
          setRouteData(null);
          return;
        }

        // Propose Refinement (Standard Mode)
        const refinementOptions = getInterestSuggestions(activeInterest, language);
        if (refinementOptions.length > 0) {
          setRefinementProposals(refinementOptions);
          setLastAction('start');
          setRouteData(null); // Clear map
          return;
        }

        // Classic Fallback if logic fails or no suggestions
        console.warn("No POIs found. Trying fallback...");

        // Fallback: Check for generic tourism to provide suggestions
        let suggestions = [];
        try {
          suggestions = await fetchGenericSuggestions(cityName);
        } catch (e) { console.warn("Fallback failed", e); }

        let msg = `No matches found for "${activeInterest}" in ${cityName}.`;
        if (suggestions.length > 0) {
          msg += `\n\nMaybe try one of these nearby places:\n- ${[...new Set(suggestions)].slice(0, 3).join('\n- ')}`;
        } else {
          msg += `\n\nTry broader terms like "parks", "history", or "food".`;
        }

        // Switch to input screen immediately
        setRouteData(null);
        setIsAiViewActive(true);

        // Show info in AI Chat instead of alert
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: msg
        }]);
        return;
      }

      // Check for partial failures (multi-keyword search)
      if (candidates.failedKeywords && candidates.failedKeywords.length > 0) {
        const failedWords = candidates.failedKeywords.join(', ');
        const msg = language === 'nl'
          ? `Ik heb gezocht naar alles, maar ik kon geen resultaten vinden voor: "${failedWords}". Ik heb de route samengesteld met de andere plekjes.`
          : `I searched for everything, but I couldn't find any results for: "${failedWords}". I have built the route with the other spots.`;

        // Inform via AI Chat instead of alert
        setAiChatHistory(prev => [...prev, {
          role: 'brain',
          text: msg
        }]);
      }

      // Small delay to let user see the "Found X POIs" if it was instant
      if (candidates.length > 0) {
        await new Promise(r => setTimeout(r, 800));
      }

      // === MODE 1: RADIUS (Show All) ===
      if (searchMode === 'radius') {
        const topCandidates = candidates.slice(0, 50);

        // 1. Set initial state with basic POIs (loading descriptions)
        const initialPois = topCandidates.map(p => ({
          ...p,
          description: language === 'nl' ? 'Informatie ophalen...' : 'Fetching details...',
          isLoading: true,
          active_mode: descriptionLength
        }));

        setRouteData({
          center: cityCenter,
          pois: initialPois,
          routePath: [], // No path for radius mode
          stats: {
            totalDistance: "0",
            walkDistance: "0",
            limitKm: `Radius ${searchRadiusKm}`
          }
        });


        // 2. Background Process: Enrich iteratively using the premium Intelligence Engine
        const routeCtx = `Radius search (${searchRadiusKm} km)`;
        enrichBackground(topCandidates, cityData.name, language, descriptionLength, activeInterest, routeCtx);
        return;
      }

      // === MODE 2: JOURNEY (Route Generation) ===
      // 4. Generate constrained route (Nearest Neighbor)
      const selectedPois = [];
      const visitedIds = new Set();
      let currentPos = { lat: cityCenter[0], lng: cityCenter[1] };
      let totalDistance = 0;

      // Convert constraint to Distance limit (km)
      let targetLimitKm = constraints.value; // The target set by user
      const isRoundtrip = constraints.isRoundtrip; // Check if roundtrip

      if (constraints.type === 'duration') {
        // Speed lookup: Walking ~5km/h, Cycling ~15km/h
        const speed = effectiveTravelMode === 'cycling' ? 15 : 5;
        targetLimitKm = (constraints.value / 60) * speed;
      }

      // User allows 15% tolerance above/below.
      const maxLimitKm = targetLimitKm * 1.15;

      // Always try to find at least one POI if possible
      while (totalDistance < maxLimitKm && candidates.length > 0) {

        // Find best fit: Look at closest candidates, but if closest doesn't fit, try next closest.
        // We filter out visited, calculate distance, and sort.
        const potentialNext = candidates
          .filter(c => !visitedIds.has(c.id))
          .map(c => ({
            ...c,
            // Ensure numeric types for correct math
            lat: parseFloat(c.lat),
            lng: parseFloat(c.lng),
            distFromCurr: getDistance(
              parseFloat(currentPos.lat), parseFloat(currentPos.lng),
              parseFloat(c.lat), parseFloat(c.lng)
            )
          }))
          .sort((a, b) => a.distFromCurr - b.distFromCurr);

        // Debug Sorting
        // if (potentialNext.length > 0) {
        //    console.log(`Step from [${currentPos.lat},${currentPos.lng}]. Closest: ${potentialNext[0].name} (${potentialNext[0].distFromCurr.toFixed(2)}km)`);
        // }

        if (potentialNext.length === 0) break;

        let selected = null;

        // Try the top 5 closest to find one that fits
        // Why only top 5? To avoid jumping across the city just to fill budget. 
        // We want a "Route", not a scattering.
        for (let i = 0; i < Math.min(potentialNext.length, 5); i++) {
          const candidate = potentialNext[i];
          const walkingDist = candidate.distFromCurr * 1.3; // 1.3x buffer

          const distBackToStart = isRoundtrip
            ? getDistance(candidate.lat, candidate.lng, cityCenter[0], cityCenter[1]) * 1.3
            : 0;

          if (totalDistance + walkingDist + distBackToStart <= maxLimitKm) {
            selected = candidate;
            break; // Found one!
          }
        }

        if (selected) {
          selectedPois.push(selected);
          visitedIds.add(selected.id);
          totalDistance += (selected.distFromCurr * 1.3);
          currentPos = { lat: selected.lat, lng: selected.lng };
        } else {
          // None of the nearby ones fit. STOP.
          // We don't want to pick something huge distance away just to fit budget.
          break;
        }
      }

      // If we found nothing but have candidates, just show the closest one regardless of limit so user sees something
      if (selectedPois.length === 0 && candidates.length > 0) {
        const d = getDistance(cityCenter[0], cityCenter[1], candidates[0].lat, candidates[0].lng);
        // For single item, roundtrip is just there and back
        const returnD = isRoundtrip ? d : 0;
        selectedPois.push(candidates[0]);
        totalDistance = (d + returnD) * 1.3;
      }

      // 5. OSRM Routing (Get real street path) & Pruning
      // We verify the REAL distance. If it exceeds our tolerance, we remove the furthest point and retry.
      let routeCoordinates = [];
      let realDistance = 0;
      let navigationSteps = [];
      let finalRouteResult = null;

      // We might need to prune multiple times if the estimation was way off
      while (selectedPois.length > 0) {
        const routeResult = await calculateRoutePath(selectedPois, cityCenter, travelMode);
        const dKm = routeResult.dist;

        // Check if this real distance fits our limit (with tolerance)
        // If it's the only POI left, we keep it even if slightly over, to show *something*
        if (dKm <= maxLimitKm || selectedPois.length === 1) {
          // ACCEPT this route
          routeCoordinates = routeResult.path;
          realDistance = dKm;
          navigationSteps = routeResult.steps;
          finalRouteResult = routeResult;

          console.log("OSRM Steps Extracted:", navigationSteps ? navigationSteps.length : 0);
          break; // Exit loop, we are good
        } else {
          // REJECT - Route is too long
          const overflow = dKm - maxLimitKm;
          console.warn(`Route real distance ${dKm}km exceeds limit ${maxLimitKm}km by ${overflow.toFixed(2)}km. Pruning last stop.`);
          selectedPois.pop(); // Remove last added
          // Loop continues and tries again with N-1 waypoints
        }
      }

      // --- OPTIMIZATION: Show Map Immediately ---
      // 1. Set initial state with basic POIs (loading descriptions)
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
        startPoi: null, // Initial start from address is not a POI
        pois: initialPois,
        routePath: routeCoordinates,
        navigationSteps: navigationSteps,
        legs: finalRouteResult ? finalRouteResult.legs : [],
        stats: {
          totalDistance: realDistance.toFixed(1),
          walkDistance: (finalRouteResult?.walkDist || 0).toFixed(1),
          limitKm: targetLimitKm.toFixed(1),
          isRoundtrip: true
        }
      });

      // 2. Background Process: Enrich iteratively
      const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${realDistance.toFixed(1)} km, roundtrip)`;
      enrichBackground(selectedPois, cityData.name, language, descriptionLength, activeInterest, routeCtx);

    } catch (err) {
      console.error("Error fetching POIs", err);
      setRouteData(null);
      setIsSidebarOpen(true);
      alert(language === 'nl'
        ? "Er is een fout opgetreden bij het laden van de kaart. Probeer het opnieuw."
        : "An error occurred while loading the map. Please try again.");
    }
  };

  const handleRemovePoi = async (poiId) => {
    // 1. Filter out the POI
    const updatedPois = routeData.pois.filter(p => p.id !== poiId);

    // If no POIs left, just reset
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
      // 2. Recalculate Route with remaining POIs
      const cityCenter = routeData.center;
      const routeResult = await calculateRoutePath(updatedPois, cityCenter, travelMode);

      // 3. Update Route Data
      setRouteData(prev => ({
        ...prev,
        pois: updatedPois,
        routePath: routeResult.path,
        navigationSteps: routeResult.steps,
        stats: {
          ...prev.stats,
          totalDistance: routeResult.dist.toFixed(1),
          walkDistance: (routeResult.walkDist || 0).toFixed(1)
        }
      }));

      // 4. Update AI Chat
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
  };

  /**
   * Cyclically rotates the entire route so that a selected POI becomes the new start point.
   * POI-namen zijn immutable; startpunt is een rol, geen naam.
   */
  const handleCycleStart = async (selectedPoiId) => {
    if (!routeData || !routeData.pois || !isRoundtrip) return;

    // CASE B: Rotating from a Generic Start (GPS/Address) to a POI
    if (!routeData.startIsPoi) {
      const targetIdx = routeData.pois.findIndex(p => p.id === selectedPoiId);
      if (targetIdx === -1) return;

      setIsLoading(true);
      setLoadingText(language === 'nl' ? 'Nieuw startpunt instellen...' : 'Setting new start point...');

      try {
        // 1. Immutable logic: Rotate the POI list so the target is first
        const rotatedPois = rotateCycle(routeData.pois, targetIdx);
        const newStartPoi = { ...rotatedPois[0], isSpecial: true };
        const remainingPois = rotatedPois.slice(1);

        // 2. Case B: Drop original generic start and recalculate OSRM path (P1 -> ... -> P1)
        const newStartCenter = [newStartPoi.lat, newStartPoi.lng];
        const routeResult = await calculateRoutePath(remainingPois, newStartCenter, travelMode);

        // 3. Fetch specific arrival instructions for this POI as a start point
        const cityName = validatedCityData?.address?.city || city;
        const engine = new PoiIntelligence({ city: cityName, language });
        const newStartInstr = await engine.fetchArrivalInstructions(newStartPoi.name, cityName, language);

        setRouteData(prev => ({
          ...prev,
          center: newStartCenter,
          startName: newStartPoi.name,
          startPoiId: newStartPoi.id,
          startPoi: newStartPoi, // Keep full POI metadata
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

    // CASE A: Rotating from one active POI to another active POI
    const currentStartPoi = routeData.startPoi;
    const allStops = [currentStartPoi, ...routeData.pois];
    const targetIdx = allStops.findIndex(p => p.id === selectedPoiId);
    if (targetIdx === -1) return;

    // Perform cyclic rotation: O(n)
    const rotatedStops = rotateCycle(allStops, targetIdx);
    const newStartPoi = { ...rotatedStops[0], isSpecial: true };
    const newCenter = [newStartPoi.lat, newStartPoi.lng];

    const newPois = rotatedStops.slice(1).map(p => {
      // Return previous start point as a regular stop (loses isSpecial but keeps all metadata)
      if (p.id === currentStartPoi.id) {
        return { ...p, isSpecial: false };
      }
      return p;
    });

    // Rotate the path and steps WITHOUT API CALLS if legs available
    let newPath = routeData.routePath;
    let newSteps = routeData.navigationSteps;
    let newLegs = routeData.legs;

    // Requirement: legs.length must match allStops.length for a valid rotation
    if (routeData.legs && routeData.legs.length === allStops.length) {
      const rotatedLegs = rotateCycle(routeData.legs, targetIdx);

      // Verify all legs have geometries before transforming
      if (rotatedLegs.every(l => l && l.geometry)) {
        newPath = rotatedLegs.flatMap((leg, idx) => {
          const coords = leg.geometry.coordinates.map(c => [c[1], c[0]]);
          return idx === 0 ? coords : coords.slice(1);
        });

        newSteps = rotatedLegs.flatMap(l => l.steps || []);
        newLegs = rotatedLegs;
      }
    }

    // ASYNC: Fetch specific arrival instructions for this POI as a start point
    const cityName = validatedCityData?.address?.city || city;
    const engine = new PoiIntelligence({ city: cityName, language });
    engine.fetchArrivalInstructions(newStartPoi.name, cityName, language).then(newStartInstr => {
      if (newStartInstr) {
        setRouteData(prev => (prev && prev.startPoiId === newStartPoi.id) ? { ...prev, startInfo: newStartInstr } : prev);
      }
    });

    // Update State
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
  };

  /**
   * Reverses the direction of the current route while keeping the start point FIXED.
   * Requirement: Pure in-memory reversal of POIs and geometry.
   */
  const handleReverseDirection = () => {
    if (!routeData || !routeData.pois || !isRoundtrip) return;

    // 1. Prepare full cycle and reverse it
    const startObj = {
      ...(routeData.startIsPoi ? routeData.startPoi : {}),
      id: routeData.startPoiId || 'current-start-anchor',
      lat: routeData.center[0],
      lng: routeData.center[1],
      name: routeData.startName || (language === 'nl' ? 'Startpunt' : 'Start Point'),
      isSpecial: true,
      // Only use accessibility info if it's NOT a POI (generic addresses)
      // If it IS a POI, the POI description taken from startPoi (spread above) takes precedence
      description: routeData.startIsPoi
        ? (routeData.startPoi?.description || routeData.startInfo)
        : routeData.startInfo
    };

    const fullCycle = [startObj, ...routeData.pois];
    const reveredCycle = reverseCycle(fullCycle);

    // 2. Extract new POIs (skipping the anchor which is still index 0)
    const reversedPois = reveredCycle.slice(1).map(p => {
      // Ensure we don't carry over special flags if the start shifted (though in reverseCycle the anchor stays at 0)
      if (p.id === 'current-start-anchor') return { ...p, isSpecial: false };
      return p;
    });

    // 3. Reverse Geometry (Legs)
    let newPath = routeData.routePath;
    let newSteps = routeData.navigationSteps;
    let newLegs = routeData.legs;

    if (routeData.legs && routeData.legs.length > 0) {
      // Reversing legs: [L1, L2, L3] -> [RL3, RL2, RL1]
      const reversedOriginalLegs = [...routeData.legs].reverse();

      // Verify all legs have geometries before transforming
      if (reversedOriginalLegs.every(l => l && l.geometry)) {
        newLegs = reversedOriginalLegs.map(leg => ({
          ...leg,
          geometry: {
            ...leg.geometry,
            coordinates: [...leg.geometry.coordinates].reverse()
          },
          steps: [...leg.steps].reverse()
        }));

        // Reconstruct Path from leg geometries
        newPath = newLegs.flatMap((leg, idx) => {
          const coords = leg.geometry.coordinates.map(c => [c[1], c[0]]);
          return idx === 0 ? coords : coords.slice(1);
        });

        newSteps = newLegs.flatMap(l => l.steps);
      }
    }

    // 3. Update State
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
  };

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
    setAiPrompt('');
    setAiChatHistory([
      {
        role: 'brain', text: language === 'nl'
          ? 'Hoi! Ik ben je gids van CityExplorer. Om je ideale route te plannen, heb ik wat info nodig:\n\n1. Welke **stad** wil je verkennen?\n2. Ga je **wandelen** of **fietsen**?\n3. Hoe **lang** (min) of hoe **ver** (km) wil je gaan?\n4. Wat zijn je **interesses**? (Indien leeg, toon ik je de belangrijkste bezienswaardigheden).'
          : 'Hi! I am your guide from CityExplorer. To plan your perfect route, I need a few details:\n\n1. Which **city** do you want to explore?\n2. Will you be **walking** or **cycling**?\n3. How **long** (min) or how **far** (km) would you like to go?\n4. What are your **interests**? (If left empty, I will show you the main tourist highlights).'
      }
    ]);
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
      const response = await fetch('/api/build-booklet', {
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

  useEffect(() => localStorage.setItem('app_auto_audio', autoAudio), [autoAudio]);

  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('app_voice_settings');
    return saved ? JSON.parse(saved) : { variant: 'nl', gender: 'female' };
  });

  useEffect(() => localStorage.setItem('app_voice_settings', JSON.stringify(voiceSettings)), [voiceSettings]);

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
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setCurrentSpeakingPoi(null);
    setSpokenCharCount(0);
    setIsSpeechPaused(false);
  };

  const handleSpeak = (poiOrText, forceOrId = false) => {
    // Overload: Handle (text, id) call pattern from Chat
    let isTextMode = typeof poiOrText === 'string';
    let textToRead = '';
    let uniqueId = '';
    let shouldForce = false;

    if (isTextMode) {
      textToRead = poiOrText;
      uniqueId = forceOrId; // 2nd arg is ID
      shouldForce = true; // Always force play for chat clicks
    } else {
      // POI Object Mode
      if (!poiOrText) return;
      textToRead = poiOrText.description || '';
      uniqueId = poiOrText.id;
      shouldForce = forceOrId === true; // 2nd arg is force flag

      // Determine text based on mode - NEW: Read EVERYTHING until the end
      if (poiOrText.structured_info) {
        const info = poiOrText.structured_info;
        const parts = [];

        // 1. Short Description
        if (info.short_description) parts.push(info.short_description);

        // 2. Full Description
        if (info.full_description) parts.push(info.full_description);

        // 3. Reasons (Interest Alignment)
        if (info.matching_reasons && info.matching_reasons.length > 0) {
          const prefix = language === 'nl' ? "Waarom dit bij je past: " : "Why this matches your interests: ";
          parts.push(prefix + info.matching_reasons.join(". "));
        }

        // 4. Fun Facts
        if (info.fun_facts && info.fun_facts.length > 0) {
          const prefix = language === 'nl' ? "Wist je dat? " : "Did you know? ";
          parts.push(prefix + info.fun_facts.join(". "));
        }

        // 5. 2 Minute Highlight
        if (info.two_minute_highlight) {
          const prefix = language === 'nl' ? "Als je maar twee minuten hebt: " : "If you only have two minutes: ";
          parts.push(prefix + info.two_minute_highlight);
        }

        // 6. Visitor Tips
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

    // If not forcing (toggle), handle pause/resume
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

    // Always stop previous before starting new
    window.speechSynthesis.cancel();
    setSpokenCharCount(0);

    setSpeakingId(uniqueId);
    if (!isTextMode) setCurrentSpeakingPoi(poiOrText); // Only track POI for auto-restart

    const u = new SpeechSynthesisUtterance(textToRead);

    // Voice Selection Logic
    let targetLang = 'nl-NL';
    if (voiceSettings.variant === 'en') targetLang = 'en-US';
    else if (voiceSettings.variant === 'be') targetLang = 'nl-BE';

    // Fallback logic for language
    let relevantVoices = availableVoices.filter(v => v.lang.includes(targetLang));
    if (relevantVoices.length === 0) {
      // Try broader search (e.g. 'en' instead of 'en-US')
      const shortLang = targetLang.split('-')[0];
      relevantVoices = availableVoices.filter(v => v.lang.includes(shortLang));
    }

    // 2. Filter by Gender (Heuristic based on name)
    let selectedVoice = relevantVoices[0]; // Default to first found

    const targetGender = voiceSettings.gender;
    const genderMatch = relevantVoices.find(v => {
      const n = v.name.toLowerCase();
      // Expanded heuristic list for common Windows/Mac/Chrome voices
      const maleNames = ['male', 'man', 'xander', 'bart', 'arthur', 'david', 'frank', 'maarten', 'mark', 'stefan', 'rob', 'paul', 'daniel'];
      const femaleNames = ['female', 'woman', 'lady', 'ellen', 'claire', 'laura', 'google', 'zira', 'eva', 'katja', 'fenna', 'samantha', 'tessa', 'karen', 'fiona', 'moira'];

      if (targetGender === 'male') {
        return maleNames.some(name => n.includes(name));
      }
      if (targetGender === 'female') {
        return femaleNames.some(name => n.includes(name));
      }
      return false;
    });

    if (genderMatch) selectedVoice = genderMatch;

    if (selectedVoice) {
      u.voice = selectedVoice;
      u.lang = selectedVoice.lang;
    } else {
      u.lang = targetLang;
    }

    // console.log(`Speaking with voice: ${selectedVoice ? selectedVoice.name : 'Default'} (${u.lang})`);

    u.onend = () => {
      setSpeakingId(null);
      setCurrentSpeakingPoi(null);
      setSpokenCharCount(0);
      setIsSpeechPaused(false);
    };

    u.onboundary = (event) => {
      // 'word' boundaries are most reliable for highlighting
      // Use charIndex to track progress
      setSpokenCharCount(event.charIndex);
    };

    setIsSpeechPaused(false);
    window.speechSynthesis.speak(u);
  };

  // Handler for Sidebar Click
  const handlePoiClick = (poi, forcedMode = null) => {
    setFocusedLocation(poi);
    if (autoAudio) {
      // Create a temporary POI object with the forced mode for speech
      const poiToSpeak = forcedMode ? { ...poi, active_mode: forcedMode } : poi;
      handleSpeak(poiToSpeak, true);
    }
  };

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
    console.log("Navigation steps updated from MapContainer:", steps.length);
    setRouteData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        navigationSteps: steps
      };
    });
    // Removed automatic opening of navigation overlay
    // setIsNavigationOpen(true);
  };

  // Auth Guard (Moved here to obey Rules of Hooks)
  if (authLoading) return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white">Loading...</div>;

  // Blocked Screen (Precedes LoginModal to catch blocked login attempts)
  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 p-4 font-sans text-white">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
          {/* Subtle Red Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none" />

          <div className="relative z-10">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-11a4 4 0 11-8 0 4 4 0 018 0zM7 10h10a2 2 0 012 2v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7a2 2 0 012-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Account Locked</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Your access to CityExplorer has been suspended by the administrator.
            </p>
            <div className="bg-slate-800/50 rounded-xl p-5 mb-8 text-sm text-slate-300 border border-white/5">
              To request access, please contact:<br />
              <a
                href={`mailto:geert.schepers@gmail.com?subject=${encodeURIComponent('CityExplorer blocked ')}&body=${encodeURIComponent('Dear CityExplorer team,\n\nCan you please deblock my account.\nEmail address : [ADD YOUR EMAIL ADDRESS]')}`}
                className="text-blue-400 hover:text-blue-300 font-bold mt-2 block text-base"
              >
                CityExplorer admin
              </a>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/10"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginModal />;

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
        <div className="absolute top-0 left-0 right-0 z-[1000] h-1 bg-slate-800 w-full overflow-hidden">
          <div className="h-full bg-blue-500 animate-[progress-indeterminate_1.5s_infinite_linear] origin-left w-full"></div>
          <div className="absolute top-2 right-4 bg-slate-900/80 backdrop-blur text-xs px-3 py-1 rounded-full border border-blue-500/30 text-blue-200 shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            {language === 'nl' ? 'Info bijwerken...' : 'Updating info...'}
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer
          routeData={routeData}
          searchMode={searchMode}
          focusedLocation={focusedLocation}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          language={language}
          onPoiClick={handlePoiClick}
          onPopupClose={() => { setFocusedLocation(null); stopSpeech(); }}
          activePoiIndex={activePoiIndex}
          setActivePoiIndex={setActivePoiIndex}
          pastDistance={pastDistance}
          speakingId={speakingId}
          isSpeechPaused={isSpeechPaused}
          onSpeak={handleSpeak}
          onStopSpeech={stopSpeech}
          spokenCharCount={spokenCharCount}
          isLoading={isLoading}
          loadingText={loadingText}
          loadingCount={foundPoisCount}
          onUpdatePoiDescription={handleUpdatePoiDescription}
          onNavigationRouteFetched={handleNavigationRouteFetched}
          onToggleNavigation={() => setIsNavigationOpen(prev => !prev)}
          autoAudio={autoAudio}
          setAutoAudio={setAutoAudio}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          isSimulationEnabled={isSimulationEnabled}
          userSelectedStyle={travelMode}
          onStyleChange={setTravelMode}
          isAiViewActive={isAiViewActive}
          onOpenAiChat={() => {
            setIsAiViewActive(true);
            setIsSidebarOpen(true);
          }}
          viewAction={viewAction}
          setViewAction={setViewAction}
          navPhase={navPhase}
          setNavPhase={setNavPhase}
          routeStart={routeData?.center}
        />
      </div>

      {/* Navigation Overlay (Turn-by-Turn) */}
      <NavigationOverlay
        steps={routeData?.navigationSteps}
        pois={routeData?.pois}
        language={language}
        userLocation={userLocation}
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        onToggle={() => setIsNavigationOpen(!isNavigationOpen)}
        pastDistance={pastDistance}
        totalTripDistance={routeData?.stats?.totalDistance}
        navPhase={navPhase}
        routeStart={routeData?.center}
      />

      {/* Sidebar (Always Visible) */}
      <ItinerarySidebar
        routeData={routeData}
        onPoiClick={handlePoiClick}
        onRemovePoi={handleRemovePoi}
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
        focusedLocation={focusedLocation}

        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        isSimulationEnabled={isSimulationEnabled}
        setIsSimulationEnabled={setIsSimulationEnabled}

        // Form Props
        city={city} setCity={handleSetCity}
        interests={interests} setInterests={setInterests}
        constraintType={constraintType} setConstraintType={setConstraintType}
        constraintValue={constraintValue} setConstraintValue={setConstraintValue}
        isRoundtrip={true}
        searchSources={searchSources} setSearchSources={setSearchSources}
        onJourneyStart={handleJourneyStart}
        onAddToJourney={handleAddToJourney}
        isLoading={isLoading}
        loadingText={loadingText}
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
        onPopupClose={() => { setFocusedLocation(null); stopSpeech(); }}

        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiChatHistory={aiChatHistory}
      />

      {/* Refinement Modal */}
      {refinementProposals && (
        <div className="absolute inset-0 z-[600] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-white mb-2">
              {language === 'nl' ? 'Geen resultaten gevonden' : 'No matches found'}
            </h3>
            <p className="text-slate-400 mb-4">
              {language === 'nl'
                ? `We konden geen punten vinden voor "${interests}". Bedoelde je misschien:`
                : `We couldn't find points for "${interests}". Did you mean one of these?`
              }
            </p>

            <div className="grid gap-2">
              {refinementProposals.map((prop, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionSelect(prop)}
                  className="bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 text-left px-4 py-3 rounded-xl border border-white/5 transition-all font-medium text-slate-200"
                >
                  {prop}
                </button>
              ))}
              <button
                onClick={() => setRefinementProposals(null)}
                className="w-full mt-4 text-slate-500 hover:text-white text-sm py-2"
              >
                {language === 'nl' ? 'Terug' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Limit Confirmation Modal - Moved Outside */}
      {limitConfirmation && (
        <div className="absolute inset-0 z-[600] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-bold text-white mb-2">
              {language === 'nl' ? 'Limiet overschreden' : 'Limit Exceeded'}
            </h3>
            <p className="text-slate-400 mb-6">
              {limitConfirmation.message}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleConfirmLimit(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl transition-colors font-medium"
              >
                {language === 'nl' ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                onClick={() => handleConfirmLimit(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl transition-colors font-medium"
              >
                {language === 'nl' ? 'Doorgaan' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* City Picker Overlay */}
      {showCitySelector && (
        <CitySelector
          onStartFadeOut={() => {
            // Immediate UI update to prevent flashing background
            // Only if we have interests (otherwise we will eventually show sidebar anyway)
            if (interests && interests.trim().length > 0) {
              setIsLoading(true); // Show loader immediately
            }
          }}
          onCitySelect={async (selectedCity) => {
            setCity(selectedCity);
            setShowCitySelector(false); // Immediate close of overlay

            // Check if we have interests to proceed immediately
            const hasInterests = interests && interests.trim().length > 0;

            if (hasInterests) {
              // CASE 1: Full Info Available -> Go to Map
              setIsLoading(true);
              setLoadingText(language === 'nl' ? 'Bestemming verifiëren...' : 'Verifying destination...');

              try {
                // Submit directly with current interests
                await handleCityValidation('submit', selectedCity, interests);
              } finally {
                setIsLoading(false);
              }
            } else {
              // CASE 2: Missing Interests -> Open Sidebar for Input
              setIsSidebarOpen(true); // Show sidebar
              setShouldAutoFocusInterests(true); // Focus next step

              // Validate city in background (get coords) but don't start journey
              // 'blur' context ensures we fetch data/disambiguate without loading map
              handleCityValidation('blur', selectedCity);
            }
          }}
        />
      )}

    </div >
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <CityExplorerApp />
    </AuthProvider>
  );
}

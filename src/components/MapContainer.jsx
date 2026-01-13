import React, { useEffect, useState, useRef } from 'react';
import { MapContainer as LMapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
    return (R * c).toFixed(1);
};
const calcBearing = (p1, p2) => {
    const y = Math.sin(toRad(p2.lng - p1.lng)) * Math.cos(toRad(p2.lat));
    const x = Math.cos(toRad(p1.lat)) * Math.sin(toRad(p2.lat)) - Math.sin(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.cos(toRad(p2.lng - p1.lng));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

// Helper to control map view
const MapController = ({ center, positions, userLocation, focusedLocation, viewAction, onActionHandled }) => {
    const map = useMap();
    const hasAutoFit = useRef(false);
    const prevPositionsKey = useRef('');
    const prevFocusedLocation = useRef(null);

    // Generate simple key to detect route changes
    const currentKey = positions && positions.length > 0
        ? `${positions.length}-${positions[0][0]}-${positions[0][1]}`
        : 'empty';

    if (prevPositionsKey.current !== currentKey) {
        hasAutoFit.current = false;
        prevPositionsKey.current = currentKey;
    }

    useEffect(() => {
        // Priority 1: Explicit View Actions
        if (viewAction === 'USER' && userLocation) {
            map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.5 });
            if (onActionHandled) onActionHandled();
            return;
        }

        if (viewAction === 'ROUTE' && positions && positions.length > 0) {
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
            map.flyTo([focusedLocation.lat, focusedLocation.lng], 16, { duration: 1.5 });
            prevFocusedLocation.current = focusedLocation;
            return;
        }

        // Priority 3: Auto-fit on initial load/route change
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
    return null;
};

const MapContainer = ({ routeData, focusedLocation, language, onPoiClick, speakingId, onSpeak, onStopSpeech }) => {
    // Default center (Amsterdam)
    const defaultCenter = [52.3676, 4.9041];
    const [userSelectedStyle, setUserSelectedStyle] = useState('walking');
    const [viewAction, setViewAction] = useState(null);

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

    const [userLocation, setUserLocation] = useState(null);

    // Fetch user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log("Error getting location:", error);
                }
            );
        }
    }, []);

    const [navigationPath, setNavigationPath] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);

    // Fetch real street navigation path
    useEffect(() => {
        console.log("Nav check:", { user: !!userLocation, focus: !!focusedLocation, nav: isNavigating, style: userSelectedStyle });
        if (!userLocation || !focusedLocation || !isNavigating) {
            setNavigationPath(null);
            return;
        }

        const fetchPath = async () => {
            try {
                const uLng = Number(userLocation.lng);
                const uLat = Number(userLocation.lat);
                const fLng = Number(focusedLocation.lng);
                const fLat = Number(focusedLocation.lat);

                // Switch profile based on map style
                // 'foot' (pedestrian) prefers safe, smaller paths. 'bike' (cycling) prefers bike lanes/roads.
                const profile = userSelectedStyle === 'cycling' ? 'bike' : 'foot';

                const url = `https://router.project-osrm.org/route/v1/${profile}/${uLng},${uLat};${fLng},${fLat}?overview=full&geometries=geojson&steps=true`;
                console.log("Fetching Path:", url);
                const res = await fetch(url);
                const data = await res.json();

                if (data.routes && data.routes.length > 0) {
                    const path = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    setNavigationPath(path);
                }
            } catch (e) {
                console.error("Navigation fetch failed", e);
            }
        };

        fetchPath();
    }, [userLocation, focusedLocation, isNavigating, userSelectedStyle]);

    // Determine effective style
    // If no route data (input mode), use Dark. Otherwise use user selection.
    const isInputMode = !routeData;
    const activeStyleKey = isInputMode ? 'default' : userSelectedStyle;

    const { pois = [], center, routePath } = routeData || {};
    const positions = pois.map(poi => [poi.lat, poi.lng]);

    // Use OSRM path if available, else simple lines
    const polyline = routePath && routePath.length > 0 ? routePath : (center ? [center, ...positions] : []);

    // Filter styles for switcher (exclude Dark/Default)
    const switcherStyles = Object.keys(MAP_STYLES).filter(k => k !== 'default');

    // User Location Icon
    const userIcon = L.divIcon({
        className: 'custom-user-marker', // Changed class name to be safe
        html: '<div class="user-marker-inner"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return (
        <div className="relative h-full w-full glass-panel overflow-hidden border-2 border-primary/20 shadow-2xl shadow-primary/10">
            <LMapContainer center={center || defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={!isInputMode}>
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
                />

                {/* User Location Marker */}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
                        <Popup className="glass-popup">
                            <div className="text-slate-900 font-bold">{text.here}</div>
                        </Popup>
                    </Marker>
                )}

                {/* Navigation moved to Top HUD */}

                {/* Only show Route/POIs if we have data */}
                {!isInputMode && (
                    <>
                        {/* Dynamic Navigation Line from User to Focused POI */}
                        {/* Turn-by-Turn Navigation Line */}
                        {navigationPath && (
                            <Polyline
                                positions={navigationPath}
                                color="#ef4444"
                                weight={6}
                                opacity={0.8}
                                dashArray="10, 15"
                            />
                        )}
                        {polyline && polyline.length > 1 && (
                            <Polyline
                                positions={polyline}
                                color="#6366f1"
                                weight={5}
                                opacity={0.9}
                                dashArray="10, 15"
                                lineCap="round"
                            />
                        )}

                        {pois.map((poi, idx) => (
                            <Marker
                                key={idx}
                                position={[poi.lat, poi.lng]}
                                eventHandlers={{
                                    click: () => { setIsNavigating(false); onPoiClick && onPoiClick(poi); },
                                    popupclose: () => {
                                        if (speakingId === poi.id) {
                                            onStopSpeech();
                                        }
                                    }
                                }}
                                icon={L.divIcon({
                                    className: 'bg-transparent border-none',
                                    html: `<div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold border-2 border-white shadow-md">${idx + 1}</div>`,
                                    iconSize: [32, 32],
                                    iconAnchor: [16, 16]
                                })}
                            >
                                <Popup className="glass-popup">
                                    <div className="text-slate-900">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-blue-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{idx + 1}</span>
                                                <strong className="text-lg leading-none">{poi.name}</strong>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSpeak(poi); }}
                                                className={`p-1.5 rounded-full transition-all ${speakingId === poi.id ? 'bg-primary text-white' : 'text-slate-400 hover:text-blue-600 hover:bg-black/5'}`}
                                                title="Read Aloud"
                                            >
                                                {speakingId === poi.id ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                )}
                                            </button>
                                        </div>
                                        <p className="m-0 text-sm text-slate-600">{poi.description}</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsNavigating(true);
                                                onPoiClick && onPoiClick(poi);
                                                const popup = e.target.closest('.leaflet-popup');
                                                if (popup) {
                                                    const closeBtn = popup.querySelector('.leaflet-popup-close-button');
                                                    if (closeBtn) closeBtn.click();
                                                }
                                            }}
                                            className="text-primary text-xs mt-2 inline-block font-bold hover:underline bg-transparent border-none cursor-pointer"
                                        >
                                            {text.nav}
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </>
                )}
            </LMapContainer>

            {/* Map Style Switcher - Hide in input mode */}
            {!isInputMode && (
                <div className="absolute top-4 right-4 z-[400] bg-slate-800/90 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-lg flex flex-col gap-2">
                    {switcherStyles.map((styleKey) => {
                        const icon = styleKey === 'walking'
                            ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2" /><path d="M13 20v-5l-3-3 2-3h-3" /><path d="M13 9l3 3-1 8" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6l-5 5-3-3 2-2" /><path d="M12 17.5V14l-3-3 4-3 2 3h2" /></svg>;

                        return (
                            <button
                                key={styleKey}
                                onClick={() => setUserSelectedStyle(styleKey)}
                                className={`p-2.5 rounded-lg transition-all ${userSelectedStyle === styleKey
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                                    }`}
                                title={`${text.switch} ${text[styleKey]} view`}
                            >
                                {icon}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Route Stats Overlay */}
            {routeData?.stats && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[400] bg-slate-900/90 backdrop-blur-xl rounded-full px-6 py-3 border border-white/10 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-700">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{text.dist}</span>
                        <span className="text-xl font-bold text-white leading-none">{routeData.stats.totalDistance} <span className="text-sm font-normal text-slate-400">km</span></span>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{text.limit}</span>
                        <span className="text-xl font-bold text-white leading-none">{routeData.stats.limitKm} <span className="text-sm font-normal text-slate-400">km</span></span>
                    </div>
                </div>
            )}


            {/* Top Navigation HUD */}
            {userLocation && pois.length > 0 && !isInputMode && (() => {
                const targetPoi = focusedLocation || pois[0];
                const targetIdx = pois.findIndex(p => (p.id && p.id === targetPoi.id) || (p.lat === targetPoi.lat && p.lng === targetPoi.lng));

                return (
                    <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-[400] bg-slate-900/90 backdrop-blur-xl rounded-2xl px-6 py-4 border border-white/10 shadow-2xl flex items-center gap-5 animate-in slide-in-from-top-4 duration-700">
                        {/* Direction Arrow */}
                        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/5 shadow-inner">
                            <div style={{ transform: `rotate(${calcBearing(userLocation, targetPoi)}deg)`, transition: 'transform 0.5s ease-out' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#3b82f6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md"><polygon points="12 2 22 22 12 18 2 22 12 2"></polygon></svg>
                            </div>
                        </div>

                        {/* Distance & Label */}
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">{text.next}: POI {targetIdx + 1}</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white tracking-tight">{calcDistance(userLocation, targetPoi)}</span>
                                <span className="text-sm font-medium text-slate-400">km</span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Map Controls */}
            {!isInputMode && (
                <div className="absolute bottom-8 right-8 z-[400] flex flex-col gap-3">
                    <button
                        onClick={() => setViewAction('USER')}
                        disabled={!userLocation}
                        className="bg-slate-800/90 hover:bg-slate-700/90 text-white p-3 rounded-full shadow-lg border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        title={text.locate}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-blue-400 transition-colors"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
                    </button>
                    <button
                        onClick={() => setViewAction('ROUTE')}
                        className="bg-slate-800/90 hover:bg-slate-700/90 text-white p-3 rounded-full shadow-lg border border-white/10 transition-all group"
                        title={text.fit}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-emerald-400 text-slate-200 transition-colors"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default MapContainer;

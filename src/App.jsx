import React, { useState } from 'react';
import JourneyInput from './components/JourneyInput';
import MapContainer from './components/MapContainer';
import ItinerarySidebar from './components/ItinerarySidebar';
import './index.css'; // Ensure styles are loaded

function App() {
  const [routeData, setRouteData] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const [language, setLanguage] = useState('nl'); // 'en' or 'nl'

  // Focused Location (for "Fly To" interaction)
  const [focusedLocation, setFocusedLocation] = useState(null);

  // Form State (Lifted from JourneyInput)
  const [city, setCity] = useState('');
  const [validatedCityData, setValidatedCityData] = useState(null); // Store resolved city data
  const [interests, setInterests] = useState('');
  const [constraintType, setConstraintType] = useState('distance');
  const [constraintValue, setConstraintValue] = useState(5);
  const [isRoundtrip, setIsRoundtrip] = useState(true);

  // Disambiguation State
  const [disambiguationOptions, setDisambiguationOptions] = useState(null);
  const [disambiguationContext, setDisambiguationContext] = useState(null); // 'blur' or 'submit'

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

  // Wrapper for city setter to invalidate validation on edit
  const handleSetCity = (val) => {
    // Only reset validation if the value actually changes
    if (val !== city) {
      setCity(val);
      setValidatedCityData(null);
    }
  };

  const handleCityValidation = async (context = 'blur', queryOverride = null) => {
    const query = queryOverride || city;
    if (!query || query.length < 2) return;

    // If already validated and input hasn't changed (data exists), skip fetch
    // Only ignore cache if we have an explicit override
    if (!queryOverride && validatedCityData) {
      if (context === 'submit') {
        loadMapWithCity(validatedCityData);
      }
      return;
    }

    try {
      const cityResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': language }
      });
      const cityData = await cityResponse.json();

      if (!cityData || cityData.length === 0) {
        if (context === 'submit') alert("City not found. Please try again.");
        return;
      }

      if (cityData.length > 1) {
        setDisambiguationOptions(cityData);
        setDisambiguationContext(context);
        return;
      }

      // Exact match / Single result
      const match = cityData[0];
      setValidatedCityData(match); // Mark as valid

      if (context === 'submit') {
        // Proceed to map
        loadMapWithCity(match);
      } else {
        // On blur, maybe autofill
      }

    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  // Helper to fetch Wikipedia summary
  const fetchWikipediaSummary = async (query, lang = 'en') => {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (!searchData.query?.search?.length) return null;

      const title = searchData.query.search[0].title;
      const detailsUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json();

      const pages = detailsData.query?.pages;
      if (!pages) return null;

      const pageId = Object.keys(pages)[0];
      if (pageId === '-1') return null;

      const extract = pages[pageId].extract;
      return extract ? extract.split('. ').slice(0, 2).join('. ') + '.' : null;
    } catch (e) {
      console.warn("Wiki fetch failed for", query);
      return null;
    }
  };

  const handleJourneyStart = async (e) => {
    e && e.preventDefault();
    if (!city.trim() || !interests.trim()) return;

    // Efficiently use cached validation
    if (validatedCityData) {
      await loadMapWithCity(validatedCityData);
    } else {
      await handleCityValidation('submit');
    }
  };

  const handleDisambiguationSelect = (selectedCityData) => {
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
      loadMapWithCity(selectedCityData);
    }
    // If 'blur', we just corrected the name and return to form.
    setDisambiguationContext(null);
  };

  const handleDisambiguationCancel = () => {
    setDisambiguationOptions(null);
    setDisambiguationContext(null);
  };

  const loadMapWithCity = async (cityData) => {
    const { lat, lon } = cityData;
    const cityCenter = [parseFloat(lat), parseFloat(lon)];

    // Constraints object constructed from state
    const constraints = { type: constraintType, value: constraintValue, isRoundtrip };

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
      let poiData = [];
      const searchStrategies = [
        // Strategy 1: "Interest in City" (Text Search - High precision)
        () => `${interests} in ${cityName}`,

        // Strategy 2: Bounding Box Search (High precision, ignores city name issues)
        () => {
          if (!cityData.boundingbox) return null;
          const [minLat, maxLat, minLon, maxLon] = cityData.boundingbox;
          const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
          return { q: interests, viewbox, bounded: 1 };
        },

        // Strategy 3: Multi-stage Keyword Relaxation in Bounding Box
        // "Vintage Clothing Stores" -> "Clothing Stores"
        () => {
          if (!cityData.boundingbox) return null;
          const words = interests.split(' ');
          if (words.length <= 1) return null;

          const relaxedInterest = words.slice(1).join(' ');
          const [minLat, maxLat, minLon, maxLon] = cityData.boundingbox;
          const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
          console.log(`Relaxing search (1): "${interests}" -> "${relaxedInterest}"`);
          return { q: relaxedInterest, viewbox, bounded: 1 };
        },

        // Strategy 4: Fallback to last word (Noun)
        // e.g. "Vintage Clothing Stores" -> "Stores"
        () => {
          if (!cityData.boundingbox) return null;
          const words = interests.split(' ');
          if (words.length <= 1) return null;

          const simpleInterest = words[words.length - 1];
          const [minLat, maxLat, minLon, maxLon] = cityData.boundingbox;
          const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
          console.log(`Relaxing search (2): "${interests}" -> "${simpleInterest}"`);
          return { q: simpleInterest, viewbox, bounded: 1 };
        }
      ];

      for (const strategy of searchStrategies) {
        const params = strategy();
        if (!params) continue;

        let url = 'https://nominatim.openstreetmap.org/search?format=json&limit=30';
        if (typeof params === 'string') {
          url += `&q=${encodeURIComponent(params)}`;
        } else {
          url += `&q=${encodeURIComponent(params.q)}&viewbox=${params.viewbox}&bounded=${params.bounded}`;
        }

        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data && data.length > 0) {
            poiData = data;
            break; // Found results!
          }
        } catch (e) {
          console.error("Search strategy failed:", e);
        }
      }

      let candidates = poiData.map(item => ({
        name: item.name || item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        description: item.type,
        id: item.place_id
      }));

      if (candidates.length === 0) {
        console.warn("No POIs found. Trying fallback...");

        // Fallback: Check for generic tourism to provide suggestions
        let suggestions = [];
        try {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent('tourism in ' + cityName)}`;
          const fbRes = await fetch(fallbackUrl);
          const fbData = await fbRes.json();
          if (fbData && fbData.length > 0) {
            suggestions = fbData.map(i => i.name || i.display_name.split(',')[0]).filter(n => n);
          }
        } catch (e) { console.warn("Fallback failed", e); }

        let msg = `No matches found for "${interests}" in ${cityName}.`;
        if (suggestions.length > 0) {
          msg += `\n\nMaybe try one of these nearby places:\n- ${[...new Set(suggestions)].slice(0, 3).join('\n- ')}`;
        } else {
          msg += `\n\nTry broader terms like "parks", "history", or "food".`;
        }

        // Switch to input screen immediately
        setRouteData(null);
        setIsSearching(true);

        // Show suggestions after a brief delay to allow UI to update
        setTimeout(() => {
          alert(msg);
        }, 100);
        return;
      }

      // 4. Generate constrained route (Nearest Neighbor)
      const selectedPois = [];
      const visitedIds = new Set();
      let currentPos = { lat: cityCenter[0], lng: cityCenter[1] };
      let totalDistance = 0;

      // Convert constraint to Distance limit (km)
      let targetLimitKm = constraints.value; // The target set by user
      const isRoundtrip = constraints.isRoundtrip; // Check if roundtrip

      if (constraints.type === 'duration') {
        // Avg walking speed 5km/h => limit = (minutes / 60) * 5
        targetLimitKm = (constraints.value / 60) * 5;
      }

      // User allows 15% tolerance above/below.
      const maxLimitKm = targetLimitKm * 1.15;

      // Always try to find at least one POI if possible
      while (totalDistance < maxLimitKm && candidates.length > 0) {
        let nearest = null;
        let minDist = Infinity;
        let nearestIdx = -1;

        for (let i = 0; i < candidates.length; i++) {
          if (visitedIds.has(candidates[i].id)) continue;

          const d = getDistance(currentPos.lat, currentPos.lng, candidates[i].lat, candidates[i].lng);
          // If roundtrip, we must also consider distance back to start from this candidate
          // Heuristic: check if d + distBack fits roughly?
          // Actually, just standard greedy is fine, but we check budget below.
          if (d < minDist) {
            minDist = d;
            nearest = candidates[i];
            nearestIdx = i;
          }
        }

        if (!nearest) break; // No more candidates

        // Add buffer factor (1.3x) for walking distance vs straight line
        const walkingDist = minDist * 1.3;

        // Calculate potential return distance if we stop here
        const distBackToStart = isRoundtrip
          ? getDistance(nearest.lat, nearest.lng, cityCenter[0], cityCenter[1]) * 1.3
          : 0;

        // Check against the relaxed max limit
        if (totalDistance + walkingDist + distBackToStart <= maxLimitKm) {
          selectedPois.push(nearest);
          visitedIds.add(nearest.id);
          totalDistance += walkingDist;
          currentPos = { lat: nearest.lat, lng: nearest.lng };
        } else {
          // Stop if the next hop would exceed the +15% tolerance
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

      // We might need to prune multiple times if the estimation was way off
      while (selectedPois.length > 0) {
        try {
          const waypoints = [
            `${cityCenter[1]},${cityCenter[0]}`,
            ...selectedPois.map(p => `${p.lng},${p.lat}`)
          ];

          // If Roundtrip, append start point at the end
          if (isRoundtrip) {
            waypoints.push(`${cityCenter[1]},${cityCenter[0]}`);
          }

          const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${waypoints.join(';')}?overview=full&geometries=geojson`;
          const routeResponse = await fetch(osrmUrl);
          const routeJson = await routeResponse.json();

          if (routeJson.code === 'Ok' && routeJson.routes && routeJson.routes.length > 0) {
            const route = routeJson.routes[0];
            const dKm = route.distance / 1000;

            // Check if this real distance fits our limit (with tolerance)
            // If it's the only POI left, we keep it even if slightly over, to show *something*
            if (dKm <= maxLimitKm || selectedPois.length === 1) {
              // ACCEPT this route
              routeCoordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);
              realDistance = dKm;
              break; // Exit loop, we are good
            } else {
              // REJECT - Route is too long
              const overflow = dKm - maxLimitKm;
              console.warn(`Route real distance ${dKm}km exceeds limit ${maxLimitKm}km by ${overflow.toFixed(2)}km. Pruning last stop.`);
              selectedPois.pop(); // Remove last added
              // Loop continues and tries again with N-1 waypoints
            }
          } else {
            // API Error or no route? Fallback to straight line logic (break loop)
            throw new Error("OSRM No Route");
          }
        } catch (error) {
          console.error("OSRM fetch failed/pruning error", error);
          // Fallback to straight lines for whatever points we have left
          const pts = [cityCenter, ...selectedPois.map(p => [p.lat, p.lng])];
          if (isRoundtrip) pts.push(cityCenter);

          routeCoordinates = pts;

          // Simple sum of straight lines * 1.3 as fallback stats
          let fallbackDist = 0;
          let prev = { lat: cityCenter[0], lng: cityCenter[1] };
          selectedPois.forEach(p => {
            fallbackDist += getDistance(prev.lat, prev.lng, p.lat, p.lng);
            prev = p;
          });
          if (isRoundtrip) {
            const last = selectedPois[selectedPois.length - 1];
            fallbackDist += getDistance(last.lat, last.lng, cityCenter[0], cityCenter[1]);
          }

          realDistance = fallbackDist * 1.3;
          break;
        }
      }

      // 6. Enrich with Wikipedia Descriptions
      const enrichedPois = await Promise.all(selectedPois.map(async (poi) => {
        const desc = await fetchWikipediaSummary(poi.name, language);
        return { ...poi, description: desc || poi.description };
      }));

      setRouteData({
        center: cityCenter,
        pois: enrichedPois,
        routePath: routeCoordinates, // Pass detailed path
        stats: {
          totalDistance: realDistance.toFixed(1),
          limitKm: targetLimitKm.toFixed(1) // Show the TARGET, not the max tolerance
        }
      });
      setIsSearching(false);
    } catch (err) {
      console.error("Error fetching POIs", err);
      // On error, stay on input screen
      setRouteData(null);
      setIsSearching(true);
    }
  };

  const resetSearch = () => {
    setRouteData(null);
    setIsSearching(true);
    setDisambiguationOptions(null);
    setValidatedCityData(null);
    // Clear form? Or keep it for convenience? 
    // Usually cleaner to clear.
    setCity('');
    setInterests('');
    setConstraintValue(5);
  };

  // Audio State
  const [speakingId, setSpeakingId] = useState(null);
  const [autoAudio, setAutoAudio] = useState(false);

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  const handleSpeak = (poi, force = false) => {
    const isSame = speakingId === poi.id;
    stopSpeech(); // Always stop previous

    if (isSame && !force) {
      return; // Just stopped (toggled off)
    }

    if (!poi) return;

    const textToRead = `${poi.name}. ${poi.description || ''}`;
    const u = new SpeechSynthesisUtterance(textToRead);
    u.lang = language === 'nl' ? 'nl-NL' : 'en-US';
    u.onend = () => setSpeakingId(null);

    setSpeakingId(poi.id);
    window.speechSynthesis.speak(u);
  };

  // Handler for Sidebar Click
  const handlePoiClick = (poi) => {
    setFocusedLocation(poi);
    if (autoAudio) {
      handleSpeak(poi, true);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white relative">
      {/* Journey Input Overlay */}
      {isSearching && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center">
          <JourneyInput
            // Form State
            city={city} setCity={handleSetCity}
            interests={interests} setInterests={setInterests}
            constraintType={constraintType} setConstraintType={setConstraintType}
            constraintValue={constraintValue} setConstraintValue={setConstraintValue}
            isRoundtrip={isRoundtrip} setIsRoundtrip={setIsRoundtrip}

            // Handlers
            onJourneyStart={handleJourneyStart}
            onCityValidation={handleCityValidation} // Validation trigger

            // Disambiguation
            disambiguationOptions={disambiguationOptions}
            onDisambiguationSelect={handleDisambiguationSelect}
            onDisambiguationCancel={handleDisambiguationCancel}

            language={language}
            setLanguage={setLanguage}
          />
        </div>
      )}

      {/* Map Area */}
      <div className={`absolute inset-0 z-0 h-full w-full ${isSearching ? 'invisible' : 'visible'}`}>
        <MapContainer
          routeData={routeData}
          focusedLocation={focusedLocation}
          language={language}
          onPoiClick={handlePoiClick}
          speakingId={speakingId}
          onSpeak={handleSpeak}
          onStopSpeech={stopSpeech}
        />
      </div>

      {/* Sidebar (Only when browsing) */}
      {!isSearching && (
        <ItinerarySidebar
          routeData={routeData}
          onPoiClick={handlePoiClick}
          onReset={resetSearch}
          language={language}
          speakingId={speakingId}
          onSpeak={handleSpeak}
          autoAudio={autoAudio}
          setAutoAudio={setAutoAudio}
        />
      )}
    </div>
  );
}

export default App;

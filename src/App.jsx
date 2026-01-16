import React, { useState, useEffect } from 'react';
import { PoiIntelligence } from './services/PoiIntelligence';
import MapContainer from './components/MapContainer';
import ItinerarySidebar from './components/ItinerarySidebar';
import './index.css'; // Ensure styles are loaded
import { getCombinedPOIs, fetchGenericSuggestions, getInterestSuggestions } from './utils/poiService';

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


function App() {
  const [routeData, setRouteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Exploring...');
  const [foundPoisCount, setFoundPoisCount] = useState(0);
  const [language, setLanguage] = useState('nl'); // 'en' or 'nl'
  const [activeTheme, setActiveTheme] = useState('tech');
  const [descriptionLength, setDescriptionLength] = useState('medium'); // short, medium, max
  const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);

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
    }
  }, [activeTheme]);



  // Focused Location (for "Fly To" interaction)
  const [focusedLocation, setFocusedLocation] = useState(null);

  // Form State (Lifted from JourneyInput)
  const [city, setCity] = useState('');
  const [validatedCityData, setValidatedCityData] = useState(null); // Store resolved city data
  const [interests, setInterests] = useState('');
  const [constraintType, setConstraintType] = useState('distance');
  const [constraintValue, setConstraintValue] = useState(5);
  const [isRoundtrip, setIsRoundtrip] = useState(true);
  // Default to Google only as requested
  const [searchMode, setSearchMode] = useState('journey'); // 'radius' or 'journey'
  const [searchSources, setSearchSources] = useState({ osm: false, foursquare: false, google: true });

  // Disambiguation State
  const [disambiguationOptions, setDisambiguationOptions] = useState(null);
  const [disambiguationContext, setDisambiguationContext] = useState(null); // 'blur' or 'submit'

  // Refinement State (No Results)
  const [refinementProposals, setRefinementProposals] = useState(null);
  const [lastAction, setLastAction] = useState(null); // 'start' or 'add'

  // Limit Confirmation State
  const [limitConfirmation, setLimitConfirmation] = useState(null); // { proposedRouteData, message }

  // Sidebar Visibility State (Lifted)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Re-enrich POIs when Description Length changes
  useEffect(() => {
    if (routeData && routeData.pois && routeData.pois.length > 0) {
      console.log("Description length changed to:", descriptionLength);

      setIsBackgroundUpdating(true);
      // We do not set isLoading(true) here anymore, to allow user interaction.

      enrichBackground(routeData.pois, city, language, descriptionLength)
        .finally(() => {
          setIsBackgroundUpdating(false);
        });
    }
  }, [descriptionLength]); // Only trigger on length change

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
        setIsRoundtrip(data.isRoundtrip !== undefined ? data.isRoundtrip : true);
        setDescriptionLength(data.descriptionLength || 'medium');
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
  const enrichBackground = async (pois, cityName, lang, lengthMode) => {
    // This implements the requested 7-Step "POI Intelligence" pipeline.
    const engine = new PoiIntelligence({
      city: cityName,
      language: lang,
      lengthMode: lengthMode // Pass length mode to engine config
    });

    for (const poi of pois) {
      try {
        // Step 1-7: Resolve Identity, Gather Signals, Score Trust, and Rank.
        const enriched = await engine.evaluatePoi(poi);

        // Update State Incrementally
        setRouteData((prev) => {
          if (!prev || !prev.pois) return prev; // Safety check if user navigated away
          return {
            ...prev,
            pois: prev.pois.map(p => p.id === poi.id ? { ...enriched, isLoading: false } : p)
          };
        });
      } catch (err) {
        console.warn(`POI Engine Failed for ${poi.name}:`, err);
        // On failure, remove loading state
        setRouteData((prev) => {
          if (!prev || !prev.pois) return prev;
          return {
            ...prev,
            pois: prev.pois.map(p => p.id === poi.id ? { ...p, isLoading: false, description: "Info unavailable" } : p)
          };
        });
      }
    }
  };

  // Wrapper for city setter to invalidate validation on edit
  const handleSetCity = (val) => {
    // Only reset validation if the value actually changes
    if (val !== city) {
      setCity(val);
      setValidatedCityData(null);
    }
  };

  const handleCityValidation = async (context = 'blur', queryOverride = null, interestOverride = null) => {
    const query = queryOverride || city;
    if (!query || query.length < 2) return;

    // If already validated and input hasn't changed (data exists), skip fetch
    // Only ignore cache if we have an explicit override
    if (!queryOverride && validatedCityData) {
      if (context === 'submit') {
        loadMapWithCity(validatedCityData, interestOverride);
      }
      return;
    }

    try {
      const cityResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
        headers: { 'Accept-Language': language }
      });
      const cityData = await cityResponse.json();

      if (!cityData || cityData.length === 0) {
        if (context === 'submit') {
          alert("City not found. Please try again.");
          setIsSidebarOpen(true); // Re-open sidebar on error
        }
        return;
      }

      if (cityData.length > 1) {
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
        loadMapWithCity(match, interestOverride);
      } else {
        // On blur, maybe autofill
      }

    } catch (error) {
      console.error('Validation error:', error);
    }
  };
  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setLoadingText(language === 'nl' ? 'Locatie zoeken...' : 'Finding your location...');

    // We set a short timeout for the location request
    const options = { timeout: 10000, enableHighAccuracy: true };

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        // Reverse Geocode to get name
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();

        if (data && data.address) {
          const addr = data.address;
          const foundCity = addr.city || addr.town || addr.village || addr.municipality || "Current Location";

          // Construct more specific display name
          // Prioritize standard OSM road fields
          const street = addr.road || addr.pedestrian || addr.footway || addr.cycleway || addr.path;
          const number = addr.house_number;

          let display = foundCity;
          if (street) {
            display = `${street}${number ? ' ' + number : ''}, ${foundCity}`;
          } else if (data.display_name) {
            // Fallback to the first part of the full display name if no street found
            const parts = data.display_name.split(',');
            if (parts.length >= 2) {
              display = `${parts[0]}, ${foundCity}`;
            }
          }

          if (addr.country) display += `, ${addr.country}`;

          // Update state
          setCity(display);

          // Set as Validated immediately so we don't re-search
          setValidatedCityData({
            lat: latitude.toString(),
            lon: longitude.toString(),
            name: foundCity, // Keep city name for POI search/Wiki logic
            display_name: data.display_name,
            address: data.address
          });

          // Center map on this location
          setFocusedLocation({ lat: latitude, lng: longitude });
        } else {
          // If reverse fails, just put coords?
          // Better to still set validated data but maybe generic name
          setCity(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setValidatedCityData({
            lat: latitude.toString(),
            lon: longitude.toString(),
            name: "Current Location",
            display_name: "Current Location",
            address: {}
          });
        }
      } catch (err) {
        console.error("Reverse geocode failed", err);
        alert("Could not determine city name, but using your location.");
        // Still set coords
        setCity(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setValidatedCityData({
          lat: latitude.toString(),
          lon: longitude.toString(),
          name: "Current Location",
          display_name: "Current Location",
          address: {}
        });
      } finally {
        setIsLoading(false);
        setLoadingText('Exploring...');
      }
    }, (err) => {
      console.error("Geolocation error", err);
      alert("Could not retrieve your location. Please check permissions.");
      setIsLoading(false);
    }, options);
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



  const handleJourneyStart = async (e, interestOverride = null) => {
    e && e.preventDefault();
    const activeInterest = interestOverride || interests;
    if (!city.trim() || !activeInterest.trim()) return;

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
    }
  };

  const handleAddToJourney = async (e, interestOverride = null) => {
    e && e.preventDefault();
    const activeInterest = interestOverride || interests;
    if (!activeInterest.trim()) return;

    if (interestOverride) setInterests(interestOverride);

    setIsLoading(true);
    setFoundPoisCount(0);

    try {
      const currentPois = routeData.pois;
      const cityCenter = routeData.center;

      // Use current sidebar constraints for the NEW search
      // BUT for budget validation, we arguably should respect the ORIGINAL limit or at least the one currently set on the slider.
      // Let's use the one on the slider (state), so if user increases it, we allow more. 
      const constraints = { type: constraintType, value: constraintValue, isRoundtrip };

      // 1. Fetch NEW candidates
      let searchRadiusKm = constraintValue;
      if (constraintType === 'duration') searchRadiusKm = (constraintValue / 60) * 5;

      let targetCityData = validatedCityData;
      if (!targetCityData) {
        // Mock it
        targetCityData = { lat: cityCenter[0], lon: cityCenter[1], name: city };
      }

      const newCandidates = await getCombinedPOIs(targetCityData, activeInterest, city, searchRadiusKm, searchSources);
      console.log(`AddJourney: Found ${newCandidates.length} candidates for ${activeInterest}`);
      setFoundPoisCount(newCandidates.length);

      if (newCandidates.length === 0) {
        // Propose Refinement
        const suggestions = getInterestSuggestions(activeInterest, language);
        if (suggestions.length > 0) {
          setRefinementProposals(suggestions);
          setLastAction('add');
          return;
        }

        alert(`No new spots found for "${activeInterest}".`);
        return;
      }

      await new Promise(r => setTimeout(r, 800));

      // 2. Filter New Candidates (Dedupe)
      const existingIds = new Set(currentPois.map(p => p.id || p.name));
      const uniqueNew = newCandidates.filter(p => !existingIds.has(p.id || p.name));
      console.log(`AddJourney: ${uniqueNew.length} unique candidates remaining after dedupe.`);

      if (uniqueNew.length === 0) {
        alert('All found spots are already in your journey!');
        return;
      }

      // 3. Proposed Route Calculation (New Logic: Try All Top 3, Don't Prune yet)
      const candidatePool = [...uniqueNew.slice(0, 3)];
      const mergedList = [...currentPois, ...candidatePool];

      // 3a. Greedy NN Sort
      const optimizedPois = [];
      const visited = new Set();
      let curr = { lat: cityCenter[0], lng: cityCenter[1] };

      while (optimizedPois.length < mergedList.length) {
        let nearest = null;
        let minDist = Infinity;
        for (const p of mergedList) {
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

      // 4. Enrich & Get Path
      const fullyEnriched = await Promise.all(optimizedPois.map(async p => {
        if (p.description) return p;
        const desc = await fetchWikipediaSummary(p.name, language);
        return { ...p, description: desc };
      }));

      const waypoints = [
        `${cityCenter[1]},${cityCenter[0]}`,
        ...fullyEnriched.map(p => `${p.lng},${p.lat}`)
      ];
      if (isRoundtrip) waypoints.push(`${cityCenter[1]},${cityCenter[0]}`);

      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${waypoints.join(';')}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      const json = await res.json();

      let finalPath = [];
      let finalDist = 0;

      if (json.routes && json.routes.length > 0) {
        finalPath = json.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        finalDist = json.routes[0].distance / 1000;
      } else {
        // Fallback straight lines (Mock dist)
        const pts = [cityCenter, ...fullyEnriched.map(p => [p.lat, p.lng])];
        if (isRoundtrip) pts.push(cityCenter);
        finalPath = pts;
        finalDist = 999;
      }

      // Define Limit with tolerance
      let targetLimitKm = constraintValue;
      if (constraintType === 'duration') targetLimitKm = (constraintValue / 60) * 5;
      const maxLimitKm = targetLimitKm * 1.15; // 15% Tolerance

      const newRouteData = {
        center: cityCenter,
        pois: fullyEnriched,
        routePath: finalPath,
        stats: {
          totalDistance: finalDist.toFixed(1),
          limitKm: targetLimitKm.toFixed(1)
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
        setIsSidebarOpen(false); // Close sidebar to show map
      }

    } catch (err) {
      console.error("Add to journey failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLimit = (proceed) => {
    if (proceed && limitConfirmation) {
      setRouteData(limitConfirmation.proposedRouteData);
      setIsSidebarOpen(false);
    }
    setLimitConfirmation(null);
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

  const handleSuggestionSelect = (suggestion) => {
    setRefinementProposals(null);
    if (lastAction === 'start') {
      handleJourneyStart(null, suggestion);
    } else if (lastAction === 'add') {
      handleAddToJourney(null, suggestion);
    }
  };

  const loadMapWithCity = async (cityData, interestOverride = null) => {
    const { lat, lon } = cityData;
    const cityCenter = [parseFloat(lat), parseFloat(lon)];

    // Ensure we use the latest interest if overridden
    const activeInterest = interestOverride || interests;

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
      // Calculate search radius
      let searchRadiusKm = constraintValue;

      // MODE 1: RADIUS MODE (Fixed 15km or User Value? User said "15 km radius")
      // We will default to 15km for this mode if we want to be strict, but using the slider value is more flexible.
      // However, the prompt says "1. POIs found in a 15 km radius". Let's enforce 15km for this specific mode request to match description exactly.
      if (searchMode === 'radius') {
        searchRadiusKm = constraintValue;
      } else if (constraintType === 'duration') {
        // Avg walking speed ~5km/h
        searchRadiusKm = (constraintValue / 60) * 5;
      }

      const candidates = await getCombinedPOIs(cityData, activeInterest, cityName, searchRadiusKm, searchSources);
      setFoundPoisCount(candidates.length);

      if (candidates.length === 0) {
        // Propose Refinement
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

        // Show suggestions after a brief delay to allow UI to update
        setTimeout(() => {
          alert(msg);
          setIsSidebarOpen(true); // Re-open sidebar so user can try again
        }, 100);
        return;
      }

      // Check for partial failures (multi-keyword search)
      if (candidates.failedKeywords && candidates.failedKeywords.length > 0) {
        const failedWords = candidates.failedKeywords.join(', ');
        const msg = language === 'nl'
          ? `We konden geen resultaten vinden voor: "${failedWords}".\nWe tonen de resultaten voor de andere zoektermen.`
          : `We couldn't find results for: "${failedWords}".\nShowing results for the other terms.`;

        // Use a timeout to allow the map to render the successful hits first/simultaneously
        setTimeout(() => alert(msg), 500);
      }

      // Small delay to let user see the "Found X POIs" if it was instant
      if (candidates.length > 0) {
        await new Promise(r => setTimeout(r, 800));
      }

      // === MODE 1: RADIUS (Show All) ===
      if (searchMode === 'radius') {
        // Enrichment for Radius Mode
        const topCandidates = candidates.slice(0, 50);

        const enrichedPois = await Promise.all(topCandidates.map(async (poi) => {
          // Detect "junk" descriptions that are just tag lists (common in raw data)
          let desc = (poi.description || "").toLowerCase();
          const isJunk = desc.includes('_') || // e.g. point_of_interest
            (desc.split(',').length > 2 && !desc.includes('. ')) || // List of tags without sentences
            desc.includes('point of interest') ||
            desc.includes('establishment');

          // Detect generic city descriptions (often erroneously attached to POIs in raw data)
          const isGenericCityDesc =
            poi.description.toLowerCase().startsWith(cityName.toLowerCase() + " is") ||
            poi.description.toLowerCase().includes("hoofdstad") ||
            poi.description.toLowerCase().includes("capital of") ||
            poi.description.toLowerCase().includes("inhabitants") ||
            poi.description.toLowerCase().includes("inwoners");

          // If valid long description exists AND it's not junk AND not generic city info, keep it.
          if (!isJunk && !isGenericCityDesc && poi.description && poi.description.length > 50) return poi;

          const wikiResult = await fetchWikipediaSummary(poi.name, language, cityName);

          // Handle object or string return
          const d = (typeof wikiResult === 'object') ? wikiResult?.description : wikiResult;
          const l = (typeof wikiResult === 'object') ? wikiResult?.link : null;

          // If we found a good description, use it.
          if (d) {
            return { ...poi, description: d, link: l };
          }

          // If search failed and we have junk, try to clean it up or minimal fallback
          if (isJunk) {
            // Clean up underscores and generic terms for display
            let clean = desc.replace(/_/g, ' ').replace(/point of interest|establishment|tourist attraction/g, '').replace(/,,/g, ',').replace(/^,|,$/g, '').trim();
            if (clean.length < 3) clean = ""; // If it was just "point of interest", now empty.
            return { ...poi, description: clean || (language === 'nl' ? "Geen beschrijving beschikbaar." : "No description available.") };
          }

          return poi;
        }));

        setRouteData({
          center: cityCenter,
          pois: enrichedPois,
          routePath: [], // No path for radius mode
          stats: {
            totalDistance: "0",
            limitKm: `Radius ${searchRadiusKm}`
          }
        });
        setIsSidebarOpen(false); // Close sidebar on result
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
        // Avg walking speed 5km/h => limit = (minutes / 60) * 5
        targetLimitKm = (constraints.value / 60) * 5;
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
            distFromCurr: getDistance(currentPos.lat, currentPos.lng, c.lat, c.lng)
          }))
          .sort((a, b) => a.distFromCurr - b.distFromCurr);

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

      // 6. Enrich with POI Intelligence Engine (Generic, Multi-source, Probabilistic)
      // This implements the requested 7-Step "POI Intelligence" pipeline.
      // 6. Enrich with POI Intelligence Engine (Generic, Multi-source, Probabilistic)
      // This implements the requested 7-Step "POI Intelligence" pipeline.
      const engine = new PoiIntelligence({
        city: city,
        language: language
      });

      // --- OPTIMIZATION: Show Map Immediately ---
      // 1. Set initial state with basic POIs (loading descriptions)
      const initialPois = selectedPois.map(p => ({
        ...p,
        description: language === 'nl' ? 'Informatie ophalen...' : 'Fetching details...',
        isLoading: true
      }));

      setRouteData({
        center: cityCenter,
        pois: initialPois,
        routePath: routeCoordinates,
        stats: {
          totalDistance: realDistance.toFixed(1),
          limitKm: targetLimitKm.toFixed(1)
        }
      });
      setIsSidebarOpen(false); // Close sidebar immediately

      // 2. Background Process: Enrich iteratively
      // We do this WITHOUT awaiting the loop here to block UI.
      enrichBackground(selectedPois, cityData.name, language, descriptionLength);



    } catch (err) {
      console.error("Error fetching POIs", err);
      // On error, stay on input screen
      setRouteData(null);
    }
  };

  const resetSearch = () => {
    setRouteData(null);
    setDisambiguationOptions(null);
    setValidatedCityData(null);
    // Clear form? Or keep it for convenience? 
    // Usually cleaner to clear.
    setCity('');
    setInterests('');
    setConstraintValue(5);
    setIsSidebarOpen(true); // Re-open for new search
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

  const handleUpdatePoiDescription = async (poi, lengthMode) => {
    // 1. Mark as loading (optional, or optimistically update UI inside Sidebar)
    console.log("Updating POI", poi.name, "to length:", lengthMode);

    // Optimistic UI Update: Show "Updating..."
    setRouteData((prev) => {
      if (!prev || !prev.pois) return prev;
      return {
        ...prev,
        pois: prev.pois.map(p => p.id === poi.id ? { ...p, description: language === 'nl' ? 'Bezig met bijwerken...' : 'Updating...' } : p)
      };
    });

    const engine = new PoiIntelligence({
      city: city,
      language: language,
      lengthMode: lengthMode
    });

    try {
      const enriched = await engine.evaluatePoi(poi);
      setRouteData((prev) => {
        if (!prev || !prev.pois) return prev;
        return {
          ...prev,
          pois: prev.pois.map(p => p.id === poi.id ? { ...enriched, isLoading: false } : p)
        };
      });
    } catch (err) {
      console.warn("POI update failed", err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white relative">
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
      <div className={`absolute inset-0 z-0 h-full w-full visible`}>
        <MapContainer
          routeData={routeData}
          focusedLocation={focusedLocation}
          language={language}
          onPoiClick={handlePoiClick}
          speakingId={speakingId}
          onSpeak={handleSpeak}
          onStopSpeech={stopSpeech}
          isLoading={isLoading}
          loadingText={loadingText}
          loadingCount={foundPoisCount}
          onUpdatePoiDescription={handleUpdatePoiDescription}
        />
      </div>

      {/* Sidebar (Only when browsing) */}
      {/* Sidebar (Always Visible) */}
      <ItinerarySidebar
        routeData={routeData}
        onPoiClick={handlePoiClick}
        onReset={resetSearch}
        language={language}
        setLanguage={setLanguage} // Add setter for sidebar toggle

        speakingId={speakingId}
        onSpeak={handleSpeak}
        autoAudio={autoAudio}
        setAutoAudio={setAutoAudio}

        // Form Props
        city={city} setCity={handleSetCity}
        interests={interests} setInterests={setInterests}
        constraintType={constraintType} setConstraintType={setConstraintType}
        constraintValue={constraintValue} setConstraintValue={setConstraintValue}
        isRoundtrip={isRoundtrip} setIsRoundtrip={setIsRoundtrip}
        searchSources={searchSources} setSearchSources={setSearchSources}
        onJourneyStart={handleJourneyStart}
        onAddToJourney={handleAddToJourney}
        isLoading={isLoading}
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
        onLoad={handleLoadRoute}
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

    </div >
  );
}

export default App;

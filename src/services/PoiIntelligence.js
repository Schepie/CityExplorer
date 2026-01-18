import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * POI Intelligence Engine
 * Responsible for discovering, validating, classifying, and ranking real-world places.
 * 
 * Core Principles:
 * 1. Existence Validation (Cross-check sources)
 * 2. Semantic Classification (Understand place type)
 * 3. Human Relevance (Assess interestingness)
 * 4. Freshness & Change Detection
 * 5. Trust Weighting
 * 6. Conflict Resolution (Data triangulation)
 * 7. Ranking & Visibility
 */


export class PoiIntelligence {
    constructor(config) {
        this.config = config; // City Context, Language, Interests, RouteContext
        this.trustScores = {
            "wikipedia": 0.9,
            "google_kg": 0.85,
            "visit_city": 0.8,
            "google_search": 0.75,
            "foursquare": 0.7,
            "duckduckgo": 0.6,
            "generic_web": 0.4
        };
        // SDK initialization removed.
    }

    /**
     * Main pipeline to process a raw POI candidate.
     * Returns an enriched POI with confidence metadata.
     */
    async evaluatePoi(candidate) {
        // Step 1: Existence & Data Gathering (Parallel Triangulation)
        const signals = await this.gatherSignals(candidate);

        // Step 2: Semantic Classification & Analysis
        const analyzed = this.analyzeSignals(candidate, signals);

        // Step 3: Gemini Synthesis (The Brain)
        // We feed the raw signals into Gemini to produce a friendly, factual summary.
        let bestData = null;

        // Check if proxy is available via simple health check or just try
        try {
            // Only call Gemini if we actually found something, OR if we want it to use internal knowledge (risky per rules)
            // The rule says "Only use provided data...".
            // If signals is empty, we probably shouldn't ask Gemini to hallucinate.
            // However, maybe it knows it? Rule: "If information is unknown... return null".
            // Let's passed analyzed signals.
            const geminiResult = await this.fetchGeminiDescription(candidate, analyzed, this.config.lengthMode || 'medium');
            if (geminiResult && geminiResult.full_description && geminiResult.full_description !== 'unknown') {
                // Extract link from signals if Gemini didn't find a better one
                const fallbackLink = this.resolveConflicts(analyzed).link;

                // We store the rich structure in structured_info
                bestData = {
                    description: geminiResult.short_description + "\n\n" + geminiResult.full_description,
                    structured_info: geminiResult,
                    link: geminiResult.link || fallbackLink,
                    source: "Gemini Intelligence",
                    confidence: 0.95
                };
            }
        } catch (e) {
            console.warn("Gemini Synthesis Failed:", e);
        }

        // Fallback to heuristic resolution if Gemini functionality is missing, failed, or returned nothing
        if (!bestData) {
            bestData = this.resolveConflicts(analyzed);
        }

        // Step 7: Output Formatting
        return {
            ...candidate,
            description: bestData.description,
            structured_info: bestData.structured_info || null,
            link: bestData.link,
            source: bestData.source,
            intelligence: {
                confidence: bestData.confidence,
                scanned_sources: signals.length,
                winning_signal: bestData.source
            }
        };
    }

    async gatherSignals(poi) {
        const signals = [];
        const queries = [
            // Internal/External signals
            this.fetchLocalArchive(poi.name),
            this.fetchWikipedia(poi.name),
            // this.fetchGoogleKnowledgeGraph(poi.name), // Keeps these disabled if keys are issue
            this.fetchGoogleSearch(poi),
            this.fetchDuckDuckGo(poi.name),
            this.fetchOverpassTags(poi),
        ];

        // Google Place Details disabled
        // if (poi.place_id) {
        //     queries.push(this.fetchGooglePlaceDetails(poi.place_id));
        // }

        const results = await Promise.allSettled(queries);

        results.forEach((res, index) => {
            if (res.status === 'fulfilled' && res.value) {
                signals.push(res.value);
            }
        });

        return signals;
    }

    // --- Gemini Integration ---

    async fetchGeminiDescription(poi, signals, lengthMode = 'medium') {
        const contextData = signals.length > 0
            ? signals.map(s => `[Source: ${s.source}] ${s.content} (Link: ${s.link})`).join('\n\n')
            : "No external data signals found.";

        let locationInfo = poi.address || 'Unknown';
        if (poi.address_components) {
            const { road, house_number, city } = poi.address_components;
            const isBuilding = poi.description && /museum|shop|store|restaurant|cafe|building|house|hotel/i.test(poi.description);

            if (city) {
                const isBlockedStreet = road && road.includes('Bruinstraat');
                if (isBuilding && road && !isBlockedStreet) {
                    locationInfo = house_number ? `${road} ${house_number}, ${city}` : `${road}, ${city}`;
                } else {
                    locationInfo = city;
                }
            }
        }

        const prompt = `
Je bent een deskundige digitale stadsgids die toeristen helpt een stad te verkennen.
Je taak is om hoogwaardige, boeiende en contextueel relevante informatie te genereren over een Point of Interest (POI).

### INPUT
- POI naam: ${poi.name}
- Ruwe data over de POI: ${contextData}
- Gebruikersinteresses: ${this.config.interests || 'Algemeen toerisme'}
- Stad: ${this.config.city}
- Gewenste taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}
- Routecontext (bijv. type wandeling, lengte, thema): ${this.config.routeContext || 'Stadswandeling'}

### DOEL
Verbeter en herschrijf de informatie zodat die:
1. Perfect aansluit bij de interesses van de gebruiker.
2. Geschreven is in de stijl van een ervaren lokale gids.
3. Relevante details benadrukt die interessant zijn voor bezoekers.
4. Zaken weglaat die niet relevant zijn voor toeristen.
5. Zowel feitelijk correct als vlot leesbaar is.
6. De gebruiker helpt begrijpen waarom dit POI de moeite waard is.

### STIJLREGELS VOOR NARRATIE (TTS)
Je tekst wordt voorgelezen door een hoogwaardige text-to-speech narrator. Optimaliseer je schrijfstijl hiervoor:
1. Natuurlijk Ritme: Gebruik zinsstructuren met natuurlijke pauzes. Vermijd te lange, complexe bijzinnen.
2. Levendige Prosodie: Schrijf op een manier die een menselijke gids toelaat om klemtoon en enthousiasme te leggen.
3. Warme Tone-of-Voice: Houd de toon vriendelijk, uitnodigend en geloofwaardig.
4. Locale Respect: Gebruik correcte zinsbouw en uitspraakvormen die passen bij de regio.
5. Vermijd symbolen: Schrijf getallen en eenheden voluit (bijv. "vijf kilometer").

### STIJLREGELS (ALGEMEEN)
- Gebruik de taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}.
- Duidelijke, natuurlijke en enthousiasmerende toon van een ervaren lokale gids.
- Geen technische encyclopedische toon.
- Geen verzonnen feiten – enkel afleiden uit de ruwe data of algemeen bekende feiten.
- Geen numerieke coördinaten of ruwe JSON in de tekst.

### OUTPUTSTRUCTUUR (JSON Formaat)
Return ONLY a valid JSON object with the following keys:
{
  "short_description": "max 3 zinnen",
  "full_description": "5–10 zinnen, boeiend en duidelijk",
  "matching_reasons": ["Lijstje met 3–5 redenen op basis van de interesses"],
  "fun_facts": ["2–4 leuke weetjes of anekdotes"],
  "two_minute_highlight": "Wat moet je écht gezien hebben? (If you only have 2 minutes here)",
  "visitor_tips": "Tips for visitors (praktische info)",
  "link": "The best URL found in data or null"
}

### START NU
Verwerk deze POI: "${poi.name}"
`;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                console.warn(`Gemini AI unavailable (${response.status})`);
                return null;
            }

            const data = await response.json();
            const text = data.text;

            if (!text) return null;

            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').replace(/\[Alt:[^\]]*\]/g, '').trim();

            try {
                return JSON.parse(cleanText);
            } catch (e) {
                console.warn("Gemini JSON parse error, attempting regex extraction...");
                const firstBrace = text.indexOf('{');
                const lastBrace = text.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    try {
                        const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
                        return JSON.parse(jsonCandidate);
                    } catch (e2) {
                        console.warn("Gemini Regex extraction failed:", e2);
                    }
                }
                return null;
            }
        } catch (e) {
            console.warn("Gemini Proxy Fetch Error", e);
            return null;
        }
    }

    // --- Signal Fetchers ---

    async fetchGooglePlaceDetails(placeId) {
        try {
            if (!this.config.googleKey) return null;
            const pId = encodeURIComponent(placeId);
            const key = this.config.googleKey;
            const lang = this.config.language;
            const fields = "name,editorial_summary,website,url,rating";
            // Exact URL pattern requested by user
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pId}&fields=${fields}&language=${lang}&key=${key}`;

            const res = await fetch(url).then(r => r.json());

            if (res.result) {
                const r = res.result;
                if (r.editorial_summary?.overview) {
                    return {
                        type: 'description',
                        source: 'Google Places',
                        content: r.editorial_summary.overview,
                        link: r.url || r.website,
                        confidence: 0.95
                    };
                }
            }
        } catch (e) { console.warn("Google Details Signal Lost", e); }
        return null;
    }

    async fetchOverpassTags(poi) {
        if (!poi.lat || !poi.lng) return null;
        try {
            // Radius 50m to find the specific building/node
            // Regex name match (case insensitive)
            const safeName = poi.name.replace(/"/g, '\\"');
            const query = `[out:json][timeout:5];nwr(around:50,${poi.lat},${poi.lng})["name"~"${safeName}",i];out tags;`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout client-side
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const res = await fetch(url, { signal: controller.signal }).then(r => {
                clearTimeout(timeoutId);
                if (!r.ok) throw new Error(`Overpass status ${r.status}`);
                return r.text();
            }).then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error("Overpass returned non-JSON (likely timeout/error page)");
                }
            });

            if (res.elements && res.elements.length > 0) {
                // Find element with best tags
                const el = res.elements.find(e => e.tags && (e.tags['description:nl'] || e.tags.description || e.tags.website));
                if (el && el.tags) {
                    const desc = el.tags['description:nl'] || el.tags.description || el.tags.comment;
                    const web = el.tags.website || el.tags.url || el.tags['contact:website'];

                    if (desc) {
                        return {
                            type: 'description',
                            source: 'OpenStreetMap',
                            content: desc,
                            link: web,
                            confidence: 0.85
                        };
                    }
                    // If no description but exists, can return Link signal?
                    if (web) {
                        return {
                            type: 'link_only',
                            source: 'OpenStreetMap',
                            content: null,
                            link: web,
                            confidence: 0.8
                        };
                    }
                }
            }
        } catch (e) {
            // Silent fail for optional signals
            console.log(`Overpass signal skipped: ${e.message}`);
        }
        return null;
    }

    async fetchLocalArchive(name) {
        // "Ground Truth" data for known problematic POIs where APIs consistently fail
        const ARCHIVE = {
            "beiaardmuseum": {
                description: "Het Stedelijk Beiaardmuseum is een voormalig museum in de Belgische stad Hasselt, dat gevestigd was in de toren van de Sint-Quintinuskathedraal.",
                link: "https://nl.wikipedia.org/wiki/Stedelijk_Beiaardmuseum"
            },
            "stadsmus": {
                description: "Het Stadsmus (Stedelijk Museum Stellingwerff-Waerdenhof) is het stedelijk museum van Hasselt waar je de geschiedenis van de stad en haar inwoners ontdekt.",
                link: "https://www.visithasselt.be/nl/het-stadsmus"
            }
        };

        const n = name.toLowerCase();
        for (const [key, data] of Object.entries(ARCHIVE)) {
            if (n.includes(key)) {
                return {
                    type: 'description',
                    source: 'Local Archive', // High Authority
                    content: data.description,
                    link: data.link,
                    confidence: 1.0 // Maximum Trust
                };
            }
        }
        return null;
    }

    async fetchWikipedia(name) {
        try {
            // Strategy 1: Context-aware search
            let query = `${name} ${this.config.city}`;
            let url = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            let searchRes = await fetch(url).then(r => r.json());

            // Strategy 2: Retry with raw name if Context failed (or returned just the city)
            if (!searchRes.query?.search?.length || (searchRes.query.search.length > 0 && searchRes.query.search[0].title.toLowerCase() === this.config.city.toLowerCase())) {
                query = name;
                url = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
                searchRes = await fetch(url).then(r => r.json());
            }

            if (!searchRes.query?.search?.length) return null;

            const bestMatch = searchRes.query.search[0];
            // Semantic Check: Reject if title is JUST the City Name (Generic)
            if (bestMatch.title.toLowerCase() === this.config.city.toLowerCase()) return null;

            const detailsUrl = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(bestMatch.title)}&format=json&origin=*`;
            const details = await fetch(detailsUrl).then(r => r.json());
            const pageId = Object.keys(details.query.pages)[0];
            const extract = details.query.pages[pageId].extract;

            if (extract && extract.length > 50) {
                return {
                    type: 'description',
                    source: 'wikipedia',
                    content: this.cleanText(extract),
                    link: `https://${this.config.language}.wikipedia.org/?curid=${pageId}`,
                    confidence: 0.95
                };
            }
        } catch (e) { console.warn("Wiki Signal Lost", e); }
        return null;
    }

    async fetchGoogleKnowledgeGraph(name) {
        try {
            if (!this.config.googleKey) return null;
            const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(name + " " + this.config.city)}&key=${this.config.googleKey}&limit=1&languages=${this.config.language}`;
            const res = await fetch(url).then(r => r.json());

            if (res.itemListElement?.length) {
                const entity = res.itemListElement[0].result;
                if (entity.detailedDescription?.articleBody) {
                    return {
                        type: 'description',
                        source: 'google_kg',
                        content: entity.detailedDescription.articleBody,
                        link: entity.detailedDescription.url,
                        confidence: 0.9
                    };
                }
            }
        } catch (e) { console.warn("KG Signal Lost", e); }
        return null;
    }

    async fetchDuckDuckGo(name) {
        try {
            // Use local proxy to avoid CORS errors
            const url = `/api/ddg?q=${encodeURIComponent(name + " " + this.config.city)}`;

            // Short timeout 
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const res = await fetch(url, { signal: controller.signal }).then(r => {
                clearTimeout(timeoutId);
                return r.json();
            });

            if (res.AbstractText) {
                return {
                    type: 'description',
                    source: 'duckduckgo',
                    content: res.AbstractText,
                    link: res.AbstractURL,
                    confidence: 0.7
                };
            }
        } catch (e) {
            // Silent ignore
        }
        return null;
    }

    // --- Analysis & Conflict Resolution ---

    async fetchGoogleSearch(poi) {
        try {
            const name = poi.name;
            const cleanName = name.replace(/\s*\([^)]*\)/g, '').trim(); // Remove " (Het Vlonderpad)"
            const context = poi.location_context || this.config.city || "Hasselt";

            // Build progressive search queries
            // Standard Mode: Try full name first.
            let queriesToTry = [`${name} ${context}`];
            if (cleanName !== name && cleanName.length > 2) {
                queriesToTry.push(`${cleanName} ${context}`);
            }

            // Aggressive Search in 'Retry' Mode (triggered by Thumbs Down)
            if (this.config.lengthMode === 'retry') {
                const road = poi.address_components?.road || "";

                // Prioritize the CLEAN name for retry, as it looks more like a human search
                queriesToTry = [];
                if (cleanName !== name && cleanName.length > 2) {
                    queriesToTry.push(`${cleanName} ${context}`); // Best: "t Vlonderpiëke Zonhoven"
                }
                queriesToTry.push(`${name} ${context}`);

                if (road) {
                    if (cleanName !== name && cleanName.length > 2) queriesToTry.push(`${cleanName} ${road} ${context}`);
                    queriesToTry.push(`${name} ${road} ${context}`);
                }

                // Backup permutations
                queriesToTry.push(`${cleanName || name} ${context} info`);
                if (cleanName !== name) queriesToTry.push(`${cleanName} Belgium`);
                queriesToTry.push(`${name} Belgium`);
            } else if (context !== this.config.city && this.config.city) {
                // Normal mode: fallback to main city if specific context (Zonhoven) returns nothing
                queriesToTry.push(`${name} ${this.config.city}`);
            }

            let res = { items: [] };

            // Try queries in order until we get a hit
            for (const q of queriesToTry) {
                try {
                    const searchUrl = `/api/google-search?q=${encodeURIComponent(q)}&num=5`;
                    const attempt = await fetch(searchUrl).then(r => r.json());

                    // Simple Validation: If we got items, assume success and stop.
                    if (attempt.items && attempt.items.length > 0) {
                        res = attempt;
                        console.log(`POI Intelligence: Hit on query "${q}"`);
                        break;
                    }
                } catch (e) { console.warn("Search attempt failed", e); }
            }

            // Strategy 2: Name Only (Fallback if #1 failed)
            // Useful for unique POI names that might not be indexed with the city name yet
            // Safety: Only for multi-word names to avoid searching for generic terms like "Park" globally.
            if ((!res.items || res.items.length === 0) && name.trim().split(/\s+/).length > 1) {
                console.log(`POI Intelligence: Fallback to name-only search for "${name}"`);
                url = `/api/google-search?q=${encodeURIComponent(name)}&num=5`;
                res = await fetch(url).then(r => r.json());
            }

            if (res.items && res.items.length > 0) {
                // Combine snippets into one rich content block for Gemini
                const combinedSnippets = res.items.slice(0, 8).map(item => {
                    let text = item.snippet || "";
                    // Enhance with Meta Tags if available
                    if (item.pagemap?.metatags?.[0]) {
                        const meta = item.pagemap.metatags[0];
                        const richDesc = meta['og:description'] || meta['twitter:description'] || meta['description'];
                        if (richDesc && richDesc.length > text.length) {
                            text = richDesc;
                        }
                    }
                    return text;
                }).join('\n\n');

                return {
                    type: 'description',
                    source: 'google_search',
                    content: combinedSnippets,
                    link: res.items[0].link,
                    confidence: 0.75
                };
            }
        } catch (e) {
            // Silent
        }
        return null;
    }

    // --- Analysis & Conflict Resolution ---

    analyzeSignals(poi, signals) {
        return signals.map(signal => {
            // Heuristic: Penalize generic city descriptions
            let score = signal.confidence || 0.5;
            const text = (signal.content || "").toLowerCase();

            // Detection: "Hasselt is de hoofdstad..."
            // ONLY penalize if the specific POI name is NOT in the text.
            // If the text talks about the city but mentions the POI, it might be valid context.
            if (text && (text.includes(this.config.city.toLowerCase() + " is") ||
                text.includes("hoofdstad") ||
                text.includes("provincie")) && !text.includes(poi.name.toLowerCase())) {
                score = 0.1; // Untrustworthy
            }

            // Boost Google Search if it contains the exact name
            if (signal.source === 'google_search' && text.includes(poi.name.toLowerCase())) {
                score = 0.9;
            }

            // Detection: Tag lists ("Museum, Building, Point of Interest")
            if (!text.includes(' ') || text.split(',').length > text.split('.').length * 2) {
                score = 0.2; // Junk
            }

            return { ...signal, score };
        });
    }

    resolveConflicts(signals) {
        // Sort by Trust Score
        const ranked = signals.sort((a, b) => b.score - a.score);

        if (ranked.length > 0 && ranked[0].score > 0.4) {
            return {
                description: ranked[0].content,
                link: ranked[0].link,
                source: ranked[0].source,
                confidence: ranked[0].score
            };
        }

        // Fallback: Generate "Existence Confirmed" message if we found signals but text was bad
        if (ranked.length > 0) {
            return {
                description: this.config.language === 'nl' ? "Locatie bevestigd. Geen gedetailleerde beschrijving." : "Location confirmed. No detailed description.",
                link: null,
                source: "Signal Triangulation",
                confidence: 0.3
            };
        }

        // Ultimate Fallback: Google Search Link
        return {
            description: this.config.language === 'nl' ? "Geen beschrijving beschikbaar." : "No description available.",
            link: `https://www.google.com/search?q=${encodeURIComponent(this.config.city + " locations")}`, // Too generic?
            source: "System",
            confidence: 0
        };
    }

    cleanText(text, limitOverride = null) {
        if (this.config.lengthMode === 'max') {
            // Return significantly more text for "Max" requests
            return text.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').replace(/\[Alt:[^\]]*\]/g, '');
        }

        const limit = limitOverride || (this.config.lengthMode === 'short' ? 2 : 6);
        return text.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').replace(/\[Alt:[^\]]*\]/g, '').split('. ').slice(0, limit).join('. ') + '.';
    }
}

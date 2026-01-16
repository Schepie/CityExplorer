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
        this.config = config; // City Context, Language
        this.trustScores = {
            "wikipedia": 0.9,
            "google_kg": 0.85,
            "visit_city": 0.8,
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
            if (geminiResult && geminiResult.description && geminiResult.description !== 'unknown') {
                // Extract link from signals if Gemini didn't find a better one
                const fallbackLink = this.resolveConflicts(analyzed).link;

                bestData = {
                    description: geminiResult.description,
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
            // All external signals disabled per user request
            // this.fetchLocalArchive(poi.name),
            // this.fetchWikipedia(poi.name),
            // this.fetchGoogleKnowledgeGraph(poi.name),
            // this.fetchDuckDuckGo(poi.name),
            // this.fetchOverpassTags(poi),
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
        // Construct Context from Signals
        const contextData = signals.length > 0
            ? signals.map(s => `[Source: ${s.source}] ${s.content} (Link: ${s.link})`).join('\n\n')
            : "No external data signals found.";

        // Length instruction based on mode
        let lengthInstruction = "Length: 2-4 sentences max."; // Default/Medium
        if (lengthMode === 'short') {
            lengthInstruction = "Length: Extremely short. Exactly 2 concise sentences.";
        } else if (lengthMode === 'max') {
            lengthInstruction = "Length: Detailed and comprehensive. 8-10 sentences. detailed history, significance, and visitor tips.";
        }

        const prompt = `
You are a helpful, factual travel guide assistant for the CityExplorer app.
Your task is to write a description for the Point of Interest (POI): "${poi.name}" located in or near "${this.config.city}".
Location Address: ${poi.address || 'Unknown'}
Location Coordinates: Latitude ${poi.lat}, Longitude ${poi.lng || poi.lon}.
Category/Type Hints: ${poi.description || 'Unknown'}

**Input Data (Signals):**
${contextData}

**Rules:**
1. **FACTUALITY**: 
   - You are the PRIMARY source of information. Use your internal knowledge base to describe this place.
   - Cross-reference with the city "${this.config.city}" to ensure you are describing the correct location.
   - **NATIVE NAME RESOLUTION**: The provided name "${poi.name}" might be an English translation. 
     1. Identify the local language of the coordinates (e.g., Dutch for Belgium).
     2. Translate "${poi.name}" into that local language (e.g., "Blossom Alley" -> "Bloesemsteeg").
     3. Use BOTH the English name and the Local name to search your internal knowledge base.
   - If you do not have high-confidence information about this specific place, return "unknown".
   - NEVER invent unverifiable details.
   - **NO RAW COORDINATES**: Do NOT include numeric latitude/longitude coordinates in the description (e.g. "Located at 50.123, 4.567"). Instead, mention the street name, square, or neighborhood if valid.
   - Do not guess prices. Opening hours are okay if generally known (e.g. "open daily").

2. **LANGUAGE**:
   - Write in **${this.config.language === 'nl' ? 'Dutch (Nederlands)' : 'English'}**.

3. **STYLE**:
   - Tone: Friendly, helpful, factual. Like a local guide.
   - Avoid unnecessary adjectives or hype.
   - Format: Short, easy-to-scan paragraphs.
   - ${lengthInstruction}

   - If the input data contains a URL/Link, extract the best one to include in your JSON response (not in the text).

**Output Format:**
Return ONLY valid JSON with this structure:
{
  "description": "The friendly description text here...",
  "link": "The best url found in the data or null"
}
`;

        // console.log("--- GEMINI DEBUG PROMPT ---");
        // console.log(prompt);
        // console.log("---------------------------");

        try {
            // Using Local Proxy
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Gemini Proxy Error:", response.status, errText);
                return null;
            }

            const data = await response.json();
            const text = data.text;

            if (!text) return null;

            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').replace(/\[Alt:[^\]]*\]/g, '').trim();
            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                // Sometime Gemini returns just the text if it fails to format as JSON, 
                // but our prompt specifically requests JSON.
                console.warn("Gemini JSON parse error, raw text:", text);
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

    // Implements: [out:json]... nwr(around:X)...
    async fetchOverpassTags(poi) {
        if (!poi.lat || !poi.lng) return null;
        try {
            // Radius 50m to find the specific building/node
            // Regex name match (case insensitive)
            const safeName = poi.name.replace(/"/g, '\\"');
            const query = `[out:json][timeout:5];nwr(around:50,${poi.lat},${poi.lng})["name"~"${safeName}",i];out tags;`;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            const res = await fetch(url).then(r => r.json());

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
        } catch (e) { console.warn("Overpass Signal Lost", e); }
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
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(name + " " + this.config.city)}&format=json&no_html=1&skip_disambig=1`;
            const res = await fetch(url).then(r => r.json());
            if (res.AbstractText) {
                return {
                    type: 'description',
                    source: 'duckduckgo',
                    content: res.AbstractText,
                    link: res.AbstractURL,
                    confidence: 0.7
                };
            }
        } catch (e) { console.warn("DDG Signal Lost", e); }
        return null;
    }

    // --- Analysis & Conflict Resolution ---

    analyzeSignals(poi, signals) {
        return signals.map(signal => {
            // Heuristic: Penalize generic city descriptions
            let score = signal.confidence || 0.5;
            const text = signal.content.toLowerCase();

            // Detection: "Hasselt is de hoofdstad..."
            if (text.includes(this.config.city.toLowerCase() + " is") ||
                text.includes("hoofdstad") ||
                text.includes("provincie")) {
                score = 0.1; // Untrustworthy
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

    cleanText(text) {
        return text.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').replace(/\[Alt:[^\]]*\]/g, '').split('. ').slice(0, 6).join('. ') + '.';
    }
}

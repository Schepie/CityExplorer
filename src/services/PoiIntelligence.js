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
                // Extract link and image from signals if Gemini didn't find a better one
                const signalData = this.resolveConflicts(analyzed);

                // We store the rich structure in structured_info
                bestData = {
                    description: geminiResult.short_description + "\n\n" + geminiResult.full_description,
                    structured_info: geminiResult,
                    link: geminiResult.link || signalData.link,
                    image: signalData.image,
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
            image: bestData.image || candidate.image || null,
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

    /**
     * Generates a personalized city welcome message for the tour.
     */
    async fetchCityWelcomeMessage(poiList) {
        const poiNames = poiList.slice(0, 8).map(p => p.name).join(', ');
        const prompt = `
Je bent "Je Gids", een ervaren, vriendelijke en enthousiaste digitale stadsgids die reizigers helpt een stad op een persoonlijke manier te ontdekken. 
Je taak is om een introductie te geven vóór de wandeling of fietstocht begint.

### CONTEXT
De citynavigation‑app heeft een tocht aangemaakt op basis van:
- De gekozen stad: ${this.config.city}
- De interesses van de gebruiker: ${this.config.interests || 'Algemeen'}
- De geselecteerde POI’s langs de route: ${poiNames}
- Eventuele thema’s of routecontext: ${this.config.routeContext || 'Stadswandeling'}

### DOEL
Genereer een inspirerende, warme en duidelijke inleiding voor de tocht, die:
1. De gebruiker welkom heet in ${this.config.city}
2. Kort vertelt wat deze tocht bijzonder maakt
3. Op een natuurlijke manier verwijst naar de interesses van de gebruiker
4. Een beeld schetst van wat de bezoeker kan verwachten langs de route
5. Het gevoel geeft dat dit een persoonlijke, zorgvuldig samengestelde route is
6. Niet te veel verklapt over elke POI (dat gebeurt later), maar wel prikkelt
7. Een menselijke, bezoekersvriendelijke toon gebruikt (niet encyclopedisch)
8. Geschreven is in de gewenste taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}

### OUTPUTSTRUCTUUR
Geef de output als één vloeiende tekst van 6 tot 10 zinnen, met:
- Een warme begroeting
- Een korte introductie tot de stad
- Een teaser van de tocht (stijl, sfeer, wat uniek is)
- Verwijzing naar interesses van de gebruiker
- Een uitnodiging om te vertrekken

### STIJLREGELS
- Gebruik duidelijke, natuurlijke, enthousiasmerende taal
- Schrijf als een lokale gids die de stad goed kent
- Maak het menselijk, warm en persoonlijk
- Noem de POI’s niet allemaal één voor één op; houd het high‑level maar pakkend
- Geen verzonnen feiten; gebruik enkel algemeen bekende eigenschappen of afleidingen uit de input

### START NU
Genereer de introductie voor de tocht in ${this.config.city}.
`;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.text ? data.text.trim() : null;
        } catch (e) {
            console.warn("City Welcome Generation Failed:", e);
            return null;
        }
    }

    /**
     * Generates specific "How to reach" instructions (Transport/Parking) for a point.
     */
    async fetchArrivalInstructions(locationName, city, language = 'nl') {
        const prompt = `
Je bent een lokale gids in ${city}. De gebruiker start zijn route aan: "${locationName}".
GEEF SPECIFIEKE parkeer/reis instructies voor DEZE EXACTE locatie.

CRITICAl RULES:
1. Is "${locationName}" een specifieke plek (bv. "UZ Leuven", "Kanaalkom", "Abdij", "Campus")?
   - Geef dan de parkeer/bus info die DAAR vlakbij is.
   - VERBODEN om generieke stadscentrum info te geven (zoals "Grote Markt" of "Centraal Station") als de plek daar niet is.
   - Voorbeeld: Voor "UZ Leuven" -> Zeg "Parkeer in Parking West of Oost op de campus. Bussen komen aan bij halte UZ Gasthuisberg."

2. Is "${locationName}" generiek (alleen de stadsnaam)?
   - Geef dan pas een algemene suggestie voor het centrum.

DOEL: 2 korte, praktische zinnen. Taal: ${language === 'nl' ? 'Nederlands' : 'Engels'}.
`;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.text ? data.text.trim() : null;
        } catch (e) {
            console.warn("Arrival Instructions Generation Failed:", e);
            return null;
        }
    }

    /**
     * Extracts structured trip parameters from a natural language prompt.
     * Support interactive conversation by maintaining context.
     */
    async parseNaturalLanguageInput(userInput, language = 'nl', history = [], isRouteActive = false) {
        const historyContext = history.map(msg => `${msg.role === 'user' ? 'Gebuiker' : 'Gids'}: ${msg.text}`).join('\n');

        const prompt = `
Je bent een "City Trip Planner" gespecialiseerd in toeristische bezienswaardigheden.
Je helpt de gebruiker om een stad te verkennen met de focus op CULTUUR, HISTORIE en BELEVING.

### JOUW ROL & REGELS
1. **Selecteer alleen POI's die relevant zijn voor toeristen.**
   - INCLUSIEF: Attracties, monumenten, pleinen, musea, parken, kerken.
   - EXCLUSIEF (VERBODEN): Parkings, kantoren, bedrijven, advocaten, architectenbureaus, woonhuizen, of technische infrastructuur.
2. Je bent de EXPERT gids. Ontwerp zelfstandig het ideale plan.
3. Je gebruikt hetzelfde onderliggende algoritme als de "Trip" modus.

### CONTEXTUELE LOGICA (BELANGRIJK)
**Is er al een route actief? ${isRouteActive ? 'JA' : 'NEE'}**

- **INDIEN JA (Route Actief):**
  - Je bent een routeplanner-assistent. De gebruiker is AL onderweg.
  - Vraag NIET om de stad, reiswijze, startpunt of rondtrip-status.
  - Verwerk vragen om op elk moment een extra stop/POI toe te voegen.
  - Zoek geschikte plaatsen in de buurt van een opgegeven anker-POI (bijv. "na het museum", "bij de kerk").
  - Gebruik DIRECT de speciale tag: \`[[SEARCH: <term> | NEAR: <referentiepunt>]]\`. Je kunt de naam OF de index van de POI gebruiken (bijv. \`NEAR: 9\` voor POI #9).
  - Als de gebruiker iets "halverwege" of "tussenin" wil, gebruik: \`[[SEARCH: <term> | NEAR: @MIDPOINT]]\`.
  - Rapporteer altijd dat je geschikte plaatsen zoekt en de extra reistijd zult berekenen.
  - Toon top 3 directe suggesties en zoek naar slimme alternatieven (bv. "plan dit na POI #k i.p.v. na het huidige POI").
  - Conversatie in natuurlijk Nederlands, kort en helder.

3. Dit betekent dat je de volgende informatie MOET hebben of vaststellen voordat je de status op "complete" zet (ALLEEN als route NIET actief is):
   - **Stad/Plaats**: Welke specifieke stad of plek wil de gebruiker verkennen?
   - **Reiswijze**: Gaan ze wandelen ("walking") of fietsen ("cycling")?
   - **Lengte**: Hoe lang (minuten) of hoe ver (km) moet de trip zijn?
   - **Rondtrip**: Elke trip is ALTIJD een rondtrip (loop). Vraag de gebruiker NIET of dit oké is, maar vraag enkel naar een startpunt (bijv. hotel, station) als dit nog niet bekend is.

4. **NIEUW (Algorithm Reasoning)**:
   - 1) Parseer de gebruikersvraag: Anker-POI + Intent (koffie, toilet, etc).
   - 2) Gebruik [[SEARCH]] tags om de app de tools te laten aanroepen:
      - \`find_places_near(near_lat, near_lng, categories, radius)\`
      - \`added_detour_if_inserted_after(route, anchor_index, new_stop)\`
   - 3) De app zal de resultaten tonen in een JSON-blok met \`direct_suggestions\` en \`smart_alternatives\`.

5. **OUTPUT JSON STRUCTUUR ( params object )**:
   - Voeg extra parameters toe indienRelevant:
   - "anchorPoi": De naam van het referentiepunt (indien genoemd).
   - "searchIntent": De zoekterm.

### GESPREKSHISTORIE
${historyContext}

### NIEUWE INPUT VAN DE GEBRUIKER
"${userInput}"

### EXTRACHEERBARE PARAMETERS
- **city**: De stad of regio.
- **travelMode**: "walking" of "cycling".
- ...
- **anchorPoi**: De naam van de POI waar de gebruiker "bij" of "na" wil stoppen.

### OUTPUT JSON STRUCTUUR
Je MOET antwoorden met een JSON object in dit formaat:
{
  "status": "complete" | "interactive" | "close",
  "message": "Jouw bericht aan de gebruiker. Gebruik [[SEARCH: ...]] indien nodig.",
  "params": {
     "city": string | null,
     "travelMode": "walking" | "cycling",
     "constraintType": "duration" | "distance",
     "constraintValue": number | null,
     "interests": string | null,
     "pauses": string | null,
     "startPoint": string | null,
     "anchorPoi": string | null
  }
}
`;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) return null;
            const data = await response.json();
            const text = data.text;
            if (!text) return null;

            console.log("Raw AI Response Text:", text);

            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            // Fix invalid backslashes (e.g. C:\Path) that are not part of valid escape sequences
            const sanitized = cleanText.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

            let parsed;
            try {
                parsed = JSON.parse(sanitized);
            } catch (jsonErr) {
                // Retry without sanitization if strict parsing failed (sometimes regex over-corrects)
                console.warn("Sanitized JSON parse failed, retrying raw:", jsonErr);
                try {
                    parsed = JSON.parse(cleanText);
                } catch (e2) {
                    console.error("Critical JSON Parse Error. Raw Text:", cleanText);
                    throw e2;
                }
            }

            // Add fallback for status if AI forgot it
            if (!parsed.status) parsed.status = (parsed.params && parsed.params.city ? "complete" : "interactive");

            console.log("Parsed AI Object:", parsed);
            return parsed;
        } catch (e) {
            console.warn("Prompt Parsing Failed:", e);
            return null;
        }
    }



    /**
     * STAGE 1: Fast Fetch - Description Only
     */
    async fetchGeminiShortDescription(poi, signals, signal = null) {
        const contextData = signals.length > 0
            ? signals.map(s => `[Source: ${s.source}] ${s.content}`).join('\n\n')
            : "No external data signals found.";

        const prompt = `
                Je bent een snelle, efficiënte gids.
                Schrijf één pakkende, informatieve beschrijving van 5-7 regels voor "${poi.name}" (${this.config.city}).
                Gebruik deze context indien relevant: ${contextData}

                Richtlijnen:
                - Taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}
                - Focus: Wat is het en waarom is het interessant?
                - Geen inleiding, alleen de tekst.

                Start Nu.
                `;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal
            });

            if (!response.ok) return null;
            const data = await response.json();
            const text = data.text ? data.text.trim() : "";

            return {
                short_description: text,
                // Partial structure for compatibility
                structured_info: { short_description: text }
            };
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            return null;
        }
    }

    /**
     * STAGE 2: Deep Fetch - Full Details
     */
    async fetchGeminiFullDetails(poi, signals, shortDesc, signal = null) {
        const contextData = signals.length > 0
            ? signals.map(s => `[Source: ${s.source}] ${s.content} (Link: ${s.link})`).join('\n\n')
            : "No external data signals found.";

        const prompt = `
                Je bent een ervaren lokale gids. We hebben al een korte beschrijving van "${poi.name}".
                Nu willen we de diepte in.

                ### CONText
                - POI: ${poi.name}
                - Stad: ${this.config.city}
                - Interesses: ${this.config.interests || 'Algemeen'}
                - Taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}
                - Context Data: ${contextData}

                ### TAAK
                Genereer de uitgebreide details in JSON formaat.

                ### OUTPUT JSON
                {
                    "standard_version": {
                    "description": "10–15 regels tekst – duidelijke uitleg voor de meeste gebruikers.",
                "fun_fact": "Eén boeiend weetje of anekdote."
  },
                "extended_version": {
                    "full_description": "15–20 regels tekst, boeiend, diepgaand en duidelijk.",
                "why_this_matches_your_interests": [
                "3–5 redenen waarom dit aansluit bij ${this.config.interests || 'Algemeen toerisme'}"
                ],
                "fun_facts": [
                "2–4 leuke weetjes of anekdotes"
                ],
                "if_you_only_have_2_minutes": "Wat moet je écht gezien hebben?",
                "visitor_tips": "Praktische info indien relevant."
  }
}
                `;

        try {
            const url = '/api/gemini';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal
            });

            if (!response.ok) return null;
            const data = await response.json();
            const cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanText);

            return {
                standard_description: result.standard_version?.description || "",
                // Wrap in structured_info for sidebar compatibility
                structured_info: {
                    short_description: shortDesc || "", // Preserve short desc
                    full_description: result.extended_version?.full_description || result.standard_version?.description || "",
                    matching_reasons: result.extended_version?.why_this_matches_your_interests || [],
                    fun_facts: result.extended_version?.fun_facts || [],
                    two_minute_highlight: result.extended_version?.if_you_only_have_2_minutes || "",
                    visitor_tips: result.extended_version?.visitor_tips || "",
                    standard_description: result.standard_version?.description || "", // Duplicated for safety
                    one_fun_fact: result.standard_version?.fun_fact || ""
                }
            };

        } catch (e) {
            if (e.name === 'AbortError') throw e;
            console.warn("Full Details Fetch Failed", e);
            return null;
        }
    }

    // Legacy Support / Fallback wrapper
    async fetchGeminiDescription(poi, signals, lengthMode = 'medium') {
        // If used directly, do short + long combined (old behavior, approximated)
        const short = await this.fetchGeminiShortDescription(poi, signals);
        const full = await this.fetchGeminiFullDetails(poi, signals, short?.short_description);

        return {
            short_description: short?.short_description || "",
            ...full
        };
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

            const detailsUrl = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&piprop=original&redirects=1&titles=${encodeURIComponent(bestMatch.title)}&format=json&origin=*`;
            const details = await fetch(detailsUrl).then(r => r.json());
            const pageId = Object.keys(details.query.pages)[0];
            const page = details.query.pages[pageId];
            const extract = page.extract;
            const image = page.original?.source;

            if (extract && extract.length > 50) {
                return {
                    type: 'description',
                    source: 'wikipedia',
                    content: this.cleanText(extract),
                    link: `https://${this.config.language}.wikipedia.org/?curid=${pageId}`,
                    image: image,
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
                    return {
                        text,
                        image: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || null
                    };
                }).filter(s => s.text);

                return {
                    type: 'description',
                    source: 'google_search',
                    content: combinedSnippets.map(s => s.text).join('\n\n'),
                    link: res.items[0].link,
                    image: combinedSnippets.find(s => s.image)?.image,
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
                image: ranked.find(r => r.image)?.image || null,
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

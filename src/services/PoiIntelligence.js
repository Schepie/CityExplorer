
import { apiFetch } from "../utils/api.js";

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
        this.config = {
            ...config,
            aiProvider: config.aiProvider || 'groq', // Default to Groq (free, fast)
            searchProvider: config.searchProvider || 'tavily' // Default to Tavily (free)
        };
        this.trustScores = {
            "wikipedia": 0.9,
            "google_kg": 0.85,
            "visit_city": 0.8,
            "google_search": 0.75,
            "tavily_search": 0.75,
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
            images: bestData.images || (bestData.image || candidate.image ? [bestData.image || candidate.image] : []),
            link: bestData.link,
            source: bestData.source,
            intelligence: {
                confidence: bestData.confidence,
                scanned_sources: signals.length,
                winning_signal: bestData.source
            }
        };
    }

    async gatherSignals(poi, signal = null) {
        const signals = [];
        const queries = [
            // Internal/External signals
            this.fetchLocalArchive(poi.name),
            this.fetchWikipedia(poi.name, signal),
            this.fetchGoogleSearch(poi, signal),
            this.fetchDuckDuckGo(poi.name, signal),
            this.fetchOverpassTags(poi, signal),
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
    async fetchCityWelcomeMessage(poiList, signal = null) {
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

### STIJLREGELS & STRIKTE NAUWKEURIGHEID
1. Doe GEEN aannames over specifieke POI-kenmerken die niet in de input staan.
2. Als informatie niet met zekerheid bekend is: laat het weg of meld het als "Onbekend".
3. Gebruik alleen expliciet genoemde bronnen of meegeleverde data.
4. Vermijd verouderde informatie.
5. Indien je over een POI spreekt: gebruik enkel feiten waar je zeker van bent.
6. Gebruik duidelijke, natuurlijke, enthousiasmerende taal
7. Schrijf als een lokale gids die de stad goed kent
8. Maak het menselijk, warm en persoonlijk
9. Noem de POI’s niet allemaal één voor één op; houd het high‑level maar pakkend

### START NU
Genereer de introductie voor de tocht in ${this.config.city}.
`;

        try {
            const url = this.config.aiProvider === 'gemini' ? '/api/gemini' : '/api/groq';
            const response = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[AI] Welcome message fetch failed: ${response.status}`, errorText);
                return null;
            }
            const data = await response.json();
            let text = data.text || "";
            // Strip Chain-of-Thought thinking blocks if present
            text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            return text || null;
        } catch (e) {
            console.warn("City Welcome Generation Failed:", e);
            return null;
        }
    }

    /**
     * Generates specific "How to reach" instructions (Transport/Parking) for a point.
     */
    async fetchArrivalInstructions(locationName, city, language = 'nl', signal = null) {
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

3. STRIKTE NAUWKEURIGHEID:
   - Doe GEEN aannames over parkeertarieven of exacte busnummers als je het niet zeker weet.
   - Als de parkeerinfo niet bekend is voor deze specifieke plek: schrijf "Parkeergegevens onbekend".
   - Gebruik alleen betrouwbare, expliciete brondata.

DOEL: 2 korte, praktische zinnen. Taal: ${language === 'nl' ? 'Nederlands' : 'Engels'}.
`;

        const url = this.config.aiProvider === 'gemini' ? '/api/gemini' : '/api/groq';
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            if (signal?.aborted) return null;
            try {
                const response = await apiFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt }),
                    signal
                });

                if (response.status === 429) {
                    const waitTime = 2000 * Math.pow(2, attempts);
                    console.warn(`[AI] Rate Limited (429) on Instructions. Retrying in ${waitTime / 1000}s...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    attempts++;
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[AI] Arrival instructions fetch failed: ${response.status}`, errorText);
                    return null;
                }
                const data = await response.json();
                let text = data.text || "";
                // Strip Chain-of-Thought thinking blocks
                text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                return text || null;
            } catch (e) {
                if (e.name === 'AbortError') return null;
                console.warn(`[AI] Arrival Instructions attempt ${attempts + 1} failed:`, e);
                attempts++;
                if (!signal?.aborted) await new Promise(r => setTimeout(r, 1000));
            }
        }
        return null;
    }

    /**
     * Extracts structured trip parameters from a natural language prompt.
     * Support interactive conversation by maintaining context.
     */
    async parseNaturalLanguageInput(userInput, language = 'nl', history = [], routeContext = null) {
        const historyContext = history.map(msg => `${msg.role === 'user' ? 'Gebuiker' : 'Gids'}: ${msg.text}`).join('\n');

        const isRouteActive = !!routeContext;

        let routeSummary = '';
        if (isRouteActive && typeof routeContext === 'object') {
            routeSummary = `
### HUIDIGE ROUTE STATUS (GEBRUIKER IS HIER NU)
- **Actieve Stad**: ${routeContext.city || 'Onbekend'}
- **Route Lengte**: ${routeContext.stats?.totalDistance || '?'} km (${routeContext.stats?.limitKm ? 'Limiet: ' + routeContext.stats.limitKm + 'km' : ''})
- **Huidige POI's in Trip**: ${routeContext.poiNames || ''}
- **Startpunt**: ${routeContext.startName || '?'}
            `;
        }

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
${routeSummary}

- **INDIEN JA (Route Actief):**
  - Je bent een routeplanner-assistent. De gebruiker is AL onderweg.
  - De gebruiker heeft REEDS een route gegenereerd (zie HUIDIGE ROUTE STATUS).
  - Vraag NIET om de stad, reiswijze, startpunt of rondtrip-status, want die is er al.
  - Verwerk vragen om op elk moment een extra stop/POI toe te voegen.
  - **CRITIEKE REGEL**: Als de gebruiker vraagt om een SPECIFIEKE plek toe te voegen (bijv. "Voeg het Atomium toe"), gebruik dan ALTIJD de tag: [[SEARCH: <naam van de plek>]]. (De app zoekt automatisch in de buurt van de route).
  - Je mag NOOIT een plek direct toevoegen via 'params' als er al een route actief is. Zet de status ALTIJD op "interactive".
  - De app toont jouw zoekresultaat als een "Voorstel-kaart" in de chat. De gebruiker moet op "Toevoegen" klikken om het te accepteren.
  - Rapporteer in je bericht dat je de plek opzoekt en dat de gebruiker deze kan toevoegen via de kaart die verschijnt.
  - Conversatie in natuurlijk Nederlands, kort en helder.
  - Als de gebruiker iets "halverwege" of "tussenin" wilt, gebruik: [[SEARCH: <term> | NEAR: @MIDPOINT]].
  - Voor algemene categorieën (bijv. "Ik wil koffie", "Zoek een toilet"), gebruik ook de [[SEARCH]] tag met een NEAR referentie (bijv. NEAR: @CURRENT_ROUTE of NEAR: <referentiepunt>).

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
            const url = this.config.aiProvider === 'gemini' ? '/api/gemini' : '/api/groq';
            const response = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                console.warn(`[AI] /api/gemini returned ${response.status} ${response.statusText}`);
                const errText = await response.text().catch(() => "");
                console.warn("[AI] Response content:", errText);
                return null;
            }
            const data = await response.json();
            const text = data.text;
            if (!text) {
                console.warn("[AI] Response missing 'text' property:", data);
                return null;
            }

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
            console.error("AI Prompt Processing Failed:", e);
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

                        ### STRIKTE REGELS (ESSENTIEEL)
                        1. Doe GEEN aannames.
                        2. Als informatie niet met zekerheid bekend is: schrijf "Onbekend".
                        3. Gebruik alleen expliciet genoemde bronnen of meegeleverde data.
                        4. Vermijd verouderde informatie.
                        5. Schat de zekerheid in (Hoog / Middel / Laag), maar zet dit NIET in de tekst zelf.
                        6. Als bronnen elkaar tegenspreken: meld dit expliciet.

                        ### OUTPUT JSON
                        {
                            "description": "5-7 regels tekst",
                            "confidence": "Hoog | Middel | Laag"
                        }

                        Richtlijnen:
                        - Taal: ${this.config.language === 'nl' ? 'Nederlands' : 'English'}
                        - Focus: Wat is het en waarom is het interessant?
                        - Geen inleiding of afsluiting.
                        - Antwoord ENKEL met de JSON.

                        Start Nu.
                        `;

        const url = this.config.aiProvider === 'gemini' ? '/api/gemini' : '/api/groq';
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                const response = await apiFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt }),
                    signal
                });

                if (response.status === 429) {
                    const waitTime = 3000 * Math.pow(2, attempts); // slightly more aggressive reset
                    console.warn(`[AI] Rate Limited (429). Retrying in ${waitTime / 1000}s...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    attempts++;
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`[AI] Short description fetch failed: ${response.status}`, errorText);
                    return null;
                }
                const data = await response.json();
                // Strip Chain-of-Thought thinking blocks and markdown
                const cleanText = data.text
                    .replace(/<think>[\s\S]*?<\/think>/gi, '')
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();
                const result = JSON.parse(cleanText);

                const analyzed = this.analyzeSignals(poi, signals || []);
                const resolved = this.resolveConflicts(analyzed);

                return {
                    short_description: result.description || "",
                    image: resolved.image,
                    images: resolved.images,
                    structured_info: {
                        short_description: result.description || "",
                    }
                };
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                console.warn(`[AI] Attempt ${attempts + 1} failed:`, e);
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return null;
    }

    /**
     * STAGE 2: Deep Fetch - Full Details
     */
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
                        - Eerdere korte beschrijving: "${shortDesc}"

                        ### STRIKTE REGELS (ESSENTIEEL)
                        1. Doe GEEN aannames.
                        2. Belangrijk: De 'Eerdere korte beschrijving' bevat de gevalideerde basis. Als deze "Onbekend" zegt, mag jij GEEN geschiedenis of details verzinnen uit je eigen geheugen, tenzij de 'Context Data' hierboven expliciet nieuwe feiten levert.
                        3. Als informatie niet met zekerheid bekend is: schrijf "Onbekend".
                        4. Gebruik alleen expliciet die bronnen die in 'Context Data' staan.
                        5. Vermijd verouderde informatie.
                        6. Voor ELK veld in de JSON: schat de zekerheid in (Hoog / Middel / Laag).
                        7. Zet de zekerheid NOOIT in de tekstvelden zelf.
                        8. Als bronnen elkaar tegenspreken: meld dit expliciet in de beschrijving.

                        ### TAAK
                        Genereer de uitgebreide details in JSON formaat.

                        ### OUTPUT JSON (ALLEEN JSON, GEEN MARKDOWN, GEEN UITLEG)
                        Zorg dat de JSON valide is. Geen tekst voor of na de JSON.
                        {
                            "standard_version": {
                                "description": "10–15 regels tekst – duidelijke uitleg voor de meeste gebruikers.",
                                "fun_fact": "Eén boeiend weetje of anekdote.",
                                "confidence": "Hoog | Middel | Laag"
                            },
                            "extended_version": {
                                "full_description": "15–20 regels tekst, boeiend, diepgaand en duidelijk.",
                                "full_description_confidence": "Hoog | Middel | Laag",
                                "why_this_matches_your_interests": [
                                    "3–5 redenen waarom dit aansluit bij ${this.config.interests || 'Algemeen toerisme'}"
                                ],
                                "interests_confidence": "Hoog | Middel | Laag",
                                "fun_facts": [
                                    "2–4 leuke weetjes of anekdotes"
                                ],
                                "fun_facts_confidence": "Hoog | Middel | Laag",
                                "if_you_only_have_2_minutes": "Wat moet je écht gezien hebben?",
                                "highlight_confidence": "Hoog | Middel | Laag",
                                "visitor_tips": "Praktische info indien relevant.",
                                "tips_confidence": "Hoog | Middel | Laag"
                            }
                        }
                        `;

        const url = this.config.aiProvider === 'gemini' ? '/api/gemini' : '/api/groq';
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                const response = await apiFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt }),
                    signal
                });

                if (response.status === 429) {
                    const waitTime = 4000 * Math.pow(2, attempts); // Full details are heavier, wait longer
                    console.warn(`[AI] Rate Limited (429) on Full Details. Retrying in ${waitTime / 1000}s...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    attempts++;
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`[AI] Full details fetch failed: ${response.status}`, errorText);
                    return null;
                }
                const data = await response.json();
                // Strip Chain-of-Thought thinking blocks and markdown
                const cleanText = data.text
                    .replace(/<think>[\s\S]*?<\/think>/gi, '')
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();

                let result;
                try {
                    // Try to find JSON object if embedded in text
                    const jsonStart = cleanText.indexOf('{');
                    const jsonEnd = cleanText.lastIndexOf('}');

                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        result = JSON.parse(cleanText.substring(jsonStart, jsonEnd + 1));
                    } else {
                        result = JSON.parse(cleanText);
                    }
                } catch (jsonError) {
                    console.warn("JSON Parse Failed, falling back to raw text:", cleanText.substring(0, 50) + "...");
                    // Fallback structure
                    result = {
                        standard_version: { description: cleanText, confidence: "Laag" },
                        extended_version: { full_description: cleanText, full_description_confidence: "Laag" }
                    };
                }

                return {
                    structured_info: {
                        short_description: shortDesc || "", // Preserve short desc
                        full_description: result.extended_version?.full_description || result.standard_version?.description || "",
                        full_description_confidence: result.extended_version?.full_description_confidence || result.standard_version?.confidence || "Middel",
                        matching_reasons: result.extended_version?.why_this_matches_your_interests || [],
                        matching_reasons_confidence: result.extended_version?.interests_confidence || "Middel",
                        fun_facts: result.extended_version?.fun_facts || [],
                        fun_facts_confidence: result.extended_version?.fun_facts_confidence || "Middel",
                        two_minute_highlight: result.extended_version?.if_you_only_have_2_minutes || "",
                        two_minute_highlight_confidence: result.extended_version?.highlight_confidence || "Middel",
                        visitor_tips: result.extended_version?.visitor_tips || "",
                        visitor_tips_confidence: result.extended_version?.tips_confidence || "Middel",
                        standard_description: result.standard_version?.description || "", // Duplicated for safety
                        one_fun_fact: result.standard_version?.fun_fact || ""
                    },
                    ...this.resolveConflicts(this.analyzeSignals(poi, signals || []))
                };
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                console.warn(`[AI] Full Details attempt ${attempts + 1} failed:`, e);
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        return null;
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

    /**
     * STAGE 3: Image Analysis (Camera Scan)
     */
    async analyzeImage(base64Image, userLocation = null, signal = null) {
        console.log(`[PoiIntelligence] analyzeImage called. Image length: ${base64Image?.length}`);
        if (!base64Image) {
            console.error("[PoiIntelligence] No image data received");
            return null;
        }
        const prompt = `
            You are an expert city guide and architectural historian.
            Identify the building, landmark, statue, or object in this image.
            
            Context: The user is in ${this.config?.city || 'a city'} ${userLocation ? `at coordinates ${userLocation.lat}, ${userLocation.lng}` : ''}.
            
            If you invoke a specific landmark name, provide a JSON response with:
            {
                "name": "Name of the landmark",
                "short_description": "A 2-sentence summary of what it is.",
                "fun_fact": "One interesting fact about it.",
                "confidence": "high|medium|low"
            }

            If you cannot identify it with confidence, or if it's just a generic street/object, return:
            {
                "name": "Unknown",
                "short_description": "I couldn't quite identify this. Try getting closer or a different angle.",
                "confidence": "low"
            }

            Output ONLY valid JSON.
        `;

        try {
            const url = '/api/gemini';
            const response = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    image: base64Image.split(',')[1], // Send only base64 data, remove header
                    mimeType: 'image/jpeg'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`[AI] Image analysis failed: ${response.status}`, errorText);
                return null;
            }
            const data = await response.json();
            console.log("[PoiIntelligence] Raw API Response:", data);

            if (!data.text) {
                console.error("[PoiIntelligence] No text field in response");
                return null;
            }

            try {
                // Find the JSON block boundaries
                const startIndex = data.text.indexOf('{');
                const endIndex = data.text.lastIndexOf('}');

                if (startIndex === -1 || endIndex === -1) {
                    throw new Error("No JSON object found in response text");
                }

                const jsonString = data.text.substring(startIndex, endIndex + 1);
                const result = JSON.parse(jsonString);

                return {
                    ...result,
                    image: base64Image // Pass back the image so we can show it in the UI
                };
            } catch (parseError) {
                console.error("[PoiIntelligence] JSON Parse Error:", parseError, "Raw Text:", data.text);
                return null;
            }

        } catch (e) {
            console.error("Image Analysis Failed:", e);
            return null;
        }
    }

    async fetchGooglePlaceDetails(placeId, signal = null) {
        try {
            if (!this.config.googleKey) return null;
            const pId = encodeURIComponent(placeId);
            const key = this.config.googleKey;
            const lang = this.config.language;
            const fields = "name,editorial_summary,website,url,rating";
            // Exact URL pattern requested by user
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=${lang}&key=${key}`;

            const res = await fetch(url, { signal }).then(r => r.json());

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

    async fetchOverpassTags(poi, externalSignal = null) {
        if (!poi.lat || !poi.lng) return null;

        // OPTIMIZATION: Fetch all named objects within 50m instead of using slow Regex on server
        // We filter locally in JS which is much faster for small datasets
        const query = `[out:json][timeout:4];nwr(around:50,${poi.lat},${poi.lng})["name"];out tags;`;

        const servers = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
        ];

        let attempts = 0;
        const maxAttempts = servers.length; // Try each server once

        while (attempts < maxAttempts) {
            const serverIndex = attempts % servers.length;
            const currentServer = servers[serverIndex];
            const url = `${currentServer}?data=${encodeURIComponent(query)}`;

            try {
                const controller = new AbortController();
                // Short timeout for fast failover
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                if (externalSignal) {
                    if (externalSignal.aborted) {
                        clearTimeout(timeoutId);
                        return null;
                    }
                    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
                }

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.status === 429 || res.status >= 500) {
                    console.warn(`[Overpass] ${res.status} on ${currentServer}. Switching immediately...`);
                    attempts++;
                    continue; // IMMEDIATE FAILOVER (No sleep)
                }

                if (!res.ok) throw new Error(`Status ${res.status}`);

                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (jsonErr) {
                    console.warn(`[Overpass] Invalid JSON from ${currentServer}. Switching...`);
                    attempts++;
                    continue;
                }

                if (data.elements && data.elements.length > 0) {
                    // Client-side fuzzy matching
                    // Find the element that best matches the POI name
                    const targetName = poi.name.toLowerCase();

                    const match = data.elements.find(e => {
                        const name = (e.tags.name || "").toLowerCase();
                        return (name.includes(targetName) || targetName.includes(name)) &&
                            (e.tags['description:nl'] || e.tags.description || e.tags.website);
                    });

                    if (match && match.tags) {
                        const desc = match.tags['description:nl'] || match.tags.description || match.tags.comment;
                        const web = match.tags.website || match.tags.url || match.tags['contact:website'];

                        if (desc) {
                            return {
                                type: 'description',
                                source: 'OpenStreetMap',
                                content: desc,
                                link: web,
                                confidence: 0.85
                            };
                        }
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
                return null;

            } catch (e) {
                if (e.name === 'AbortError' && !externalSignal?.aborted) {
                    console.warn(`[Overpass] Timeout on ${currentServer}. Switching...`);
                } else if (e.name !== 'AbortError') {
                    console.warn(`[Overpass] Error on ${currentServer}: ${e.message}`);
                }
            }
            attempts++;
            // No sleep between attempts for maximum speed
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
            },
            "het volkstehuis": {
                description: "Het Volkstehuis in Hasselt (ABVV-gebouw) is een historisch pand dat symbool staat voor de sociale geschiedenis en de arbeidersbeweging in de stad. Het biedt vandaag de dag ruimte voor ontmoeting, advies en vakbondsdiensten.",
                link: "https://www.volkstehuis.be/"
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

    async fetchWikipedia(name, signal = null) {
        try {
            // Strategy 1: Context-aware search
            let query = `${name} ${this.config.city}`;
            let url = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            let searchRes = await fetch(url, { signal }).then(r => r.json());

            // Strategy 2: Retry with raw name if Context failed (or returned just the city)
            if (!searchRes.query?.search?.length || (searchRes.query.search.length > 0 && searchRes.query.search[0].title.toLowerCase() === this.config.city.toLowerCase())) {
                query = name;
                url = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
                searchRes = await fetch(url, { signal }).then(r => r.json());
            }

            if (!searchRes.query?.search?.length) return null;

            const bestMatch = searchRes.query.search[0];
            // Semantic Check: Reject if title is JUST the City Name (Generic)
            if (bestMatch.title.toLowerCase() === this.config.city.toLowerCase()) return null;

            const detailsUrl = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro&explaintext&piprop=original&redirects=1&titles=${encodeURIComponent(bestMatch.title)}&format=json&origin=*`;
            const details = await fetch(detailsUrl, { signal }).then(r => r.json());
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

    async fetchGoogleKnowledgeGraph(name, signal = null) {
        try {
            if (!this.config.googleKey) return null;
            const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(name + " " + this.config.city)}&key=${this.config.googleKey}&limit=1&languages=${this.config.language}`;
            const res = await fetch(url, { signal }).then(r => r.json());

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

    async fetchDuckDuckGo(name, externalSignal = null) {
        try {
            // Use local proxy to avoid CORS errors
            const url = `/api/ddg?q=${encodeURIComponent(name + " " + this.config.city)}`;

            // Short timeout 
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            if (externalSignal) {
                if (externalSignal.aborted) {
                    clearTimeout(timeoutId);
                    return null;
                }
                externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
            }

            const res = await apiFetch(url, { signal: controller.signal }).then(r => {
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

    async fetchGoogleSearch(poi, externalSignal = null) {
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
                    const endpoint = this.config.searchProvider === 'google' ? '/api/google-search' : '/api/tavily';
                    const searchUrl = `${endpoint}?q=${encodeURIComponent(q)}&num=5`;
                    const attempt = await apiFetch(searchUrl, { signal: externalSignal }).then(r => r.json());

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
                const endpoint = this.config.searchProvider === 'google' ? '/api/google-search' : '/api/tavily';
                url = `${endpoint}?q=${encodeURIComponent(name)}&num=5`;
                res = await apiFetch(url).then(r => r.json());
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
                        link: item.link,
                        image: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || null
                    };
                }).filter(s => s.text).map(s => {
                    // STRICTOR IMAGE FILTERING: Reject common "noise" images from search
                    const img = s.image;
                    if (img) {
                        const low = img.toLowerCase();
                        if (low.includes('logo') || low.includes('icon') || low.includes('placeholder') || low.includes('avatar') || low.includes('favicon') ||
                            low.includes('profile') || low.includes('user') || low.includes('author') || low.includes('member') || low.includes('review') || low.includes('testimonial')) {
                            return { ...s, image: null };
                        }
                    }
                    return s;
                });

                return {
                    type: 'description',
                    source: this.config.searchProvider === 'google' ? 'google_search' : 'tavily_search',
                    content: combinedSnippets.map(s => `[Link: ${s.link}] ${s.text}`).join('\n\n'),
                    link: res.items[0].link,
                    image: combinedSnippets.find(s => s.image)?.image,
                    images: [...new Set(combinedSnippets.map(s => s.image).filter(Boolean))],
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
            const url = (signal.link || "").toLowerCase();

            // GENERIC FIX: Semantic Domain Matching
            // If the URL contains the POI name, it's highly likely the official site
            if (this.isLikelyOfficialLink(poi.name, url)) {
                score = 0.95; // Maximum trust for official sites
            }

            // Detection: "Hasselt is de hoofdstad..."
            // ONLY penalize if the specific POI name is NOT in the text.
            if (text && (text.includes(this.config.city.toLowerCase() + " is") ||
                text.includes("hoofdstad") ||
                text.includes("provincie")) && !text.includes(poi.name.toLowerCase())) {
                score = Math.min(score, 0.1); // Keep the high score if it was official, otherwise drop. 
                // Actually, if it's official it won't have this generic text.
            }

            // Boost Search if it contains the exact name in the content
            if ((signal.source === 'google_search' || signal.source === 'tavily_search') && text.includes(poi.name.toLowerCase())) {
                score = Math.max(score, 0.9);
            }

            // Detection: Tag lists ("Museum, Building, Point of Interest")
            if (!text.includes(' ') || text.split(',').length > text.split('.').length * 2) {
                score = 0.2; // Junk
            }

            return { ...signal, score };
        });
    }

    isLikelyOfficialLink(poiName, link) {
        if (!link || !poiName) return false;
        try {
            const url = new URL(link);
            const domain = url.hostname.toLowerCase();
            const name = poiName.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Exact match (e.g. volkstehuis.be)
            if (domain.includes(name)) return true;

            // Partial match for common structures
            const fragments = poiName.toLowerCase().split(/\s+/).filter(f => f.length > 3);
            if (fragments.length > 0 && fragments.every(f => domain.includes(f))) return true;

            return false;
        } catch (e) {
            return false;
        }
    }

    resolveConflicts(signals) {
        // Sort by Trust Score
        const ranked = signals.sort((a, b) => b.score - a.score);

        if (ranked.length > 0 && ranked[0].score > 0.4) {
            // STRICTOR IMAGE RULE: Only take images from signals with EXTREMELY high confidence (>= 0.9)
            // This ensures we avoid generic search noise and only show "100% sure" photos (Wiki/Archive/High-Confidence G-Places).
            const highConfidenceSignals = ranked.filter(r => r.score >= 0.9);
            const allImages = [...new Set(highConfidenceSignals.flatMap(r => r.images || (r.image ? [r.image] : [])).filter(Boolean))];

            return {
                description: ranked[0].content,
                link: ranked[0].link,
                image: allImages[0] || null,
                images: allImages,
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

import { apiFetch } from "../utils/api.js";
import { safeSetItem } from "../utils/storageManager.js";

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


// Persistent module-level state for failure tracking (shares across instances)
const degradedProviders = {
    tavily: false,
    overpass: false,
    _lastUsageCheck: 0
};

/**
 * Shared helper to check/update Tavily quota proactively
 */
async function checkTavilyQuota() {
    // Only check once every 10 minutes to avoid spamming usage API
    if (Date.now() - degradedProviders._lastUsageCheck < 600000) return;
    degradedProviders._lastUsageCheck = Date.now();

    try {
        const response = await apiFetch('/api/tavily-usage');
        if (response.ok) {
            const usage = await response.json();
            // Free tier usually has 1000 credits. If remaining < 5, disable.
            if (usage.remaining_credits !== undefined && usage.remaining_credits < 5) {
                console.warn(`[Tavily] Proactive Disable: Only ${usage.remaining_credits} credits left.`);
                degradedProviders.tavily = true;
            }
        }
    } catch (e) {
        // If usage API fails, we don't necessarily disable search, just logs it
        console.warn("[Tavily] Usage check failed:", e);
    }
}

/**
 * Shared helper to push critical logs to the server
 */
async function logRemote(level, message, context = '') {
    try {
        await apiFetch('/api/logs/push', {
            method: 'POST',
            body: JSON.stringify({ level, message, context: `PoiIntelligence: ${context}` })
        });
    } catch (e) {
        // If logging itself fails, don't crash, just log locally
        console.warn("Failed to push remote log:", e);
    }
}

// --- POI Name Normalization ---

/**
 * Known synonym pairs for common POI naming variations.
 * Key = normalized alias → Value = canonical normalized form.
 * Unifies cross-source name matching (e.g. OSM vs Wikipedia vs search).
 */
const POI_SYNONYMS = {
    // Dutch ↔ English institution types
    'stadhuis': 'city hall',
    'gemeentehuis': 'city hall',
    'raadhuis': 'city hall',
    'town hall': 'city hall',
    'kerk': 'church',
    'basiliek': 'basilica',
    'kathedraal': 'cathedral',
    'kasteel': 'castle',
    'slot': 'castle',
    'burcht': 'castle',
    'abdij': 'abbey',
    'klooster': 'monastery',
    'markt': 'market square',
    'grote markt': 'market square',
    'plein': 'square',
    'brug': 'bridge',
    'toren': 'tower',
    'molen': 'windmill',
    'windmolen': 'windmill',
    'bibliotheek': 'library',
    'theater': 'theatre',
    'schouwburg': 'theatre',
    'bioscoop': 'cinema',
    'station': 'train station',
    'treinstation': 'train station',
    'ziekenhuis': 'hospital',
    'universiteit': 'university',
    'hogeschool': 'university',
    'sporthal': 'sports hall',
    'zwembad': 'swimming pool',
    'begraafplaats': 'cemetery',
    'kerkhof': 'cemetery',
    'haven': 'harbour',
    'jachthaven': 'marina',
};

/**
 * Normalize a POI name for cross-source matching.
 * - Lowercase
 * - Remove diacritics (NFD decomposition)
 * - Strip parenthetical suffixes: "Foo (Bar)" → "Foo"
 * - Remove punctuation (keep alphanumeric + spaces)
 * - Normalize whitespace
 * - Apply synonym dictionary for known POI type aliases
 *
 * @param {string} name
 * @returns {string} Normalized name
 */
function normalizePoiName(name) {
    if (!name) return '';

    let n = name
        .toLowerCase()
        .normalize('NFD')                    // Decompose: é → e + combining accent
        .replace(/[\u0300-\u036f]/g, '')     // Strip combining diacritic marks
        .replace(/\s*\([^)]*\)/g, '')        // Strip parenthetical suffixes
        .replace(/[^a-z0-9\s]/g, ' ')       // Remove punctuation, keep alphanumeric + spaces
        .replace(/\s+/g, ' ')               // Collapse multiple spaces
        .trim();

    // Apply synonym substitutions (whole-word match to avoid partial replacements)
    for (const [alias, canonical] of Object.entries(POI_SYNONYMS)) {
        const pattern = new RegExp(`\\b${alias}\\b`, 'g');
        n = n.replace(pattern, canonical);
    }

    return n;
}

// --- Cross-Source Similarity Helpers ---

/**
 * Bigram-based Jaccard similarity between two strings.
 * Deterministic, no external dependencies.
 * Returns a value in [0, 1]: 1 = identical, 0 = no overlap.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function _textSimilarity(a, b) {
    if (!a || !b) return 0;
    // Build bigram sets
    const bigrams = (str) => {
        const set = new Set();
        for (let i = 0; i < str.length - 1; i++) {
            set.add(str.slice(i, i + 2));
        }
        return set;
    };
    const setA = bigrams(a);
    const setB = bigrams(b);
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const bg of setA) {
        if (setB.has(bg)) intersection++;
    }
    return intersection / (setA.size + setB.size - intersection); // Jaccard
}

/**
 * Build a weighted agreement graph over scored signals.
 * Returns a symmetric n×n adjacency matrix of edge weights ∈ [0, 1].
 *
 * Edge weight between signals i and j is the sum of:
 *   +0.4  if both contents mention the POI name
 *   +0.3  if both share a category keyword
 *   +0–0.3 proportional to bigram Jaccard similarity of descriptions
 * Clamped to [0, 1].
 *
 * @param {Array} scoredSignals - Signals already scored by Pass 1
 * @param {string} poiName     - Normalized POI name
 * @returns {number[][]}        - n×n symmetric adjacency matrix
 */
function _buildSignalGraph(scoredSignals, poiName) {
    const n = scoredSignals.length;

    // Precompute normalized content once — reused for all pairs
    const contents = scoredSignals.map(s => normalizePoiName(s.content || ''));

    // Category keywords — signals sharing a keyword are considered category-aligned
    const CATEGORY_KEYWORDS = [
        'museum', 'church', 'cathedral', 'castle', 'abbey', 'monastery',
        'market', 'square', 'bridge', 'tower', 'windmill', 'library',
        'theatre', 'cinema', 'station', 'hospital', 'university', 'cemetery',
        'harbour', 'marina', 'park', 'garden', 'palace', 'monument',
    ];
    const categoryOf = text => CATEGORY_KEYWORDS.find(kw => text.includes(kw)) || null;

    // Initialize n×n matrix with zeros
    const graph = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        const ci = contents[i];
        const catI = categoryOf(ci);

        for (let j = i + 1; j < n; j++) {
            const cj = contents[j];
            const catJ = categoryOf(cj);

            let weight = 0;

            // Agreement 1: Both mention the POI name (+0.4)
            if (poiName.length > 2 && ci.includes(poiName) && cj.includes(poiName))
                weight += 0.4;

            // Agreement 2: Both share a category keyword (+0.3)
            if (catI !== null && catI === catJ)
                weight += 0.3;

            // Agreement 3: Description similarity — Jaccard × 0.3 (max +0.3)
            if (ci.length > 40 && cj.length > 40)
                weight += _textSimilarity(ci.substring(0, 300), cj.substring(0, 300)) * 0.3;

            const clamped = Math.min(1, weight);
            graph[i][j] = clamped;
            graph[j][i] = clamped; // symmetric
        }
    }

    return graph;
}

export class PoiIntelligence {
    constructor(config) {
        this.config = {
            ...config,
            aiProvider: config.aiProvider || 'groq',       // Default to Groq (free, fast)
            searchProvider: config.searchProvider || 'tavily', // Default to Tavily (free)
            enableExpensiveSearch: config.enableExpensiveSearch ?? false // Default OFF: skip web search when free signals suffice
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

    // --- Caching Helpers ---
    _getCacheKey(type, id, lang, variant = '') {
        return `poi_${type}_${id}_${lang}${variant ? '_' + variant : ''}`;
    }

    _getLocalCache(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            // 60 Days Expiration (5184000000 ms)
            if (Date.now() - parsed.timestamp > 5184000000) {
                localStorage.removeItem(key);
                console.log(`[Cache] Expired: ${key}`);
                return null;
            }
            console.log(`[Cache] Hit (Local): ${key}`);
            return parsed.data;
        } catch (e) {
            return null;
        }
    }

    _setLocalCache(key, data) {
        // Capping images array to save space in cache
        let slimData = data;
        if (data && Array.isArray(data.images)) {
            slimData = { ...data, images: data.images.slice(0, 3) };
        }

        const payload = { data: slimData, timestamp: Date.now(), version: "1.0" };
        safeSetItem(key, payload, 'poi_');
    }

    async _getCloudCache(key) {
        try {
            const response = await apiFetch(`/api/cloud-cache?key=${encodeURIComponent(key)}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.warn("Cloud Cache GET failure:", e);
        }
        return null; // Silent fail, fall back to AI
    }

    async _saveToCloud(key, data) {
        try {
            await apiFetch('/api/cloud-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key,
                    data,
                    language: this.config.language
                })
            });
        } catch (e) {
            console.error("Cloud Cache POST failure:", e);
        }
    }

    /**
     * Main pipeline to process a raw POI candidate.
     * Returns an enriched POI with confidence metadata.
     */
    async evaluatePoi(candidate) {
        // Step 0: Canonical Entity Resolution (optional enrichment — does NOT block pipeline)
        // Queries Wikidata to resolve a canonical identity for this POI before signal gathering.
        // Returns null safely on failure; existing behavior is completely unchanged.
        const canonical = await this.resolveCanonicalEntity(candidate);

        // Step 1: Existence & Data Gathering (Parallel Triangulation)
        const signals = await this.gatherSignals(candidate);

        // Step 2: Semantic Classification & Analysis
        const analyzed = this.analyzeSignals(candidate, signals);

        // Step 2b: Merge & structure signals for AI consumption
        // Produces a ranked, deduplicated payload instead of raw signal array.
        const merged = this.mergeSignals(analyzed);

        // Step 3: Gemini Synthesis (The Brain)
        // We feed the structured merged payload into Gemini.
        let bestData = null;

        // Check if proxy is available via simple health check or just try
        try {
            // Only call Gemini if we actually found something, OR if we want it to use internal knowledge (risky per rules)
            // The rule says "Only use provided data...".
            // If signals is empty, we probably shouldn't ask Gemini to hallucinate.
            // However, maybe it knows it? Rule: "If information is unknown... return null".
            // Let's passed analyzed signals.
            const geminiResult = await this.fetchGeminiDescription(candidate, merged, this.config.lengthMode || 'medium');
            if (geminiResult && geminiResult.structured_info?.full_description && geminiResult.structured_info.full_description !== 'unknown') {
                // Extract link and image from signals if Gemini didn't find a better one
                const signalData = this.resolveConflicts(analyzed);

                // We store the rich structure in structured_info
                bestData = {
                    description: (geminiResult.short_description || "") + "\n\n" + (geminiResult.structured_info.full_description || ""),
                    structured_info: geminiResult.structured_info,
                    link: geminiResult.link || signalData.link,
                    image: geminiResult.image || signalData.image,
                    images: geminiResult.images || signalData.images || [],
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
            canonical: canonical || null,
            description: bestData.description,
            short_description: bestData.structured_info?.short_description || bestData.description?.split('\n')[0] || "",
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

        // --- Phase 1: Cheap / Free signals (always run in parallel) ---
        const cheapQueries = [
            this.fetchLocalArchive(poi.name),
            this.fetchWikipedia(poi.name, signal),
            this.fetchDuckDuckGo(poi.name, signal),
            this.fetchOverpassTags(poi, signal),
        ];

        const cheapResults = await Promise.allSettled(cheapQueries);
        cheapResults.forEach(res => {
            if (res.status === 'fulfilled' && res.value) signals.push(res.value);
        });

        // --- Phase 2: Expensive search (conditional) ---
        // Skip fetchWebSearch if:
        //   - feature flag enableExpensiveSearch is false (default), AND
        //   - at least one of: wikipedia signal, official_site signal, or total trust >= 0.75
        const hasWikipedia = signals.some(s => s.source === 'wikipedia');
        const hasOfficialSite = signals.some(s => s.type === 'official_site' || s.source === 'official_website');
        const totalTrust = signals.reduce((sum, s) => sum + (s.confidence ?? 0), 0) /
            Math.max(signals.length, 1);
        const alreadyWellCovered = hasWikipedia || hasOfficialSite || totalTrust >= 0.75;

        const shouldSearch = this.config.enableExpensiveSearch || !alreadyWellCovered;

        if (shouldSearch) {
            console.log(`[gatherSignals] Running fetchWebSearch for "${poi.name}" ` +
                `(wiki:${hasWikipedia}, official:${hasOfficialSite}, avgTrust:${totalTrust.toFixed(2)})`);
            try {
                const webResult = await this.fetchWebSearch(poi, signal);
                if (webResult) signals.push(webResult);
            } catch (e) {
                console.warn('[gatherSignals] fetchWebSearch failed:', e.message);
            }
        } else {
            console.log(`[gatherSignals] Skipping fetchWebSearch for "${poi.name}" — already well-covered ` +
                `(wiki:${hasWikipedia}, official:${hasOfficialSite}, avgTrust:${totalTrust.toFixed(2)})`);
        }

        return signals;
    }

    // --- Canonical Entity Resolution ---

    /**
     * Name normalization helper for cross-source matching.
     * Lowercases, removes diacritics, strips parentheses, normalizes whitespace.
     * @param {string} name
     * @returns {string}
     */
    _normalizeNameForSearch(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .normalize('NFD')                        // Decompose diacritics (é → e + combining accent)
            .replace(/[\u0300-\u036f]/g, '')         // Strip combining diacritic marks
            .replace(/\s*\([^)]*\)/g, '')            // Strip parenthetical suffixes: "Foo (Bar)" → "Foo"
            .replace(/[^a-z0-9\s]/g, ' ')           // Replace remaining special chars with space
            .replace(/\s+/g, ' ')                    // Collapse multiple spaces
            .trim();
    }

    /**
     * Resolve a canonical Wikidata entity from a POI name + coordinates.
     * Runs BEFORE gatherSignals() as an optional enrichment layer.
     * Returns null safely on any failure — does NOT affect existing pipeline.
     *
     * @param {{ name: string, lat?: number, lng?: number }} poi
     * @returns {Promise<{
     *   canonicalName: string,
     *   wikidataId: string,
     *   aliases: string[],
     *   wikipediaUrl: string|null,
     *   officialWebsite: string|null,
     *   image: string|null,
     *   categories: string[]
     * }|null>}
     */
    async resolveCanonicalEntity(poi) {
        try {
            const normalizedName = this._normalizeNameForSearch(poi.name);
            if (!normalizedName) return null;

            const lang = this.config.language || 'en';

            // --- Step 1: Wikidata Entity Search ---
            const searchParams = new URLSearchParams({
                action: 'wbsearchentities',
                search: normalizedName,
                language: lang,
                uselang: lang,
                type: 'item',
                limit: '5',
                format: 'json',
                origin: '*'
            });
            const searchUrl = `https://www.wikidata.org/w/api.php?${searchParams}`;

            const controller1 = new AbortController();
            const timeout1 = setTimeout(() => controller1.abort(), 5000);
            const searchRes = await fetch(searchUrl, { signal: controller1.signal });
            clearTimeout(timeout1);

            if (!searchRes.ok) return null;
            const searchData = await searchRes.json();
            if (!searchData.search || searchData.search.length === 0) return null;

            // --- Step 2: Score candidates by name similarity ---
            const best = searchData.search.find(item => {
                const label = (item.label || '').toLowerCase();
                return label === normalizedName ||
                    label.includes(normalizedName) ||
                    normalizedName.includes(label);
            }) || searchData.search[0];

            if (!best || !best.id) return null;

            // --- Step 3: Fetch full entity claims ---
            // P18 = image, P856 = official website, P31 = instance of (categories)
            const entityParams = new URLSearchParams({
                action: 'wbgetentities',
                ids: best.id,
                props: 'labels|aliases|claims|sitelinks',
                languages: `${lang}|en`,
                sitefilter: `${lang}wiki|enwiki`,
                format: 'json',
                origin: '*'
            });
            const entityUrl = `https://www.wikidata.org/w/api.php?${entityParams}`;

            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 5000);
            const entityRes = await fetch(entityUrl, { signal: controller2.signal });
            clearTimeout(timeout2);

            if (!entityRes.ok) return null;
            const entityData = await entityRes.json();
            const entity = entityData.entities?.[best.id];
            if (!entity) return null;

            // --- Step 4: Extract structured data ---

            // Canonical name: prefer configured language, fallback to English, fallback to search label
            const canonicalName =
                entity.labels?.[lang]?.value ||
                entity.labels?.en?.value ||
                best.label ||
                poi.name;

            // Aliases in the configured language
            const aliases = (entity.aliases?.[lang] || entity.aliases?.en || [])
                .map(a => a.value)
                .slice(0, 10);

            // Wikipedia URL from sitelinks
            const wikiSiteKey = `${lang}wiki`;
            const wikiTitle = entity.sitelinks?.[wikiSiteKey]?.title ||
                entity.sitelinks?.enwiki?.title;
            const wikiLang = entity.sitelinks?.[wikiSiteKey]?.title ? lang : 'en';
            const wikipediaUrl = wikiTitle
                ? `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`
                : null;

            // Official website (P856)
            const officialWebsite =
                entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value || null;

            // Image (P18) — Wikimedia Commons filename → direct URL
            const imageFile = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
            let image = null;
            if (imageFile) {
                const encoded = encodeURIComponent(imageFile.replace(/ /g, '_'));
                image = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=800`;
            }

            // Categories from P31 (instance of) — Wikidata IDs (e.g. Q33506 = museum)
            const categories = (entity.claims?.P31 || [])
                .map(c => c.mainsnak?.datavalue?.value?.id)
                .filter(Boolean)
                .slice(0, 5);

            console.log(`[Canonical] Resolved "${poi.name}" → "${canonicalName}" (${best.id})`);

            return {
                canonicalName,
                wikidataId: best.id,
                aliases,
                wikipediaUrl,
                officialWebsite,
                image,
                categories
            };

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn(`[Canonical] resolveCanonicalEntity failed for "${poi.name}":`, e.message);
            }
            return null; // Safe null — pipeline continues unchanged
        }
    }

    // --- Gemini Integration ---

    /**
     * Generates a personalized city welcome message for the tour.
     */
    async fetchCityWelcomeMessage(poiList, signal = null) {
        const poiNames = poiList.slice(0, 8).map(p => p.name).join(', ');
        const isNl = this.config.language === 'nl';
        const prompt = isNl ? `
Je bent "Je Gids", een ervaren, vriendelijke en enthousiaste digitale stadsgids die reizigers helpt een stad op een persoonlijke manier te ontdekken.
Je taak is om een introductie te geven voor de wandeling of fietstocht begint.

### CONTEXT
De citynavigation-app heeft een tocht aangemaakt op basis van:
- De gekozen stad: ${this.config.city}
- De interesses van de gebruiker: ${this.config.interests || 'Algemeen'}
- De geselecteerde POI's langs de route: ${poiNames}
- Eventuele thema's of routecontext: ${this.config.routeContext || 'Stadswandeling'}

### DOEL
Genereer een inspirerende, warme en duidelijke inleiding voor de tocht, die:
1. De gebruiker welkom heet in ${this.config.city}
2. Kort vertelt wat deze tocht bijzonder maakt
3. Op een natuurlijke manier verwijst naar de interesses van de gebruiker
4. Een beeld schetst van wat de bezoeker kan verwachten langs de route
5. Het gevoel geeft dat dit een persoonlijke, zorgvuldig samengestelde route is
6. Niet te veel verklapt over elke POI (dat gebeurt later), maar wel prikkelt
7. Een menselijke, bezoekersvriendelijke toon gebruikt (niet encyclopedisch)
8. Schrijf UITSLUITEND in het NEDERLANDS.

### OUTPUTSTRUCTUUR
Geef de output als een vloeiende tekst van 6 tot 10 zinnen, met:
- Een warme begroeting
- Een korte introductie tot de stad
- Een teaser van de tocht (stijl, sfeer, wat uniek is)
- Verwijzing naar interesses van de gebruiker
- Een uitnodiging om te vertrekken

### STIJLREGELS & STRIKTE NAUWKEURIGHEID
1. Doe GEEN aannames over specifieke POI-kenmerken die niet in de input staan.
2. Als informatie niet met zekerheid bekend is: laat het weg.
3. Gebruik alleen expliciet genoemde bronnen of meegeleverde data.
4. Vermijd verouderde informatie.
5. Gebruik duidelijke, natuurlijke, enthousiasmerende taal.
6. Schrijf als een lokale gids die de stad goed kent.
7. Maak het menselijk, warm en persoonlijk.
8. Noem de POI's niet allemaal een voor een op; houd het high-level maar pakkend.

### START NU
Genereer de introductie in het NEDERLANDS voor de tocht in ${this.config.city}.
` : `
You are "Your Guide", an experienced, friendly and enthusiastic digital city guide helping travellers discover a city in a personal way.
Your task is to provide an introduction before the walk or cycling tour begins.

### CONTEXT
The city navigation app has created a tour based on:
- The chosen city: ${this.config.city}
- The user's interests: ${this.config.interests || 'General sightseeing'}
- The selected POIs along the route: ${poiNames}
- Any themes or route context: ${this.config.routeContext || 'City walk'}

### GOAL
Generate an inspiring, warm and clear introduction for the tour that:
1. Welcomes the user to ${this.config.city}
2. Briefly explains what makes this tour special
3. Naturally references the user's interests
4. Paints a picture of what the visitor can expect along the route
5. Gives the feeling that this is a personal, carefully curated route
6. Does not reveal too much about each POI (that comes later), but teases
7. Uses a human, visitor-friendly tone (not encyclopaedic)
8. Is written ENTIRELY IN ENGLISH.

### OUTPUT STRUCTURE
Provide the output as one flowing text of 6 to 10 sentences, with:
- A warm greeting
- A brief introduction to the city
- A teaser of the tour (style, atmosphere, what is unique)
- Reference to the user's interests
- An invitation to set off

### STYLE RULES & STRICT ACCURACY
1. Do NOT make assumptions about specific POI characteristics not mentioned in the input.
2. If information is not known with certainty: leave it out.
3. Only use explicitly mentioned sources or provided data.
4. Avoid outdated information.
5. Use clear, natural, enthusiastic language.
6. Write as a local guide who knows the city well.
7. Make it human, warm and personal.
8. Do not list all POIs one by one; keep it high-level but engaging.

### START NOW
Generate the introduction IN ENGLISH for the tour in ${this.config.city}.
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
        const cacheKey = this._getCacheKey('arrival', locationName.replace(/\s+/g, '_'), language);

        // 1. Check Local Cache
        const local = this._getLocalCache(cacheKey);
        if (local) return local;

        // 2. Check Cloud Cache
        const cloud = await this._getCloudCache(cacheKey);
        if (cloud) {
            this._setLocalCache(cacheKey, cloud); // Sync back to local
            return cloud;
        }

        const isNlArrival = language === 'nl';
        const prompt = isNlArrival ? `
Je bent een lokale gids in ${city}. De gebruiker start zijn route aan: "${locationName}".
GEEF SPECIFIEKE parkeer/reis instructies voor DEZE EXACTE locatie.

REGELS:
1. Is "${locationName}" een specifieke plek? Geef dan de parkeer/bus info die DAAR vlakbij is.
2. Is "${locationName}" generiek (alleen de stadsnaam)? Geef dan een algemene suggestie voor het centrum.
3. Doe GEEN aannames over parkeertarieven of exacte busnummers als je het niet zeker weet.
4. Als de parkeerinfo niet bekend is: schrijf "Parkeergegevens onbekend".

DOEL: 2 korte, praktische zinnen. Schrijf UITSLUITEND in het NEDERLANDS.
` : `
You are a local guide in ${city}. The user starts their route at: "${locationName}".
PROVIDE SPECIFIC parking/travel instructions for THIS EXACT location.

RULES:
1. Is "${locationName}" a specific place? Give the parking/bus info closest to THAT location.
2. Is "${locationName}" generic (just the city name)? Give a general suggestion for the city centre.
3. Do NOT make assumptions about parking rates or exact bus numbers if you are not certain.
4. If parking info is not known for this specific place: write "Parking information unknown".

GOAL: 2 short, practical sentences. Write ENTIRELY IN ENGLISH.
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

                // Save to caches
                if (text) {
                    this._setLocalCache(cacheKey, text);
                    this._saveToCloud(cacheKey, text);
                }

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

            // Strip Chain-of-Thought thinking blocks (<think>...</think>)
            // 1. Remove all closed blocks
            let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            // 2. Handle a potentially unclosed trailing think block
            const thinkStart = cleanText.indexOf('<think>');
            if (thinkStart !== -1) {
                cleanText = cleanText.substring(0, thinkStart).trim();
            }

            // Handle markdown code blocks
            cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();

            // Find the actual JSON object to be extra safe
            const jsonStart = cleanText.indexOf('{');
            const jsonEnd = cleanText.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
            } else if (jsonStart !== -1) {
                cleanText = cleanText.substring(jsonStart);
            }

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
     * Helper: Check if short description is cached (sync)
     */
    getCachedShortDescription(poi) {
        const cacheKey = this._getCacheKey('short', poi.id || poi.name.replace(/\s+/g, '_'), this.config.language);
        return this._getLocalCache(cacheKey);
    }

    /**
     * Helper: Check if full details are cached (sync)
     */
    getCachedFullDetails(poi) {
        const cacheKey = this._getCacheKey('full', poi.id || poi.name.replace(/\s+/g, '_'), this.config.language, this.config.interests);
        return this._getLocalCache(cacheKey);
    }

    /**
     * STAGE 1: Fast Fetch - Description Only
     */
    async fetchGeminiShortDescription(poi, merged, signal = null) {
        const cacheKey = this._getCacheKey('short', poi.id || poi.name.replace(/\s+/g, '_'), this.config.language);

        // 1. Check Local Cache
        const local = this._getLocalCache(cacheKey);
        if (local) {
            console.log(`[Source] ${poi.name}: Local Cache Hit`);
            return local;
        }

        // 2. Check Cloud Cache
        const cloud = await this._getCloudCache(cacheKey);
        if (cloud) {
            console.log(`[Source] ${poi.name}: Cloud Cache Hit`);
            this._setLocalCache(cacheKey, cloud);
            return cloud;
        }

        // 3. API Call
        console.log(`[Source] ${poi.name}: Fetching fresh data from AI...`);

        // Backward-compat: accept raw signals array from legacy callers
        if (Array.isArray(merged)) {
            merged = this.mergeSignals(this.analyzeSignals(poi, merged));
        }

        // Build structured context from merged signal payload
        const rawContext = merged.descriptionCandidates.length > 0
            ? [
                `## Verified Descriptions (ranked by trust):`,
                ...merged.descriptionCandidates,
                merged.website ? `## Official Website: ${merged.website}` : '',
                merged.facts.length ? `## Quick Facts:\n${merged.facts.map(f => `- ${f}`).join('\n')}` : '',
                merged.categories.length ? `## Source Verification: ${merged.categories.join(', ')}` : '',
            ].filter(Boolean).join('\n\n')
            : "No external data signals found.";
        const contextData = rawContext.length > 2000 ? rawContext.substring(0, 2000) + '\n[...truncated]' : rawContext;

        const isNlShort = this.config.language === 'nl';
        const prompt = isNlShort ? `
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
                            "description": "5-7 regels tekst in het NEDERLANDS",
                            "confidence": "Hoog | Middel | Laag"
                        }

                        Richtlijnen:
                        - Schrijf UITSLUITEND in het NEDERLANDS.
                        - Focus: Wat is het en waarom is het interessant?
                        - Geen inleiding of afsluiting.
                        - Antwoord ENKEL met de JSON.

                        Start Nu.
                        ` : `
                        You are a fast, efficient guide.
                        Write one engaging, informative description of 5-7 lines for "${poi.name}" (${this.config.city}).
                        Use this context where relevant: ${contextData}

                        ### STRICT RULES (ESSENTIAL)
                        1. Do NOT make assumptions.
                        2. If information is not known with certainty: write "Unknown".
                        3. Only use explicitly mentioned sources or provided data.
                        4. Avoid outdated information.
                        5. Estimate confidence (High / Medium / Low), but do NOT put this in the text itself.
                        6. If sources contradict each other: mention this explicitly.

                        ### OUTPUT JSON
                        {
                            "description": "5-7 lines of text IN ENGLISH",
                            "confidence": "High | Medium | Low"
                        }

                        Guidelines:
                        - Write ENTIRELY IN ENGLISH.
                        - Focus: What is it and why is it interesting?
                        - No introduction or conclusion.
                        - Reply ONLY with the JSON.

                        Start Now.
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
                const result = this._parseAiJson(data.text);
                if (!result) return null;

                const resolved = this.resolveConflicts([]);

                const finalResult = {
                    short_description: result.description || "",
                    image: merged.images?.[0] || null,
                    images: merged.images || [],
                    structured_info: {
                        short_description: result.description || "",
                    }
                };

                // Save to Cache
                this._setLocalCache(cacheKey, finalResult);
                this._saveToCloud(cacheKey, finalResult);

                return finalResult;
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

    async fetchGeminiFullDetails(poi, merged, shortDesc, signal = null) {
        const cacheKey = this._getCacheKey('full', poi.id || poi.name.replace(/\s+/g, '_'), this.config.language, this.config.interests);

        // 1. Check Local Cache
        const local = this._getLocalCache(cacheKey);
        if (local) {
            console.log(`[Source] ${poi.name} (Full): Local Cache Hit`);
            return local;
        }

        // 2. Check Cloud Cache
        const cloud = await this._getCloudCache(cacheKey);
        if (cloud) {
            console.log(`[Source] ${poi.name} (Full): Cloud Cache Hit`);
            this._setLocalCache(cacheKey, cloud);
            return cloud;
        }

        // 3. API Call
        console.log(`[Source] ${poi.name} (Full): Fetching fresh details from AI...`);

        // Backward-compat: accept raw signals array from legacy callers (e.g. App.jsx)
        if (Array.isArray(merged)) {
            merged = this.mergeSignals(this.analyzeSignals(poi, merged));
        }

        // Build structured context from merged signal payload
        const rawContextFull = merged.descriptionCandidates.length > 0
            ? [
                `## Verified Descriptions (ranked by trust):`,
                ...merged.descriptionCandidates,
                merged.website ? `## Official Website: ${merged.website}` : '',
                merged.facts.length ? `## Quick Facts:\n${merged.facts.map(f => `- ${f}`).join('\n')}` : '',
                merged.categories.length ? `## Source Verification: ${merged.categories.join(', ')}` : '',
            ].filter(Boolean).join('\n\n')
            : "No external data signals found.";
        const contextData = rawContextFull.length > 2000 ? rawContextFull.substring(0, 2000) + '\n[...truncated]' : rawContextFull;

        const isNlFull = this.config.language === 'nl';
        const prompt = isNlFull ? `
                        Je bent een ervaren lokale gids. We hebben al een korte beschrijving van "${poi.name}".
                        Nu willen we de diepte in.

                        ### CONTEXT
                        - POI: ${poi.name}
                        - Stad: ${this.config.city}
                        - Interesses: ${this.config.interests || 'Algemeen'}
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
                        9. Schrijf ALLE tekstvelden UITSLUITEND in het NEDERLANDS.

                        ### TAAK
                        Genereer de uitgebreide details in JSON formaat.

                        ### OUTPUT JSON (ALLEEN JSON, GEEN MARKDOWN, GEEN UITLEG)
                        Zorg dat de JSON valide is. Geen tekst voor of na de JSON.
                        {
                            "standard_version": {
                                "description": "10-15 regels tekst in het NEDERLANDS.",
                                "fun_fact": "Een boeiend weetje of anekdote in het NEDERLANDS.",
                                "confidence": "Hoog | Middel | Laag"
                            },
                            "extended_version": {
                                "full_description": "15-20 regels tekst in het NEDERLANDS, boeiend, diepgaand en duidelijk.",
                                "full_description_confidence": "Hoog | Middel | Laag",
                                "why_this_matches_your_interests": [
                                    "3-5 redenen in het NEDERLANDS waarom dit aansluit bij ${this.config.interests || 'Algemeen toerisme'}"
                                ],
                                "interests_confidence": "Hoog | Middel | Laag",
                                "fun_facts": [
                                    "2-4 leuke weetjes of anekdotes in het NEDERLANDS"
                                ],
                                "fun_facts_confidence": "Hoog | Middel | Laag",
                                "if_you_only_have_2_minutes": "Wat moet je echt gezien hebben? In het NEDERLANDS.",
                                "highlight_confidence": "Hoog | Middel | Laag",
                                "visitor_tips": "Praktische info in het NEDERLANDS indien relevant.",
                                "tips_confidence": "Hoog | Middel | Laag"
                            }
                        }
                        ` : `
                        You are an experienced local guide. We already have a short description of "${poi.name}".
                        Now we want to go deeper.

                        ### CONTEXT
                        - POI: ${poi.name}
                        - City: ${this.config.city}
                        - Interests: ${this.config.interests || 'General sightseeing'}
                        - Context Data: ${contextData}
                        - Previous short description: "${shortDesc}"

                        ### STRICT RULES (ESSENTIAL)
                        1. Do NOT make assumptions.
                        2. Important: The 'Previous short description' contains the validated basis. If it says "Unknown", you may NOT invent history or details from your own memory, unless the 'Context Data' above explicitly provides new facts.
                        3. If information is not known with certainty: write "Unknown".
                        4. Only use sources explicitly listed in 'Context Data'.
                        5. Avoid outdated information.
                        6. For EVERY field in the JSON: estimate confidence (High / Medium / Low).
                        7. NEVER put the confidence in the text fields themselves.
                        8. If sources contradict each other: mention this explicitly in the description.
                        9. Write ALL text fields ENTIRELY IN ENGLISH.

                        ### TASK
                        Generate the detailed information in JSON format.

                        ### OUTPUT JSON (JSON ONLY, NO MARKDOWN, NO EXPLANATION)
                        Ensure the JSON is valid. No text before or after the JSON.
                        {
                            "standard_version": {
                                "description": "10-15 lines of text IN ENGLISH.",
                                "fun_fact": "One interesting fact or anecdote IN ENGLISH.",
                                "confidence": "High | Medium | Low"
                            },
                            "extended_version": {
                                "full_description": "15-20 lines of text IN ENGLISH, engaging, in-depth and clear.",
                                "full_description_confidence": "High | Medium | Low",
                                "why_this_matches_your_interests": [
                                    "3-5 reasons IN ENGLISH why this matches ${this.config.interests || 'general tourism'}"
                                ],
                                "interests_confidence": "High | Medium | Low",
                                "fun_facts": [
                                    "2-4 fun facts or anecdotes IN ENGLISH"
                                ],
                                "fun_facts_confidence": "High | Medium | Low",
                                "if_you_only_have_2_minutes": "What must you really see? IN ENGLISH.",
                                "highlight_confidence": "High | Medium | Low",
                                "visitor_tips": "Practical info IN ENGLISH if relevant.",
                                "tips_confidence": "High | Medium | Low"
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
                const result = this._parseAiJson(data.text);
                if (!result) return null;

                const finalResult = {
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
                    ...this.resolveConflicts([]),
                    image: merged.images?.[0] || null,
                    images: merged.images || [],
                    link: merged.website || null,
                };

                // Save to Cache
                this._setLocalCache(cacheKey, finalResult);
                this._saveToCloud(cacheKey, finalResult);

                return finalResult;
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
                // Strip Chain-of-Thought thinking blocks
                const rawText = (data.text || "").replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                // Find the JSON block boundaries
                const startIndex = rawText.indexOf('{');
                const endIndex = rawText.lastIndexOf('}');

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
        const query = `[out:json][timeout:12];nwr(around:50,${poi.lat},${poi.lng})["name"];out tags;`;

        const servers = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.openstreetmap.fr/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.osm.ch/api/interpreter'
        ];

        let attempts = 0;
        const maxAttempts = servers.length; // Try each server once
        // Randomize starting server to avoid hammering the first one
        let serverIndex = Math.floor(Math.random() * servers.length);

        if (degradedProviders.overpass) return null;

        while (attempts < maxAttempts) {
            const currentServer = servers[serverIndex];
            // Rotate to next server for subsequent attempts
            serverIndex = (serverIndex + 1) % servers.length;
            const url = `${currentServer}?data=${encodeURIComponent(query)}`;

            try {
                const controller = new AbortController();
                // Timeout 12s to match Overpass standard
                const timeoutId = setTimeout(() => controller.abort(), 12000);

                // Add jitter to prevent thundering herd (0-1000ms delay)
                const jitter = Math.floor(Math.random() * 1000);
                await new Promise(r => setTimeout(r, jitter));

                if (externalSignal) {
                    if (externalSignal.aborted) {
                        clearTimeout(timeoutId);
                        return null;
                    }
                    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
                }

                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'CityExplorer/1.0 (Student Project; educational use)',
                        'Accept': 'application/json'
                    }
                });
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
                    const targetName = normalizePoiName(poi.name);

                    const match = data.elements.find(e => {
                        const osmName = normalizePoiName(e.tags.name || "");
                        return (osmName.includes(targetName) || targetName.includes(osmName)) &&
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
                            // Upgrade: try to scrape the official site for real content
                            const siteSignal = await this.fetchOfficialWebsite(web, externalSignal);
                            if (siteSignal) return siteSignal;

                            // Fallback: return link_only if scraping failed or timed out
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

        // If we reach here, all servers failed
        console.error("[Overpass] All servers failed. Marking provider as degraded.");
        logRemote('error', 'All Overpass servers failed. Circuit breaker active.', `fetchOverpassTags [${this.config.city}]`);
        degradedProviders.overpass = true;
        return null;
    }

    /**
     * Fetches and parses an official website URL found in OSM tags.
     * Uses the /api/scrape-meta backend proxy to avoid CORS restrictions.
     * Returns a high-trust 'official_site' signal, or null on failure.
     *
     * @param {string} url - The official website URL from OSM
     * @param {AbortSignal} [externalSignal]
     * @returns {Promise<{ type, source, content, link, confidence }|null>}
     */
    async fetchOfficialWebsite(url, externalSignal = null) {
        if (!url) return null;

        try {
            const controller = new AbortController();
            // 8s client timeout (proxy adds its own 6s server-side)
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            if (externalSignal) {
                if (externalSignal.aborted) { clearTimeout(timeoutId); return null; }
                externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
            }

            const proxyUrl = `/api/scrape-meta?url=${encodeURIComponent(url)}`;
            const res = await apiFetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) return null;
            const data = await res.json();

            if (!data.found || !data.description) return null;

            // Combine title + description for richer AI context
            const content = data.title
                ? `${data.title}: ${data.description}`
                : data.description;

            // Limit content length for AI prompt safety
            const truncated = content.length > 800 ? content.substring(0, 800) + '…' : content;

            console.log(`[OfficialSite] Scraped "${url}": ${truncated.length} chars`);

            return {
                type: 'official_site',
                source: 'official_website',
                content: truncated,
                link: url,
                confidence: 0.95
            };

        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn(`[OfficialSite] Failed to scrape "${url}":`, e.message);
            }
            return null; // Safe null — fetchOverpassTags falls back to link_only
        }
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

        const n = (name || "").toLowerCase();
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
            const cityLower = (this.config.city || "").toLowerCase();
            if (!searchRes.query?.search?.length || (searchRes.query.search.length > 0 && searchRes.query.search[0].title.toLowerCase() === cityLower)) {
                query = name;
                url = `https://${this.config.language}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
                searchRes = await fetch(url, { signal }).then(r => r.json());
            }

            if (!searchRes.query?.search?.length) return null;

            const bestMatch = searchRes.query.search[0];
            // Semantic Check: Reject if title is JUST the City Name (Generic)
            if (bestMatch.title.toLowerCase() === cityLower) return null;

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

    async fetchWebSearch(poi, externalSignal = null) {
        try {
            const name = poi.name;
            const cleanName = normalizePoiName(name); // Normalize: diacritics, synonyms, punctuation
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

            // Proactively check quota if using Tavily
            if (this.config.searchProvider === 'tavily' && !degradedProviders.tavily) {
                checkTavilyQuota(); // Non-blocking
            }

            // Try queries in order until we get a hit
            for (const q of queriesToTry) {
                try {
                    let provider = this.config.searchProvider;

                    // CIRCUIT BREAKER: If Tavily is degraded, force Google silently
                    if (provider === 'tavily' && degradedProviders.tavily) {
                        provider = 'google';
                    }

                    let endpoint = provider === 'google' ? '/api/google-search' : '/api/tavily';
                    let searchUrl = `${endpoint}?q=${encodeURIComponent(q)}&num=5`;
                    let response = await apiFetch(searchUrl, { signal: externalSignal });
                    let attempt = await response.json().catch(() => ({ error: "Parsing failed" }));

                    if (provider !== 'google' && (response.status !== 200 || attempt.error)) {
                        console.warn(`[Search] ${provider} failed (${response.status}). marking as DEGRADED.`);
                        logRemote('warning', `${provider} Search failed with status ${response.status}. Marking as degraded.`, `fetchWebSearch [${q}]`);

                        // Mark as degraded if it's a structural error (Quota=429, Auth=401/403, Account=432, or Server Down=5xx)
                        if (response.status >= 400 || response.status === 432 || attempt.error) {
                            degradedProviders[provider] = true;
                        }

                        // Fallback to Google if Tavily failed
                        if (provider === 'tavily') {
                            endpoint = '/api/google-search';
                            searchUrl = `${endpoint}?q=${encodeURIComponent(q)}&num=5`;
                            response = await apiFetch(searchUrl, { signal: externalSignal });
                            attempt = await response.json().catch(() => ({ error: "Google Parsing failed" }));
                        }
                    }

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

                let provider = this.config.searchProvider;
                if (provider === 'tavily' && degradedProviders.tavily) {
                    provider = 'google';
                }

                const endpoint = provider === 'google' ? '/api/google-search' : '/api/tavily';
                const url = `${endpoint}?q=${encodeURIComponent(name)}&num=5`;
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
                        // Block by filename/path keywords
                        if (low.includes('logo') || low.includes('icon') || low.includes('brand') ||
                            low.includes('banner') || low.includes('header') ||
                            low.includes('placeholder') || low.includes('avatar') || low.includes('favicon') ||
                            low.includes('profile') || low.includes('user') || low.includes('author') ||
                            low.includes('member') || low.includes('review') || low.includes('testimonial')) {
                            return { ...s, image: null };
                        }
                        // Block by known non-POI image domains (app stores, social media, generic CDNs, aggregators)
                        const noiseDomains = [
                            'mzstatic.com',       // Apple App Store images
                            'apps.apple.com',
                            'play.google.com',
                            'googleplay.com',
                            'facebook.com',
                            'fbcdn.net',          // Facebook CDN
                            'twimg.com',          // Twitter/X images
                            'instagram.com',
                            'youtube.com',
                            'ytimg.com',          // YouTube thumbnails
                            'wikipedia.org/static', // Wikipedia logos/icons
                            'wikimedia.org/static',
                            'gravatar.com',
                            'wp-content/plugins', // WordPress plugin images
                            'captcha',
                            'recaptcha',
                            'skyscanner',         // Avoid Skyscanner logo/branding
                            'tripadvisor',        // Avoid TripAdvisor logo/branding
                            'expedia',            // Avoid Expedia branding
                            'booking.com',        // Avoid Booking branding
                        ];
                        if (noiseDomains.some(domain => low.includes(domain))) {
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
        if (!poi) return [];
        const poiName = normalizePoiName(poi.name || "Unknown Location");

        // --- Pass 1: Per-signal heuristic scoring ---
        const scored = signals.map(signal => {
            // Heuristic: Penalize generic city descriptions
            let score = signal.confidence || 0.5;
            const text = normalizePoiName(signal.content || "");
            const url = (signal.link || "").toLowerCase();

            // GENERIC FIX: Semantic Domain Matching
            // If the URL contains the POI name, it's highly likely the official site
            if (this.isLikelyOfficialLink(poiName, url)) {
                score = 0.95; // Maximum trust for official sites
            }

            // Detection: "Hasselt is de hoofdstad..."
            // ONLY penalize if the specific POI name is NOT in the text.
            if (text && (text.includes(this.config.city.toLowerCase() + " is") ||
                text.includes("hoofdstad") ||
                text.includes("provincie")) && !text.includes(poiName)) {
                score = Math.min(score, 0.1);
            }

            // Boost Search if it contains the normalized name in the content
            if ((signal.source === 'google_search' || signal.source === 'tavily_search') && text.includes(poiName)) {
                score = Math.max(score, 0.9);
            }

            // Detection: Tag lists ("Museum, Building, Point of Interest")
            if (!text.includes(' ') || text.split(',').length > text.split('.').length * 2) {
                score = 0.2; // Junk
            }

            return { ...signal, score };
        });

        // --- Pass 2: Graph-based trust scoring ---
        // Build a weighted agreement graph; compute weighted degree centrality
        // per node; blend into final score: baseScore + centrality × 0.3 (max +0.30).
        if (scored.length >= 2) {
            const graph = _buildSignalGraph(scored, poiName);
            const n = scored.length;

            const result = scored.map((s, i) => {
                // Weighted degree centrality: sum of edge weights / (n-1)
                const degreeSum = graph[i].reduce((acc, w) => acc + w, 0);
                const centrality = degreeSum / Math.max(n - 1, 1); // normalize to [0, 1]

                const finalScore = Math.min(1.0, s.score + centrality * 0.3);

                return {
                    ...s,
                    score: finalScore,
                    graphCentrality: parseFloat(centrality.toFixed(3))
                };
            });

            const boostedCount = result.filter(s => s.graphCentrality > 0).length;
            if (boostedCount > 0) {
                console.log(`[analyzeSignals] Graph scoring: ${boostedCount}/${n} signals have non-zero centrality for "${poi.name}"`);
            }
            return result;
        }

        return scored;
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

    /**
     * Merges and deduplicates scored signals into a structured payload for AI prompts.
     * Runs after analyzeSignals() and before Gemini stages.
     *
     * @param {Array} scoredSignals - Output of analyzeSignals() (signals with .score)
     * @returns {{
     *   descriptionCandidates: string[],
     *   categories: string[],
     *   images: string[],
     *   website: string|null,
     *   facts: string[]
     * }}
     */
    mergeSignals(scoredSignals) {
        // Sort descending by trust score
        const ranked = [...scoredSignals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        // --- Description candidates ---
        // Collect content from trusted signals (score >= 0.4), deduplicate similar text
        const descriptionCandidates = [];
        const seenFingerprints = new Set();

        for (const signal of ranked) {
            if (!signal.content || (signal.score ?? 0) < 0.4) continue;

            // Fingerprint: first 80 normalized chars to catch near-duplicates
            const fingerprint = normalizePoiName(signal.content).substring(0, 80);
            if (seenFingerprints.has(fingerprint)) continue;
            seenFingerprints.add(fingerprint);

            descriptionCandidates.push(
                `[${signal.source} | trust:${(signal.score ?? 0).toFixed(2)}] ${signal.content.substring(0, 600)}`
            );

            if (descriptionCandidates.length >= 5) break; // Cap at 5 to keep prompt lean
        }

        // --- Images ---
        // Collect unique image URLs from high-confidence signals (score >= 0.85)
        const images = [...new Set(
            ranked
                .filter(s => (s.score ?? 0) >= 0.85)
                .flatMap(s => s.images || (s.image ? [s.image] : []))
                .filter(Boolean)
        )].slice(0, 3);

        // --- Website ---
        // Prefer official_site signal, then any link from high-trust signals
        const officialSignal = ranked.find(s => s.type === 'official_site' || s.source === 'official_website');
        const website = officialSignal?.link ||
            ranked.find(s => (s.score ?? 0) >= 0.8 && s.link)?.link ||
            null;

        // --- Categories ---
        // Semantic verification hints derived from which sources contributed
        const categoryHints = new Set();
        for (const signal of ranked) {
            if (signal.type === 'official_site') categoryHints.add('has_official_website');
            if (signal.source === 'wikipedia') categoryHints.add('wikipedia_verified');
            if (signal.source === 'OpenStreetMap') categoryHints.add('osm_verified');
            if (signal.source === 'local_archive') categoryHints.add('locally_archived');
        }
        const categories = [...categoryHints];

        // --- Facts ---
        // Short snippets (< 200 chars) from high-trust signals, deduplicated
        const facts = ranked
            .filter(s => (s.score ?? 0) >= 0.7 && s.content && s.content.length < 200)
            .map(s => s.content.trim())
            .filter((f, i, arr) => arr.indexOf(f) === i)
            .slice(0, 4);

        return { descriptionCandidates, categories, images, website, facts };
    }

    cleanText(text, limitOverride = null) {
        if (this.config.lengthMode === 'max') {
            // Return significantly more text for "Max" requests
            return text.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').replace(/\[Alt:[^\]]*\]/g, '');
        }

        const limit = limitOverride || (this.config.lengthMode === 'short' ? 2 : 6);
        return text.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '').replace(/\[Alt:[^\]]*\]/g, '').split('. ').slice(0, limit).join('. ') + '.';
    }

    /**
     * Robust AI JSON Parsing Utility
     * Handles markdown blocks, thinking blocks, and truncated JSON outputs.
     */
    _parseAiJson(text) {
        if (!text || typeof text !== 'string') return null;

        // 1. Strip Chain-of-Thought (think) blocks
        let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. Extract content from Markdown code blocks if present
        const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            cleanText = jsonMatch[1].trim();
        } else {
            // Remove generic code blocks
            cleanText = cleanText.replace(/```/g, '').trim();
        }

        // 3. Find first { and last } to isolate JSON object
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');

        if (start === -1) {
            console.warn("[AI] No JSON object found in response");
            return null;
        }

        let jsonCandidate = cleanText.substring(start, end !== -1 ? end + 1 : undefined);

        // 4. Try parsing immediately
        try {
            return JSON.parse(jsonCandidate);
        } catch (e) {
            // 5. Recovery Phase: Handle truncation (Missing closing braces/brackets/quotes)
            try {
                let recovered = jsonCandidate;

                // Close unclosed string if it exists
                const quotes = (recovered.match(/(?<!\\)"/g) || []).length;
                if (quotes % 2 !== 0) recovered += '"';

                // Close unclosed braces
                const opens = (recovered.match(/\{/g) || []).length;
                const closes = (recovered.match(/\}/g) || []).length;
                const missingBraces = opens - closes;
                if (missingBraces > 0) {
                    recovered += '}'.repeat(missingBraces);
                }

                const result = JSON.parse(recovered);
                console.log("[AI] Successfully recovered truncated JSON response");
                return result;
            } catch (recoveryError) {
                console.error("[AI] JSON Recovery failed:", recoveryError);
                console.warn("[AI] Raw problematic text snippet:", cleanText.substring(0, 300));
                return null;
            }
        }
    }
}

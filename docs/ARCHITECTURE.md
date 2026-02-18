# POI Intelligence Architecture

> **Last updated**: 2026-02-18
> **File**: `src/services/PoiIntelligence.js`, `server.js`

---

## Pipeline Overview

```
evaluatePoi(candidate)
  Step 0:  resolveCanonicalEntity()      ← Wikidata entity resolution (optional, non-blocking)
  Step 1:  gatherSignals()               ← Two-phase signal fetch
             Phase 1: cheap sources (parallel)
             Phase 2: fetchWebSearch (conditional — see below)
  Step 2:  analyzeSignals()              ← Per-signal heuristic scoring (Pass 1)
                                            + Graph-based consensus scoring (Pass 2)
  Step 2b: mergeSignals()                ← Structured payload for AI prompts
  Step 3:  fetchGeminiShortDescription() ← Stage 1: AI synthesis (short)
           fetchGeminiFullDetails()      ← Stage 2: AI synthesis (deep)
  Step 4:  resolveConflicts()            ← Fallback if Gemini fails
```

---

## Signal Sources

| # | Fetcher | API | Cost | Base Trust |
|---|---------|-----|------|------------|
| 1 | `fetchLocalArchive` | Hardcoded lookup | Free | 1.0 |
| 2 | `fetchWikipedia` | Wikipedia REST | Free | 0.95 |
| 3 | `fetchOverpassTags` | OSM Overpass (50m radius) | Free | 0.85 |
| 4 | `fetchDuckDuckGo` | DDG Instant Answers | Free | 0.6 |
| 5 | `fetchWebSearch` | Tavily / Google | **💰 Paid** | 0.75 |
| 6 | `fetchOfficialWebsite` | Via `/api/scrape-meta` proxy | Free | 0.95 |

---

## Changes Made (Feb 2026)

### 1. `normalizePoiName()` — Centralized Name Normalization

**Module-level utility** added before the class. Replaces ad-hoc `.toLowerCase()` and `.replace()` calls throughout the pipeline.

**Operations** (in order):
1. Lowercase
2. NFD decomposition → strip combining diacritics (`é → e`)
3. Strip parenthetical suffixes (`"Foo (Bar)" → "Foo"`)
4. Remove punctuation (keep alphanumeric + spaces)
5. Collapse whitespace
6. Apply `POI_SYNONYMS` dictionary (whole-word regex)

**`POI_SYNONYMS` dictionary** — 30 Dutch↔English entries:

| Alias | Canonical |
|-------|-----------|
| `stadhuis`, `gemeentehuis`, `raadhuis`, `town hall` | `city hall` |
| `kerk` | `church` |
| `kathedraal` | `cathedral` |
| `kasteel`, `slot`, `burcht` | `castle` |
| `schouwburg` | `theatre` |
| `treinstation` | `train station` |
| … (30 total) | |

**Integrated into:**
- `fetchWebSearch` — replaces `cleanName` regex
- `fetchOverpassTags` — both sides of fuzzy name match
- `analyzeSignals` — `poiName` and signal `text` normalization

---

### 2. `resolveCanonicalEntity()` — Wikidata Integration (Step 0)

Runs **before** `gatherSignals()` as a non-blocking enrichment step. Returns `null` on any failure.

**Queries Wikidata for:**
- Canonical name + aliases
- Wikipedia URL (language-aware)
- Official website (P856)
- Image (P18 → Wikimedia Commons URL)
- Categories (P31 instance-of IDs)

**Output** attached as `canonical` field on the final POI object.

---

### 3. `fetchOfficialWebsite()` + `/api/scrape-meta` Proxy

**`fetchOverpassTags`** now upgrades the `website` OSM tag from `link_only` to a real `official_site` signal by scraping the page via a backend proxy.

**`/api/scrape-meta`** (server.js) enforces:
- HTTP/HTTPS URL validation
- Robots-safe User-Agent
- 6-second timeout
- 150 KB content size limit
- HTML content-type check
- Extracts: `og:description` → `meta description` → first readable paragraph ≥ 60 chars

**Signal produced:** `{ type: 'official_site', confidence: 0.95, content: scraped (≤800 chars) }`

Falls back to `link_only` if scraping fails.

---

### 4. `gatherSignals()` — Two-Phase Fetch + `enableExpensiveSearch` Flag

**Phase 1** (always, parallel): `fetchLocalArchive`, `fetchWikipedia`, `fetchDuckDuckGo`, `fetchOverpassTags`

**Phase 2** (conditional): `fetchWebSearch` is only called if:

```
enableExpensiveSearch === true
  OR
NOT (hasWikipedia OR hasOfficialSite OR avgTrust >= 0.75)
```

**`enableExpensiveSearch`** — new constructor config flag, default `false`.

```js
new PoiIntelligence({ enableExpensiveSearch: true }) // always run web search
```

Backward compatible: existing callers without the flag get `false` (new default behavior).

---

### 5. `mergeSignals(scoredSignals)` — Structured AI Payload (Step 2b)

Runs after `analyzeSignals()`. Converts the scored signal array into a structured object consumed by both Gemini stages.

**Output shape:**
```js
{
  descriptionCandidates: string[], // up to 5, ranked by trust, deduplicated
  categories: string[],            // source verification hints
  images: string[],                // unique URLs from signals ≥ 0.85 trust
  website: string | null,          // official_site first, then any ≥ 0.8 trust link
  facts: string[]                  // short snippets < 200 chars from ≥ 0.7 trust signals
}
```

**Deduplication**: 80-char normalized fingerprint prevents near-duplicate descriptions.

**Gemini `contextData`** is now structured markdown instead of a flat blob:

```
## Verified Descriptions (ranked by trust):
[wikipedia | trust:0.95] ...
[official_website | trust:0.95] ...

## Official Website: https://...

## Quick Facts:
- ...

## Source Verification: wikipedia_verified, osm_verified
```

---

### 6. `analyzeSignals()` — Graph-Based Consensus Scoring

Two-pass scoring replacing the previous flat heuristics.

#### Pass 1: Per-signal heuristics (unchanged logic)
- Official link detection → score = 0.95
- Generic city description penalty → score ≤ 0.1
- Search result name boost → score ≥ 0.9
- Tag-list junk detection → score = 0.2

#### Pass 2: Signal Confidence Graph

**`_buildSignalGraph(scoredSignals, poiName)`** — builds a symmetric **n×n adjacency matrix**.

Edge weight between signals `i` and `j`:

| Criterion | Weight |
|-----------|--------|
| Both contents mention POI name | +0.40 |
| Both share a category keyword | +0.30 |
| Bigram Jaccard similarity × 0.3 | 0–0.30 |

Clamped to [0, 1].

**Weighted degree centrality:**
```
centrality(i) = Σ edge(i,j) / (n-1)
finalScore    = clamp(baseScore + centrality × 0.3, 0, 1.0)
```

Max graph contribution: **+0.30**. Isolated signals (no agreement) receive no boost.

Each signal gains a `graphCentrality: float` debug field.

**`_textSimilarity(a, b)`** — bigram Jaccard, deterministic, no external dependencies.

---

## Backend Endpoints (server.js)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/gemini` | Gemini 2.0 Flash proxy |
| `POST /api/groq` | Groq proxy with model fallback list |
| `GET /api/tavily` | Tavily search proxy |
| `GET /api/ddg` | DuckDuckGo proxy |
| `GET /api/google-search` | Google Custom Search proxy |
| `GET /api/nominatim` | OSM geocoding proxy |
| `GET /api/foursquare` | Foursquare Places proxy |
| `ALL /api/cloud-cache` | Supabase cache proxy |
| `POST /api/scrape-meta` | **NEW** — HTML meta scraper proxy |

---

## Module-Level Utilities (PoiIntelligence.js)

| Symbol | Type | Purpose |
|--------|------|---------|
| `POI_SYNONYMS` | `const object` | 30-entry Dutch↔English alias dictionary |
| `normalizePoiName(name)` | `function` | Canonical name normalization |
| `_textSimilarity(a, b)` | `function` | Bigram Jaccard similarity [0,1] |
| `_buildSignalGraph(signals, poiName)` | `function` | Weighted n×n adjacency matrix |

---

## Trust Score Flow

```
signal.confidence (base)
  → Pass 1 heuristics  (may raise to 0.95 or drop to 0.1/0.2)
  → Pass 2 graph       (+0 to +0.30 based on centrality)
  → mergeSignals       (ranked, deduplicated, structured)
  → Gemini prompt      (structured contextData)
  → resolveConflicts   (fallback: picks highest .score)
```

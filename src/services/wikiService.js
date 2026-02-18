import { apiFetch } from '../utils/api';

/**
 * Fetches a summary for a POI from Wikipedia, DuckDuckGo, or Google Search.
 */
export const fetchWikipediaSummary = async (query, lang = 'en', context = '') => {
    try {
        const hasContext = context && query.toLowerCase().includes(context.toLowerCase());
        const fullQuery = (context && !hasContext) ? `${query} ${context}` : query;
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fullQuery)}&format=json&origin=*`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (!searchData.query?.search?.length) {
            if (context && query.trim().split(' ').length > 1) {
                return fetchWikipediaSummary(query, lang, '');
            }

            if (context) {
                try {
                    const citySearchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&titles=${encodeURIComponent(context)}&format=json&origin=*`;
                    const cityRes = await fetch(citySearchUrl);
                    const cityData = await cityRes.json();
                    const cityPages = cityData.query?.pages;
                    const cityPageId = Object.keys(cityPages || {})[0];

                    if (cityPageId && cityPageId !== '-1') {
                        const cityText = cityPages[cityPageId].extract;
                        const escQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`([^.]*?${escQuery}[^.]*\\.)`, 'i');
                        const match = cityText.match(regex);

                        if (match && match[1]) {
                            const idx = match.index;
                            const start = Math.max(0, idx - 100);
                            const end = Math.min(cityText.length, idx + 400);
                            const snippet = cityText.substring(start, end);
                            let validSentences = snippet.match(/[^.!?]+[.!?]+/g);
                            if (validSentences) {
                                const relSentences = validSentences.filter(s => s.toLowerCase().includes(query.toLowerCase()));
                                if (relSentences.length > 0) {
                                    const cityLink = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(context)}`;
                                    return { description: validSentences.join(' ').trim(), link: cityLink, source: "Wikipedia (City Mention)" };
                                }
                            }
                        }
                    }
                } catch (eInner) { console.warn("City fallback failed", eInner); }
            }
            throw new Error("Wiki search returned no results.");
        }

        let title = searchData.query.search[0].title;
        if (context && title.toLowerCase() === context.toLowerCase() && query.length > context.length) {
            const cleanName = query.replace(new RegExp(context, 'gi'), '').trim();
            if (cleanName.length > 3) {
                return fetchWikipediaSummary(cleanName, lang, '');
            }
        }

        const detailsUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();
        const pages = detailsData.query?.pages;
        if (!pages) throw new Error("Wiki details pages missing.");
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') throw new Error("Wikipedia page not found.");

        let extract = pages[pageId].extract;
        if (!extract) throw new Error("No extract found for Wikipedia page.");
        extract = extract.replace(/\s*\([^)]*\)/g, '').replace(/\[\d+\]/g, '');

        const sentences = extract.split('. ');
        if (sentences.length <= 8) return extract;
        const descText = sentences.slice(0, 8).join('. ') + '.';
        const wikiLink = `https://${lang}.wikipedia.org/?curid=${pageId}`;
        return { description: descText, link: wikiLink, source: "Wikipedia" };

    } catch (e) {
        console.warn("Wiki fetch failed for", query, e.message);
    }

    // Fallback: DuckDuckGo
    try {
        const fullQuery = context ? `${query} ${context}` : query;
        const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(fullQuery)}&format=json&no_html=1&skip_disambig=1`);
        const ddgData = await ddgRes.json();
        if (ddgData.AbstractText) {
            return { description: ddgData.AbstractText, link: ddgData.AbstractURL, source: "DuckDuckGo" };
        }
    } catch (e) {
        console.warn("DDG fallback failed", e);
    }

    // Fallback: Google
    try {
        let fullQuery = query;
        if (context && !query.toLowerCase().includes(context.toLowerCase())) {
            fullQuery = `${query} ${context}`;
        }
        fullQuery += " -site:facebook.com -site:instagram.com -site:twitter.com -site:linkedin.com";

        const gRes = await apiFetch(`/api/google-search?q=${encodeURIComponent(fullQuery)}`);
        const gData = await gRes.json();

        if (gData.items && gData.items.length > 0) {
            const item = gData.items[0];
            let bestText = item.snippet;
            if (item.pagemap?.metatags?.length > 0) {
                const tags = item.pagemap.metatags[0];
                if (tags['og:description']?.length > bestText.length) bestText = tags['og:description'];
                else if (tags['description']?.length > bestText.length) bestText = tags['description'];
            }
            const finalDesc = bestText.replace(/^\w{3} \d{1,2}, \d{4} \.\.\. /g, '').replace(/\n/g, ' ');
            return { description: finalDesc, link: item.link, source: "Web Result" };
        }
    } catch (e) {
        console.warn("Google Search fallback failed", e);
    }
    return null;
};

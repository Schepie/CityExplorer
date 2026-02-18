import React from 'react';

const Changelog = ({ language, setShowChangelog }) => {
    return (
        <div className="space-y-6 px-6 py-5 animate-in fade-in slide-in-from-right-4 duration-300">
            {[
                {
                    date: "18 Feb 2026",
                    version: "v4.1.0",
                    items: language === 'nl' ? [
                        { title: "Groq API Stabiliteit", desc: "Kritieke fout opgelost waarbij niet-chat modellen (zoals Whisper) werden geselecteerd. De app filtert deze nu strikt uit." },
                        { title: "Premium Foto Filtering", desc: "Verbeterde filtering van merkklogo's en assets van boekingssites (Skyscanner, TripAdvisor) voor relevantere foto's." },
                        { title: "Data Integriteit Fix", desc: "Een ReferenceError opgelost in de POI-engine die het ophalen van volledige details kon blokkeren." }
                    ] : [
                        { title: "Groq API Stability", desc: "Resolved critical 400 errors by strictly filtering out non-chat models (like Whisper) from the registry." },
                        { title: "Premium Image Filtering", desc: "Expanded noise detection to exclude brand logos and travel aggregator assets (Skyscanner, TripAdvisor, etc.)." },
                        { title: "Data Integrity Fix", desc: "Resolved a ReferenceError in the POI intelligence engine that could break detail fetches." }
                    ]
                },
                {
                    date: "18 Feb 2026",
                    version: "v4.0.0",
                    items: language === 'nl' ? [
                        { title: "Signal Confidence Graph", desc: "POI-betrouwbaarheid wordt nu berekend via een gewogen graaf: signalen die het eens zijn over naam, categorie of beschrijving krijgen een hogere vertrouwensscore." },
                        { title: "Slimme Zoekkosten", desc: "Dure webzoekopdrachten worden overgeslagen als Wikipedia, een officiële website of voldoende gratis signalen al goede data leveren." },
                        { title: "Wikidata Integratie", desc: "Canonieke entiteitsresolutie via Wikidata vóór het ophalen van signalen voor nauwkeurigere namen, aliassen en categorieën." },
                        { title: "Officiële Website Scraping", desc: "OSM-websitetags worden nu automatisch gescraped voor rijke beschrijvingen met hoge betrouwbaarheid (0.95)." },
                        { title: "Naamnormalisatie", desc: "Centrale naamopschoning met diacritieken, synoniemen (NL↔EN) en afkortingen voor betere cross-source matching." },
                        { title: "Gestructureerde AI Prompts", desc: "Gemini ontvangt nu gestructureerde context (beschrijvingen, feiten, website, verificatie) in plaats van ruwe signaaldata." },
                    ] : [
                        { title: "Signal Confidence Graph", desc: "POI trust is now computed via a weighted graph: signals agreeing on name, category, or description similarity earn higher trust scores." },
                        { title: "Smart Search Cost", desc: "Expensive web searches are skipped when Wikipedia, an official site, or enough free signals already provide quality data." },
                        { title: "Wikidata Integration", desc: "Canonical entity resolution via Wikidata before signal gathering for more accurate names, aliases, and categories." },
                        { title: "Official Website Scraping", desc: "OSM website tags are now automatically scraped for rich, high-trust (0.95) descriptions." },
                        { title: "Name Normalisation", desc: "Centralised name cleaning with diacritics, synonyms (NL↔EN) and abbreviations for better cross-source matching." },
                        { title: "Structured AI Prompts", desc: "Gemini now receives structured context (descriptions, facts, website, verification) instead of raw signal data." },
                    ]
                },
                {
                    date: "18 Feb 2026",
                    version: "v3.5.1",
                    items: language === 'nl' ? [
                        { title: "Afvalbak Icoon", desc: "Verwijder stops nu handig via het nieuwe icoontje in de lijst." },
                        { title: "Compacte UI", desc: "'Snel Toevoegen' en sliders zijn compacter gemaakt voor meer overzicht." },
                        { title: "Bugfix Kaart", desc: "Het annuleren van 'Kies op Kaart' wist niet langer per ongeluk je hele route." }
                    ] : [
                        { title: "Waste Basket Icon", desc: "Easily remove stops using the new icon in the list." },
                        { title: "Compact UI", desc: "'Quick Add' and sliders are now more compact for a better overview." },
                        { title: "Map Bugfix", desc: "Cancelling 'Pick on Map' no longer accidentally clears your entire route." }
                    ]
                },
                {
                    date: "18 Feb 2026",
                    version: "v3.5.0",
                    items: language === 'nl' ? [
                        { title: "Dynamische Time-out", desc: "Zoekopdrachten voor grote gebieden (>10km) krijgen nu meer tijd (tot 180s) om timeouts te voorkomen." },
                        { title: "Betrouwbaardere Zoekacties", desc: "Synchronisatie tussen client en server zorgt ervoor dat grote zoekopdrachten niet voortijdig worden afgebroken." }
                    ] : [
                        { title: "Dynamic Timeout", desc: "Large-area searches (>10km) now get significantly more time (up to 180s) to prevent timeouts." },
                        { title: "More Reliable Searches", desc: "Synchronized client-server timeouts ensure large queries complete successfully." }
                    ]
                },
                {
                    date: "18 Feb 2026",
                    version: "v3.4.1",
                    items: language === 'nl' ? [
                        { title: "UI Opgepoetst", desc: "Dubbele \"Duid aan op Kaart\"-knop in manuele modus opgelost." }
                    ] : [
                        { title: "UI Polish", desc: "Fixed duplicate \"Pick on Map\" button in Manual Mode." }
                    ]
                },
                {
                    date: "18 Feb 2026",
                    version: "v3.4.0",
                    items: language === 'nl' ? [
                        { title: "Taalcorrectie AI", desc: "AI-beschrijvingen van plekken, welkomstberichten en aankomstinstructies worden nu correct in de gekozen taal gegenereerd." },
                        { title: "Betere Afbeeldingen", desc: "App Store-, sociale media- en andere irrelevante afbeeldingen worden nu automatisch gefilterd uit zoekresultaten." },
                        { title: "Compacte Instellingen", desc: "De 'Over deze App' sectie toont versie, auteur en datum nu op één compacte regel." },
                        { title: "Changelog Thema", desc: "Het changelog-scherm past zich nu aan het actieve kleurthema aan." },
                    ] : [
                        { title: "AI Language Fix", desc: "AI-generated POI descriptions, welcome messages and arrival instructions are now correctly generated in the selected language." },
                        { title: "Smarter Images", desc: "App Store, social media and other irrelevant images are now automatically filtered out from search results." },
                        { title: "Compact Settings", desc: "The 'About this App' section now shows version, author and date in a single compact row." },
                        { title: "Changelog Theming", desc: "The changelog screen now adapts to the active colour theme." },
                    ]
                },
                {
                    date: "17 Feb 2026",
                    version: "v3.3.2",
                    items: language === 'nl' ? [
                        { title: "App Herstarts Fix", desc: "Een bug opgelost waarbij de app herstartte tijdens het bijwerken van plekken." }
                    ] : [
                        { title: "App Restarts Fix", desc: "Resolved an issue where the app would restart unexpectedly during POI updates." }
                    ]
                },
                {
                    date: "17 Feb 2026",
                    version: "v3.3.1",
                    items: language === 'nl' ? [
                        { title: "Foursquare Standaard", desc: "Extra POI data van Foursquare is nu standaard ingeschakeld voor rijkere resultaten." }
                    ] : [
                        { title: "Foursquare Default", desc: "Foursquare Extra POI data is now enabled by default for richer discovery results." }
                    ]
                },
                {
                    date: "16 Feb 2026",
                    version: "v3.3.0",
                    items: language === 'nl' ? [
                        { title: "Open Toegang", desc: "Het inlogsysteem is uitgeschakeld voor directe toegang tot alle functies." },
                        { title: "Verbeterde Stabiliteit", desc: "Extra beveiliging voor kaartdata voorkomt crashes en verbetert de algemene snelheid." },
                        { title: "Service Logs Fix", desc: "Het uitlezen van systeemlogboeken in de instellingen werkt nu weer correct." }
                    ] : [
                        { title: "Open Access", desc: "Disabled the login system to allow immediate access to all features." },
                        { title: "Improved Stability", desc: "Data normalization for map points prevents worker crashes and improves performance." },
                        { title: "Service Logs Fix", desc: "System diagnostics in advanced settings are now fully functional." }
                    ]
                },
                {
                    date: "13 Feb 2026",
                    version: "v3.2.0",
                    items: language === 'nl' ? [
                        { title: "Satellietweergave", desc: "Nieuwe 'Layers' knop om te wisselen tussen kaart- en satellietbeelden (vereist MapTiler sleutel)." },
                        { title: "Slimme Zoekfeedback", desc: "Beter inzicht in wat de app doet: 'Zoeken...', 'Verrijken...', 'Optimaliseren...'." },
                        { title: "Inline Zoeken", desc: "Voeg specifieke plekken (bv. restaurants) toe zonder het zijpaneel te verlaten." },
                        { title: "Snellere Resultaten", desc: "Geoptimaliseerde Overpass-servers zorgen voor snellere POI-lading." }
                    ] : [
                        { title: "Satellite View", desc: "New 'Layers' button to toggle between map and satellite imagery (requires MapTiler key)." },
                        { title: "Smart Search Feedback", desc: "Better visibility into app actions: 'Searching...', 'Enriching...', 'Optimizing...'." },
                        { title: "Inline Search", desc: "Add specific places (e.g. restaurants) without leaving the sidebar." },
                        { title: "Faster Results", desc: "Optimized Overpass servers ensure faster POI loading." }
                    ]
                },

                {
                    date: "12 Feb 2026",
                    version: "v3.1.1",
                    items: language === 'nl' ? [
                        { title: "Volledige Gratis Stack", desc: "Overstap naar Groq Cloud (AI) en Tavily (Zoeken) voor een 100% gratis ervaring." },
                        { title: "Overpass Failover", desc: "Automatische mirror-selectie voorkomt foutmeldingen bij drukte op OpenStreetMap." },
                        { title: "AI Foutreductie", desc: "Slimme retries en geoptimaliseerde prompts voorkomen 429-fouten in gids-beschrijvingen." },
                        { title: "Provider Keuze", desc: "Kies zelf je favoriete AI en zoekmachine in de vernieuwde instellingen." }
                    ] : [
                        { title: "Full Free API Stack", desc: "Migration to Groq Cloud (AI) and Tavily AI (Search) for a 100% free experience." },
                        { title: "Overpass Failover", desc: "Automatic mirror switching prevents errors during high OpenStreetMap server load." },
                        { title: "AI Error Reduction", desc: "Smart retries and optimized prompts prevent 429 errors in guide descriptions." },
                        { title: "Provider Choice", desc: "Choose your preferred AI and search engine in the revamped settings." }
                    ]
                },
                {
                    date: "12 Feb 2026",
                    version: "v3.0.3",
                    items: language === 'nl' ? [
                        { title: "Overpass API Integratie", desc: "OSM POI zoeken nu via Overpass API. Geen CORS fouten meer, volledig gratis en superieure POI data kwaliteit." }
                    ] : [
                        { title: "Overpass API Integration", desc: "OSM POI search now uses Overpass API. No more CORS errors, completely free, and superior POI data quality." }
                    ]
                },
                {
                    date: "12 Feb 2026",
                    version: "v3.0.2",
                    items: language === 'nl' ? [
                        { title: "Gratis POI Modus", desc: "Standaard gebruik van OSM (gratis) in plaats van Google Places. Schakel Google Places in via Instellingen indien gewenst." }
                    ] : [
                        { title: "Free POI Mode", desc: "Defaults to OSM (free) instead of Google Places. Enable Google Places in Settings if desired." }
                    ]
                },
                {
                    date: "12 Feb 2026",
                    version: "v3.0.1",
                    items: language === 'nl' ? [
                        { title: "Zoom naar Route Fix", desc: "De 'zoom naar route' knop werkt nu betrouwbaar, zelfs tijdens navigatie." },
                        { title: "GPS Stabilisatie", desc: "Verbeterde sensor filtering voorkomt het schudden van de kaart bij onnauwkeurige GPS of kompas data." }
                    ] : [
                        { title: "Zoom to Route Fix", desc: "The 'zoom to route' button now works reliably, even during navigation." },
                        { title: "GPS Stabilization", desc: "Improved sensor filtering prevents map jitter when GPS or compass data is inaccurate." }
                    ]
                },
                {
                    date: "12 Feb 2026",
                    version: "v3.0.0",
                    items: language === 'nl' ? [
                        { title: "Automatische Lus Routes", desc: "Handmatige routes (via 'Kies op kaart') sluiten nu automatisch als luswandelingen." },
                        { title: "Slimme Sidebar", desc: "De zijbalk onthoudt je ontdekkingsvoorkeur en toont geen onnodige discovery prompts meer." },
                        { title: "Verfijnde Kaart Controls", desc: "Kaartbesturingsknoppen hebben nu een subtielere transparantie voor een geïntegreerde look." },
                        { title: "Route Berekening Fix", desc: "Verbeterde afstandsberekening voor roundtrip routes." }
                    ] : [
                        { title: "Automatic Loop Routes", desc: "Manual routes (via 'Pick on map') now automatically close as loop hikes." },
                        { title: "Smart Sidebar", desc: "Sidebar remembers your discovery preference and no longer shows unnecessary discovery prompts." },
                        { title: "Refined Map Controls", desc: "Map control buttons now have a more subtle transparency for an integrated look." },
                        { title: "Route Calculation Fix", desc: "Improved distance calculation for roundtrip routes." }
                    ]
                },
                {
                    date: "10 Feb 2026",
                    version: "v2.1.2",
                    items: language === 'nl' ? [
                        { title: "Gedeelde Nummering", desc: "Favorieten en eigen stops delen nu één doorlopende nummering (1, 2, 3...) in de juiste routevolgorde." },
                        { title: "Kaart Iconen", desc: "Eigen routepunten zijn nu subtiele ruitvormige markers om ze te onderscheiden van ontdekkingen." },
                        { title: "Ontdek Afstand", desc: "De zoekstraal rondom de route is vergroot naar 100 meter voor meer relevante resultaten." }
                    ] : [
                        { title: "Shared Numbering", desc: "POIs and manual stops now share a single sequential numbering (1, 2, 3...) in route order." },
                        { title: "Map Icons", desc: "Manual route points are now subtle diamond-shaped markers to distinguish them from discoveries." },
                        { title: "Discovery Range", desc: "Increased the discovery perimeter to 100 meters for more relevant results." }
                    ]
                },
                {
                    date: "09 Feb 2026",
                    version: "v2.1.1",
                    items: language === 'nl' ? [
                        { title: "Navigatie Stabiliteit", desc: "Infinite-loop fix voor route-fetching en verbeterde GPS-drempels." },
                        { title: "Handmatige Routes", desc: "Volledige ondersteuning voor eet/drink-stops op zelf getekende routes." },
                        { title: "Prestaties", desc: "Minder netwerkverkeer en batterijverbruik door slimme caching-guards." }
                    ] : [
                        { title: "Navigation Stability", desc: "Fixed infinite-loop in route fetching and optimized GPS thresholds." },
                        { title: "Manual Route Support", desc: "Full support for food/drink stops on manually drawn routes." },
                        { title: "Performance", desc: "Reduced network traffic and battery usage via smart caching guards." }
                    ]
                },
                {
                    date: "09 Feb 2026",
                    version: "v2.1.0",
                    items: language === 'nl' ? [
                        { title: "Corridor Zoeken", desc: "POI-zoekopdrachten tonen nu alleen plaatsen binnen 50m van je werkelijke pad." },
                        { title: "Blijvende Stops", desc: "Genummerde routepunten (1, 2, 3...) blijven nu zichtbaar op de kaart na het afronden." },
                        { title: "Snel Ontdekken", desc: "Nieuwe 'Nu Ontdekken' trigger na routecreatie voor een betere controle." },
                        { title: "Stabiliteit", desc: "Diverse verbeteringen voor kaartmarkeringen en OSM-proxy verbindingen." }
                    ] : [
                        { title: "Corridor Search", desc: "POI searches now strictly filter results within 50m of your actual route path." },
                        { title: "Persistent Stops", desc: "Numbered route markers (1, 2, 3...) now stay visible after finishing your route." },
                        { title: "Fast Discovery", desc: "New 'Discover Now' phase after route creation for better control." },
                        { title: "Stability", desc: "Key fixes for map marker visibility and OSM proxy reliability." }
                    ]
                },
                {
                    date: "09 Feb 2026",
                    version: "v2.0.1",
                    items: language === 'nl' ? [
                        { title: "Crash Fix", desc: "Een fout opgelost waarbij de app crashte bij het openen van de stadsinfo met audio aan." },
                        { title: "Stem Fix", desc: "Nederlandse stemmen worden nu correct herkend, ongeacht regio (NL/BE)." }
                    ] : [
                        { title: "Crash Fix", desc: "Fixed a critical error where the app would crash when opening city info with audio enabled." },
                        { title: "Voice Fix", desc: "Dutch voices are now correctly identified regardless of region (NL/BE)." }
                    ]
                },
                {
                    date: "07 Feb 2026",
                    version: "v2.0.0",
                    items: language === 'nl' ? [
                        { title: "AR Modus", desc: "Richt je camera op gebouwen om ze direct te identificeren." },
                        { title: "Camera Scan", desc: "Nieuwe AI-analyse voor monumenten en bezienswaardigheden." },
                        { title: "Kaart Interface", desc: "Verbeterde knoppenindeling voor een rustiger beeld." }
                    ] : [
                        { title: "AR Mode", desc: "Point your camera at buildings to identify them instantly." },
                        { title: "Camera Scan", desc: "New AI analysis for monuments and landmarks." },
                        { title: "Map Interface", desc: "Improved button layout for a cleaner view." }
                    ]
                },
                {
                    date: "07 Feb 2026",
                    version: "v1.10.0",
                    items: language === 'nl' ? [
                        { title: "Gesproken Navigatie", desc: "Ontvang nu gesproken turn-by-turn aanwijzingen tijdens je route." },
                        { title: "Verbeterde Stabiliteit", desc: "Diverse fixes voor locatie-tracking en stabiliteit bij het opstarten." }
                    ] : [
                        { title: "Spoken Navigation", desc: "Get hands-free turn-by-turn voice guidance as you travel." },
                        { title: "Improved Stability", desc: "Key fixes for location tracking and app reliability during startup." }
                    ]
                },
                {
                    date: "07 Feb 2026",
                    version: "v1.9.0",
                    items: language === 'nl' ? [
                        { title: "Achtergrond Audio", desc: "De app blijft nu actief en gidsen wanneer het scherm uit staat of de app op de achtergrond draait." },
                        { title: "Minder Dubbele Info", desc: "Korte beschrijvingen worden nu overgeslagen zodra de uitgebreide informatie beschikbaar is." },
                        { title: "Continue Navigatie", desc: "Navigatie stopt niet meer bij tussenstops maar loopt soepel door naar het volgende punt." },
                        { title: "Logische Volgorde", desc: "Plek-informatie wordt nu in een natuurlijkere volgorde getoond en voorgelezen." }
                    ] : [
                        { title: "Background Audio", desc: "The app remains active and continues guiding even when the screen is off or backgrounded." },
                        { title: "Reduced Redundancy", desc: "Short descriptions are now smartly skipped once full details are available." },
                        { title: "Smooth Navigation", desc: "Navigation no longer stops at intermediate waypoints, providing a better flow." },
                        { title: "Natural Order", desc: "Information about places is now displayed and read in a more logical order." }
                    ]
                },
                {
                    date: "04 Feb 2026",
                    version: "v1.8.0",
                    items: language === 'nl' ? [
                        { title: "Route Verfijning", desc: "Nieuwe tool om routes aan te passen, inclusief reiswijze en afstand." },
                        { title: "Kies op Kaart", desc: "Klik op de kaart om direct een punt aan de route toe te voegen." },
                        { title: "Vereenvoudigde Instellingen", desc: "Instellingen zoals Simulatie en Audio zijn nu direct aan/uit te zetten." }
                    ] : [
                        { title: "Route Refinement", desc: "New tool to modify routes, including travel mode and distance." },
                        { title: "Pick on Map", desc: "Click on the map to add a point directly to the route." },
                        { title: "Simplified Settings", desc: "Settings like Simulation and Audio are now direct toggles." }
                    ]
                },
                {
                    date: "02 Feb 2026",
                    version: "v1.7.2",
                    items: language === 'nl' ? [
                        { title: "Kies op Kaart", desc: "Voeg eenvoudig nieuwe stops toe door direct op de kaart te klikken." },
                        { title: "Automatische Info", desc: "Nieuwe stops worden nu automatisch voorzien van beschrijvingen en foto's." }
                    ] : [
                        { title: "Pick on Map", desc: "Easily add new stops by clicking directly on the map." },
                        { title: "Automatic Info", desc: "New stops are now automatically enriched with descriptions and photos." }
                    ]
                },
                {
                    date: "02 Feb 2026",
                    version: "v1.7.1",
                    items: language === 'nl' ? [
                        { title: "Route Herberekening", desc: "Wanneer je een POI toevoegt via 'SNEL TOEVOEGEN' wordt de route nu automatisch herberekend en op de kaart getoond." }
                    ] : [
                        { title: "Route Recalculation", desc: "When adding a POI via 'Quick Add', the route is now automatically recalculated and displayed on the map." }
                    ]
                },
                {
                    date: "31 Jan 2026",
                    version: "v1.7.0",
                    items: language === 'nl' ? [
                        { title: "Gemakkelijk Inloggen", desc: "Je blijft nu 7 dagen ingelogd zodat je niet elke keer een nieuwe code nodig hebt." },
                        { title: "Autosave Fix", desc: "De autosave knop werkt nu correct en onthoudt je voorkeur." },
                        { title: "Herstarten Verbeterd", desc: "De herstartknop opent nu direct de vragenlijst om snel een nieuwe trip te plannen." }
                    ] : [
                        { title: "Easy Sign-in", desc: "You now stay signed in for 7 days, so you don't need a new code every time." },
                        { title: "Autosave Fix", desc: "The autosave button now correctly respects your preference." },
                        { title: "Restart Improved", desc: "The restart button now directly opens the questionnaire for quick planning." }
                    ]
                },
                {
                    date: "29 Jan 2026",
                    version: "v1.6.0",
                    items: language === 'nl' ? [
                        { title: "Beveiligde API", desc: "Volledige JWT authenticatie voor alle zoek- en AI-functies." },
                        { title: "Toegangscodes", desc: "Nieuwe mogelijkheid om in te loggen met een 6-cijferige code." },
                        { title: "Admin Relay", desc: "Verbeterde login-flow via handmatige goedkeuring." }
                    ] : [
                        { title: "Secure API", desc: "Full JWT authentication for all search and AI features." },
                        { title: "Access Codes", desc: "New option to sign in using a 6-digit code." },
                        { title: "Admin Relay", desc: "Improved login flow via manual admin approval." }
                    ]
                },
                {
                    date: "26 Jan 2026",
                    version: "v1.5.1",
                    items: language === 'nl' ? [
                        { title: "Bugfix Suggesties", desc: "Een bug verholpen waarbij het toevoegen van een extra POI uit de lijst van voorstellen soms een foutmelding gaf." }
                    ] : [
                        { title: "Suggestion Bugfix", desc: "Fixed a bug where adding a POI from the guide's suggestions would sometimes trigger an error." }
                    ]
                },
                {
                    date: "26 Jan 2026",
                    version: "v1.5.0",
                    items: language === 'nl' ? [
                        { title: "Gids Vertelt Verder", desc: "De audio gids leest nu automatisch alle informatie voor (bezienswaardigheid + weetjes + tips) zonder te stoppen." },
                        { title: "Visuele Sync", desc: "Woord-voor-woord highlighting volgt nu de stem door alle secties van de beschrijving." },
                        { title: "Gedeelde Details", desc: "Informatie in de zijbalk en op de kaart popups is nu identiek en real-time gesynchroniseerd." },
                        { title: "Verfijnd Design", desc: "De play-button staat nu naast de titel in popups en de interesses zijn beter leesbaar." },
                        { title: "Opgeruimde Menu's", desc: "Instellingen zijn vereenvoudigd en foutieve systeemteksten zijn verwijderd." }
                    ] : [
                        { title: "Continuous Narrative", desc: "The audio guide now automatically reads all information (POI + Fun Facts + Tips) in one go." },
                        { title: "Total Sync", desc: "Word-for-word highlighting now follows the voice through all information sections." },
                        { title: "Unified Info", desc: "Sidebar and Map Popups now show identical, real-time synchronized data." },
                        { title: "Refined Layout", desc: "Play buttons are now aligned with titles and interest matches are more readable." },
                        { title: "Clean Settings", desc: "Simplified menus and removed accidental internal system text." }
                    ]
                }
            ].slice(0, 3).map((rel, ri) => (
                <div key={ri} className="space-y-4">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-black bg-[var(--primary)]/20 text-[var(--primary)] px-2.5 py-0.5 rounded-full border border-[var(--primary)]/30">{rel.version}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{rel.date}</span>
                    </div>
                    <div className="space-y-3">
                        {rel.items.map((item, ii) => (
                            <div key={ii} className="relative pl-4 border-l-2 border-[var(--primary)]/20">
                                <div className="absolute -left-[3px] top-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)]/60" />
                                <div className="text-sm font-bold text-white mb-0.5">{item.title}</div>
                                <div className="text-xs text-slate-400 leading-relaxed">{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="pt-4 text-center">
                <button
                    onClick={() => setShowChangelog(false)}
                    className="text-xs text-[var(--primary)] font-bold hover:underline opacity-70 hover:opacity-100 transition-opacity"
                >
                    {language === 'nl' ? 'Sluit Changelog' : 'Close Changelog'}
                </button>
            </div>
        </div>
    );
};

export default Changelog;

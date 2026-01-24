# Gebruikersinvoer & Algoritme Uitleg

Dit document beschrijft de vereiste invoer voor CityExplorer en hoe het algoritme deze gegevens gebruikt om een route met relevante bezienswaardigheden (POI's) te genereren.

---

### 1. Verwachte Inputs van de Gebruiker
Om een gepersonaliseerde route te plannen, heeft de applicatie de volgende gegevens nodig:

*   **Locatie (Stad of Startpunt):** De plek die je wilt verkennen. Je kunt een stad invoeren (zoals "Leuven") of je huidige GPS-locatie gebruiken.
*   **Interesses:** Trefwoorden die beschrijven wat je wilt zien (bijv. "historische gebouwen", "parken"). 
    *   *Defaultgedrag:* Wanneer je geen interesses opgeeft, hanteert het systeem automatisch een gebalanceerde selectie van toeristische trefwoorden zoals: Bezienswaardigheden, Must-see, Historisch, Monument, Musea, Kunst & design, Erfgoed, Parken & natuur en Uitzichtpunten.
*   **Limiet (Afstand of Tijd):** Je geeft aan hoever je wilt gaan (in km) of hoelang de trip mag duren (in minuten).
*   **Reismodus:** Keuze tussen **wandelen** of **fietsen**. Dit beïnvloedt de zoekstraal en de paden die worden gekozen.
*   **Rondtrip:** 
    *   *Standaardinstelling:* Elke trip is een rondtrip (een gesloten lus die terugkeert naar het startpunt). Dit is de vaste instelling van de applicatie om een complete stadservaring te garanderen.

---

### 2. Hoe het Algoritme Werkt
Het systeem gebruikt een gelaagd proces om van jouw trefwoorden een bruikbare route te maken:

#### A. Geocodering & Validatie
Zodra je een stad invoert, zet het systeem deze naam om in coördinaten via **Nominatim (OpenStreetMap)**. Als de naam niet direct wordt herkend (bijv. door een typefout), schakelt de app over op fallbacks zoals **Photon** of **Open-Meteo** om toch de juiste plek te vinden.

#### B. POI-verzameling (Het "Net" uitwerpen)
De app zoekt tegelijkertijd bij drie grote bronnen naar locaties die passen bij jouw interesses:
1.  **Google Places API:** Voor actuele winkels en populaire spots.
2.  **Foursquare:** Voor "hidden gems" en lokale favorieten.
3.  **OpenStreetMap (OSM):** Voor monumenten, kunst en natuur.

Het algoritme past hierbij een **vloek-filter** toe: het verwijdert automatisch irrelevante spots zoals parkeergarages, tandartsen, notarissen en supermarkten. 
*   **Restaurants, Cafés & Boekhandels:** Ook eetgelegenheden en boekwinkels worden standaard uit de resultaten gefilterd om de focus op bezienswaardigheden te houden. Deze worden **enkel** getoond indien je hier specifiek om vraagt (bijv. door "lunch" of "boekhandel" in je interesses op te nemen).

#### C. Slimme Routeberekening (Cheapest Insertion)
De app berekent een logisch pad dat standaard terugkeert naar het startpunt:
*   **Volgorde:** Het gebruikt een "Cheapest Insertion" strategie. Dit betekent dat als je een nieuwe stop toevoegt, de app berekent waar deze stop het beste tussen de huidige stops past met de **kleinst mogelijke omweg**.
*   **Echte Paden:** Via de **OSRM (OpenStreetMap Routing Machine)** wordt de route berekend over echte trottoirs en fietspaden, inclusief nauwkeurige afstanden en wandeltijden.

#### D. De "Intelligentie" Engine (AI Gids)
Voor elke stop op de route haalt onze **PoiIntelligence Engine** (gebaseerd op **Gemini AI**) informatie op bij **Wikipedia, DuckDuckGo en Google Search**. De AI combineert deze bronnen tot een verhaal dat:
1.  **Gepersonaliseerd** is (gebaseerd op jouw interesses).
2.  **Laden in twee stappen:** Eerst een snelle samenvatting (Fast Fetch), en daarna diepere details en verhalen (Deep Fetch) terwijl je de app gebruikt.

---

*City Explorer - Jouw slimme gids in de stad.*

# API & Data Overzicht

Dit document biedt een overzicht van alle externe diensten (API's) die CityExplorer gebruikt om routes te plannen, informatie te verzamelen en AI-verhalen te genereren.

---

## 💰 Overzicht Diensten & Kosten

CityExplorer is ontworpen om zo veel mogelijk gebruik te maken van **gratis lagen (Free Tiers)**. Voor intensief gebruik of premium functies kunnen kosten in rekening worden gebracht door de providers.

| Dienst | Functie | Provider | Kosten (Indicatie) |
| :--- | :--- | :--- | :--- |
| **Groq (Llama 3)** | Primaire AI (Snel & gratis) | Groq Cloud | **Gratis** (binnen ruime limieten) |
| **Tavily** | Slim Zoeken (AI Search) | Tavily AI | **Gratis** (tot 1000 zoekopdrachten/maand) |
| **OpenFreeMap** | Standaard Kaart (Vector) | OpenFreeMap | **Gratis** (Onbeperkt, geen key nodig) |
| **MapTiler** | Satelliet Kaart (Hybrid) | MapTiler | **Gratis** (100.000 tegels of 5.000 sessies/maand) |
| **Carto** | Achtergrondkaart (Fallback) | Carto | **Gratis** (Open Data) |
| **OSRM** | Routeberekening (Paden) | OpenStreetMap | **Gratis** (Open-source) |
| **Supabase** | Cloud POI Cache (Database) | Supabase | **Gratis** (voldoende voor 1M+ entries) |
| **Overpass** | Ontdekken van POI's | OpenStreetMap | **Gratis** (Open-source) |
| **Wikipedia** | Historische informatie | Wikimedia | **Gratis** |
| **
** | Premium AI (Optioneel) | Google Cloud | **Gratis** (tot bepaalde limiet per minuut) |
| **Google Maps** | Zoeken & Kaarten (Optioneel) | Google Cloud | **Betaald** (na verbruik van $200 gratis tegoed/maand) |
| **Resend** | Magic Link Emails (Login) | Resend | **Gratis** (tot 3.000 emails/maand) |

---

## 🧠 AI & Intelligentie

### Groq (Standaard)
Wij gebruiken Groq met het **Llama 3 70B** model als primaire motor. 
*   **Voordeel**: Extreem snel (vrijwel direct antwoord) en momenteel gratis voor ontwikkelaars.
*   **Gebruik**: Genereren van korte beschrijvingen en het begrijpen van jouw chat-berichten.

### Google Gemini (Premium/Backup)
Gemini wordt gebruikt voor complexere taken of als backup wanneer Groq niet beschikbaar is.
*   **Gebruik**: Diepgaande synthese van informatie uit meerdere bronnen.

### Tavily AI Search
In plaats van een normale Google zoekopdracht, gebruikt CityExplorer **Tavily**. 
*   **Waarom**: Tavily is specifiek gebouwd voor AI-agenten. Het vat webpagina's direct samen zodat de AI gids sneller en nauwkeuriger feiten kan checken.

---

## 🗺️ Kaart & Navigatie

### OpenFreeMap (Standaard)
Voor de dagelijkse kaartweergave gebruiken we **OpenFreeMap**. Dit is een moderne, open-source dienst die razendsnelle vectorkaarten levert.
*   **Voordeel**: Geen API-key nodig, volledig gratis en zeer hoge performantie.

### MapTiler (Satelliet)
De satellietbeelden (Hybrid modus) worden geleverd door **MapTiler**. 
*   **Kosten**: Gratis tot **100.000 tile requests** of **5.000 sessies** per maand. 
    *   *Gebruik*: Deze API wordt alleen aangesproken wanneer de gebruiker expliciet de satellietmodus inschakelt.

### Overpass API (Discovery & Data)
De Overpass API is het krachtigste onderdeel van OpenStreetMap voor het doorzoeken van ruwe geografische data.
*   **Functie**: Het razendsnel scannen van een hele stad op basis van filters (bijv. "zoek alle musea met een Wikipedia-artikel binnen 5km").
*   **Failover Strategie**: Omdat Overpass servers soms 'rate limits' hebben of tijdelijk offline gaan, gebruikt de app een lijst van wereldwijde servers waar willekeurig tussen wordt gewisseld:
    1.  `overpass-api.de` (Duitsland - Hoofdserver)
    2.  `overpass.openstreetmap.fr` (Frankrijk)
    3.  `overpass.kumi.systems` (Internationaal)
    4.  `overpass.osm.ch` (Zwitserland - Backup)
*   **Kosten**: Volledig gratis (Open Data).

### MapLibre GL (Rendering Engine)
Dit is de techniek die de kaart daadwerkelijk tekent in je browser. Het is een open-source library die bekend staat om zijn snelheid en soepele 3D-weergave.

### Foursquare
Foursquare is onze nummer één bron voor **foto's** en **beoordelingen**. Het zorgt ervoor dat de stops in jouw reis er visueel aantrekkelijk uitzien.

---

## 🏗️ Infrastructuur & Hosting

### Netlify (Hosting & Backend)
Het hele platform van CityExplorer draait op **Netlify**.
*   **Frontend**: De website zelf wordt wereldwijd verspreid via het Netlify CDN voor maximale snelheid.
*   **Netlify Functions**: CityExplorer maakt gebruik van serverless functies. Dit zijn kleine stukjes code die op de server draaien om veilig met API's te communiceren.
*   **Beveiliging**: Alle API-sleutels staan veilig op de server in Netlify, zodat ze nooit in de browser van de gebruiker terechtkomen.

### Supabase (Cloud Cache & Database)
Supabase fungeert als het "geheugen" van CityExplorer in de cloud.
*   **Functie**: Het opslaan van gegenereerde POI-informatie. Als één gebruiker een route in Berlijn plant, wordt die informatie opgeslagen zodat de volgende gebruiker die info direct uit de database krijgt.
*   **Voordeel**: Dit bespaart enorme hoeveelheden AI-kosten en maakt de app tot wel 10x sneller voor bekende locaties.
*   **Techniek**: Gebouwd op PostgreSQL, wat ook geavanceerde functies zoals *Semantic Search* mogelijk maakt in de toekomst.

### Resend (Authenticatie / Emails)
Resend wordt gebruikt om gebruikers veilig te laten inloggen zonder wachtwoorden.
*   **E-mail Login**: Gebruikers ontvangen een **Magic Link** in hun inbox. Door op deze link te klikken, worden ze direct en veilig ingelogd.
*   **Voordeel**: Geen wachtwoorden die gestolen kunnen worden, en een zeer soepele "onboarding" voor nieuwe gebruikers.

---

## 📈 Opschaling & Limieten
Voor een publieke release (bijv. in de App Store) is het belangrijk om rekening te houden met de limieten van deze gratis diensten. 

Zie het document [**Opschaling Strategie**](file:///c:/Users/geert/Documents/Github/CityExplorer/docs/OPSCHALING_STRATEGIE.md) voor een gedetailleerd plan over hoe we omgaan met duizenden gebruikers en het voorkomen van hoge kosten.

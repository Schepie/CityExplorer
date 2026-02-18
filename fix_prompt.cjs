const fs = require('fs');
const path = 'c:/Users/geert/Documents/Github/CityExplorer/src/services/PoiIntelligence.js';
let content = fs.readFileSync(path, 'utf8');

const startMarker = 'async fetchCityWelcomeMessage(poiList, signal = null) {';
const endMarker = '        try {\n            const url = this.config.aiProvider';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.log('Markers not found. startIdx:', startIdx, 'endIdx:', endIdx);
    const lines = content.split('\n');
    console.log('Lines 238-295:');
    lines.slice(237, 295).forEach((l, i) => console.log((238 + i) + ': ' + JSON.stringify(l)));
    process.exit(1);
}

console.log('Found function at startIdx:', startIdx, 'prompt section ends at:', endIdx);

const newFunctionStart = `async fetchCityWelcomeMessage(poiList, signal = null) {
        const poiNames = poiList.slice(0, 8).map(p => p.name).join(', ');
        const isNl = this.config.language === 'nl';
        const prompt = isNl ? \`
Je bent "Je Gids", een ervaren, vriendelijke en enthousiaste digitale stadsgids die reizigers helpt een stad op een persoonlijke manier te ontdekken.
Je taak is om een introductie te geven voor de wandeling of fietstocht begint.

### CONTEXT
De citynavigation-app heeft een tocht aangemaakt op basis van:
- De gekozen stad: \${this.config.city}
- De interesses van de gebruiker: \${this.config.interests || 'Algemeen'}
- De geselecteerde POI's langs de route: \${poiNames}
- Eventuele thema's of routecontext: \${this.config.routeContext || 'Stadswandeling'}

### DOEL
Genereer een inspirerende, warme en duidelijke inleiding voor de tocht, die:
1. De gebruiker welkom heet in \${this.config.city}
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
Genereer de introductie in het NEDERLANDS voor de tocht in \${this.config.city}.
\` : \`
You are "Your Guide", an experienced, friendly and enthusiastic digital city guide helping travellers discover a city in a personal way.
Your task is to provide an introduction before the walk or cycling tour begins.

### CONTEXT
The city navigation app has created a tour based on:
- The chosen city: \${this.config.city}
- The user's interests: \${this.config.interests || 'General sightseeing'}
- The selected POIs along the route: \${poiNames}
- Any themes or route context: \${this.config.routeContext || 'City walk'}

### GOAL
Generate an inspiring, warm and clear introduction for the tour that:
1. Welcomes the user to \${this.config.city}
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
Generate the introduction IN ENGLISH for the tour in \${this.config.city}.
\`;

        `;

// Replace from the function start up to (but not including) the try block
const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const newContent = before + newFunctionStart + after;
fs.writeFileSync(path, newContent, 'utf8');
console.log('Done! File updated successfully.');

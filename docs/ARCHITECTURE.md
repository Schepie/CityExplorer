# CityExplorer Architecture

## 1. High-Level Overview
CityExplorer is a **Single Page Application (SPA)** built with **React** and **Vite**. It leverages a **Serverless Architecture** (via Netlify Functions) to interact with external AI and Mapping APIs securely.

The application is designed to be a "Travel Companion" that combines standard map functionality with an **Agentic AI** ("The Brain") that can understand natural language, plan routes, and behave like a local guide.

### Core Tech Stack
- **Frontend**: React 19, Tailwind CSS (Styling), Leaflet (Maps).
- **Backend**: Netlify Functions (Node.js) acting as API Gateways.
- **AI**: Google Gemini (Pro/Flash models) for reasoning and content generation.
- **Data**: OpenStreetMap (Overpass API) for places, OSRM for routing, Wikipedia/Google for enrichment.

---

## 2. System Components

### A. Frontend (Client-Side)
The frontend is the command center. It manages state, user interaction, and data visualization.

*   **`App.jsx` (The Controller)**
    *   **Role**: Acts as the central brain of the frontend.
    *   **Responsibilities**:
        *   Manages Global State (`routeData`, `userLocation`, `aiChatHistory`).
        *   Orchestrates the "Journey" lifecycle (Start -> Search -> Route -> Navigate).
        *   Handles Audio/Voice I/O (Speech Recognition & Synthesis).
    *   **Key Logic**: Contains the `handleJourneyStart` and `processAIPrompt` functions which translate user intent into application actions.

*   **`ItinerarySidebar.jsx` ( The Interface)**
    *   **Role**: The primary control panel for the user.
    *   **Responsibilities**:
        *   Displays the Chat Interface (user inputs & AI responses).
        *   Shows the list of Stops (POIs) in the current route.
        *   Handles Voice Input (Microphone logic & Silence Detection).
        *   Provides controls for "Auto Audio", "Settings", and "Remove POI".

*   **`MapContainer.jsx` (The Visualization)**
    *   **Role**: Wrapper around Leaflet.js.
    *   **Responsibilities**:
        *   Renders the Map Tiles (CartoDB Dark Matter).
        *   Draws the Route Line (Polyline).
        *   Places Markers for POIs and User Location.
        *   Handles Map interactions (Popup clicks, Zooming).

*   **`PoiIntelligence.js` (The Intelligence Layer)**
    *   **Role**: A service class that "knows" everything about places.
    *   **Responsibilities**:
        *   **Triangulation**: Fetches data from multiple sources (Wikipedia, Google Search, OpenStreetMap) simultaneously.
        *   **Conflict Resolution**: Decides which source is most trustworthy.
        *   **Synthesis**: Uses Gemini AI to rewrite dry facts into a "Tour Guide" persona description.

### B. Backend (Serverless Functions)
To protect API keys and solve CORS (Cross-Origin Resource Sharing) issues, we do not call third-party APIs directly from the browser. Instead, we use Netlify Functions.

*   **`functions/gemini.js`**: Proxies requests to Google's AI models.
*   **`functions/google-places.js`**: Proxies requests to Google Maps API.
*   **`functions/overpass.js`**: Proxies requests to OpenStreetMap's Overpass API.

---

## 3. Data Flow

### Scenario: "Plan a trip to Hasselt"
1.  **User Input**: User speaks "Ik wil een fietsroute van 5km in Hasselt".
2.  **Voice Recognition**: Browser Web Speech API converts audio to text.
3.  **AI Processing**:
    *   Text is sent to `processAIPrompt` in `App.jsx`.
    *   App sends prompt to `PoiIntelligence` -> `gemini.js`.
    *   Gemini extracts JSON parameters: `{ city: "Hasselt", mode: "cycling", dist: 5 }`.
4.  **Searching**:
    *   App queries `Overpass API` for top-rated tourism spots in Hasselt.
    *   App filters results to find a cluster fitting the 5km constraint.
5.  **Routing**:
    *   App sends the chosen points to **OSRM (Open Source Routing Machine)**.
    *   OSRM returns the street-level path (coordinates).
6.  **Enrichment (Background)**:
    *   While the map loads, `PoiIntelligence` starts fetching Wikipedia articles and photos for each stop.
7.  **Presentation**:
    *   Map updates with the route.
    *   Sidebar shows the "Brain" response: "Ik heb een route gemaakt..." directly followed by speech output.

---

## 4. Key Algorithms

### 1. Intelligent Silence Detection
*   **Problem**: How to know when the user stops talking?
*   **Solution**: A dynamic timer (`ItinerarySidebar.jsx`).
    *   If the sentence looks complete (contains keywords like "km", "stad"), wait only **1.2s**.
    *   If the sentence looks short/incomplete, wait **2.5s**.
    *   On silence, automatically submit.

### 2. POI Triangulation
*   **Problem**: Where do we get descriptions? Wikipedia is incomplete, Google is expensive.
*   **Solution**: `PoiIntelligence.js`.
    *   It queries Wikipedia 1st (Free, High Quality).
    *   If missing, it queries Google Search Snippets (Broad coverage).
    *   It feeds raw snippets into Gemini to specific ask: "Rewrite this as a tour guide".

### 3. Audio Continuity
*   **Problem**: Clicking around shouldn't confuse the audio guide.
*   **Solution**: State-based Audio Manager in `App.jsx`.
    *   `handleSpeak(poi, force)` handles toggling.
    *   Prioritizes "Sidebar clicks" (User intent to learn) over "Map clicks" (Scanning).

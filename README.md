# CityExplorer

CityExplorer is an intelligent, AI-powered travel assistant that creates personalized routes for walking and cycling in any city. Unlike traditional map apps that compel you to plan everything yourself, CityExplorer acts as a local guide: tell it what you want, and it builds a route, guides you, and tells stories about the places you visit.

## 📚 Documentation

We have detailed documentation available in the `docs/` folder:

*   **[User Manual (Handleiding)](docs/HANDLEIDING.md)**:
    A guide for non-technical users explaining how to use the AI Planner, Voice controls, and Audio Guide.
    *(Nederlandstalige handleiding voor eindgebruikers)*

*   **[Architecture Overview](docs/ARCHITECTURE.md)**:
    A high-level look at how the system is built, including the "Brain" (AI), Voice processing, and Data flow.
    *(Technical architecture document)*

*   **[Technical Modules](docs/MODULES.md)**:
    Deep dive into the external libraries (Leaflet, Gemini, React) and internal services (`PoiIntelligence`, `ItinerarySidebar`).
    *(Detailed technical reference)*

## 🚀 Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env` and add your API keys (Google Gemini, etc.):
    ```bash
    cp .env.example .env
    ```

3.  **Run Locally**
    Start both the frontend and the backend functions:
    ```bash
    npm run dev
    ```

## 🌟 Key Features

*   **🗣️ Verbal Interface**: Talk to the app naturally ("I want a short walk in Ghent").
*   **🧠 AI "Brain"**: Uses Large Language Models to interpret intent and rewrite POI descriptions.
*   **🎧 Auto-Audio Guide**: Automatically reads stories when you approach a landmark.
*   **🗑️ Dynamic Re-routing**: Remove a stop, and the route instantly recalculates.
*   **✏️ Route Refinement**: Drag and drop to reorder stops, or click on the map to add new points significantly.
*   **🌍 Universal Coverage**: Works anywhere with OpenStreetMap data.

## License

Private Project.

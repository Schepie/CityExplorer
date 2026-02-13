# Changelog

All notable changes to this project will be documented in this file.

## [3.1.1] - 2026-02-12

### Added
- **Free API Migration**: Full switch to Groq Cloud (Llama 70B) and Tavily Search for a 100% free/open-source stack.
- **Overpass Failover Logic**: Automatic rotation between 3 server mirrors on rate limits or timeouts.
- **AI Retry System**: Implemented exponential backoff for AI description fetches to handle 429 errors.

### Changed
- **Overpass Optimization**: Switched to `nwr` geometry and UNION queries for faster results in large radii.
- **Timeouts**: Increased server timeout to 90s and client timeout to 120s for complex searches.

### Fixed
- **Syntax Fixes**: Resolved various breakage in AI enrichment logic caused by partial updates.

## [2.1.2] - 2026-02-10

### Added
- **Sequential Numbering**: Implemented a unified numbering system that interleaves manual stops and discovered POIs based on their actual order along the route.
- **Diamond Markers**: Manual route markers (except Start) are now smaller and diamond-shaped to distinguish them from discovery POIs.

### Changed
- **Discovery Perimeter**: Increased the POI discovery range from 50m to 100m for better coverage.
- **UI Consistency**: Hiden the "Discover Now" card in Classic mode to reduce clutter.

### Fixed
- **JSX Stability**: Resolved a rendering bug in `MapContainer.jsx` that could break marker displays.

## [2.1.1] - 2026-02-09 (Internal)
- Performance and stability fixes for route calculation.

## [2.1.0] - 2026-02-09

### Added
- **Corridor POI Discovery**: POI searches now strictly filter results within a 50-meter buffer of the actual route path, ensuring maximum relevance.
- **User-Triggered Discovery**: Replaced automatic POI loading with a dedicated "Discover Now" trigger after route creation.
- **Persistent Route Markers**: Numbered route markers (1, 2, 3...) now remain visible on the map after route finalization.
- **Nominatim Proxy**: Fixed CORS and 403 errors by routing OpenStreetMap/Nominatim requests through a secure internal proxy.

### Changed
- **POI/Marker Separation**: Internal state refactored to treat user-defined stops and discovered POIs as distinct layers.
- **Sidebar Transition**: Improved sidebar logic to ensure the itinerary view persists correctly after "Finish" is clicked, even while POIs are still being discovered.

### Fixed
- **Marker Visualization**: Resolved a prop mismatch that caused markers to be invisible during the map selection process.
- **ReferenceErrors**: Fixed multiple JS errors in `App.jsx` and `ItinerarySidebar.jsx` related to state management during route finalization.

## [2.0.1] - 2026-02-07
- Initial V2 release with refactored navigation and HUD.
- Integration of spoken navigation features.

## [1.8.0] - 2026-02-04

### Added
- **Route Refinement Tool**: New interface for modifying existing routes, including changing travel modes and adjusting distance.
- **Map Point Picking**: Ability to click a point on the map to add it directly to the route.
- **Inline Search**: Integrated search for interests and specific places directly within the Route Refiner.

### Changed
- **Route Options**: Simplified planning interface to enforce loop routes throughout.
- **Settings Menu**: Streamlined "Simulation", "Auto Audio", and "Autosave" options into direct toggles.
- **UI/UX Improvements**: 
    - "Quick Add" POI now auto-recalculates and shows the map.
    - Fixed "Map Pick" mode to properly clear previous data.
    - Route finalization now correctly returns to the itinerary view.
    - "Restart" button now triggers the initial questionnaire.

## [1.7.1] - 2026-02-03 (Estimated)
- Various bug fixes and refinements based on user feedback (see commit history).

## [1.6.0] - 2026-01-29

### Added
- **Major Security Update**: Implemented full JWT authentication for all internal API endpoints (Gemini, Google Search, Nominatim, Booklet, etc.).
- **Admin Relay System**: Integrated manual email relay for magic links to support Resend's free tier domain limitations.
- **Dual-Login Mode**:
    - Users can now sign in using a **Magic Link** (direct URL).
    - Added support for **6-digit Access Codes** as a stateless alternative.
- **User Revocation**: Centralized blocklist system using `BLOCKED_EMAILS` environment variable.
- **Account Locked UI**: Dedicated high-contrast screen for blocked users with pre-filled administrator contact link.
- **Authenticated Fetch Utility**: Created `apiFetch` wrapper to automatically handle authorization headers across the frontend.
- **Access Code UI**: Redesigned `LoginModal` with a tabbed interface for easier access.

### Fixed
- Resolved `401 Unauthorized` errors on search and AI generation requests.
- Fixed a startup crash caused by legacy authentication imports in `App.jsx`.
- Standardized cross-origin API proxy calls to include identity headers.

---

## [1.5.1] - 2026-01-27
- Fixes for Icon setup and initial Netlify deployment configurations.

## [1.5.0] - 2026-01-25
- Initial Authentication prototype.
- Base Magic Link implementation.

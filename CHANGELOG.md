# Changelog

All notable changes to this project will be documented in this file.

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

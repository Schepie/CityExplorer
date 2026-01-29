# Changelog

All notable changes to this project will be documented in this file.

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

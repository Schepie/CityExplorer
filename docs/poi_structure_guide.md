# POI Technical Structure Guide

This document explains how Point of Interest (POI) data is structured and rendered in the **Sidebar** and **Map Window** (Popup).

## 1. Data Structure (`poi.structured_info`)

The application uses an enhanced `poi` object. The core data resides in `structured_info`.

```javascript
/* POI Object Structure */
{
  "id": "123",
  "name": "Cathedral of St. Quintinus",
  "description": "Basic fallback description...", // Used if structured_info is missing
  "active_mode": "short" | "medium" | "max", // Controls Sidebar display level
  "structured_info": {
     "short_description": "A brief 2-sentence summary...",
     "standard_description": "A standard paragraph...",
     "full_description": "A comprehensive guide-style text...",
     "one_fun_fact": "Did you know...?",
     "matching_reasons": ["Architecture", "History"],
     "visitor_tips": ["Visit before noon", "Free entry"],
     "if_you_only_have_2_minutes": "Just see the main altar."
  }
}
```

## 2. Rendering Logic

### A. Map Window (Popup)
**File:** `src/components/MapContainer.jsx`

The Map Popup is designed to be **static** and **concise**. It deliberately ignores the Sidebar's expansion state (`active_mode`) to keep the map view clean.

-   **Logic**:
    1.  Checks if `structured_info` exists.
    2.  **Always** attempts to use `structured_info.active_mode` (dynamic) OR defaults to specific logic.
    3.  *Current State*: It respects the user's toggle choice inside the popup (Brief/Std/Detailed) if those buttons exist, or uses the global/local `active_mode`.

*(Note: If you recently asked to revert changes, the map popup currently HAS buttons to toggle Short/Std/Full mode locally).*

### B. Sidebar (Itinerary)
**File:** `src/components/ItinerarySidebar.jsx`

The Sidebar is **dynamic** and **progressive**. It supports the "Two-Stage Enrichment" flow.

-   **Logic**:
    -   **Stage 1 (Loading)**: Shows `short_description` with a specific visual style (e.g., Orange/Faded icon).
    -   **Stage 2 (Loaded)**: When the user expands a card, it shows rich details based on `structured_info` fields like `matching_reasons`, `visitor_tips`, etc.
    -   **Speech**: When the "Read Aloud" feature is active, it reads the text corresponding to the current visible length.

---

## 3. Modification Prompt

If you wish to modify how this data is displayed (e.g., to make the Map Popup static again, or change the Sidebar layout), you can use the following prompt with this agent:

### Prompt Template

> **Request**: Modify the POI display logic.
>
> **Target Component**: [MapContainer.jsx / ItinerarySidebar.jsx]
>
> **Goal**: [Describe goal, e.g., "Force the Map Popup to always show short description only"]
>
> **Specific Rules**:
> 1. For **MapContainer.jsx**: [e.g., "Remove the mode switcher buttons and ignore active_mode property, using short_description only."]
> 2. For **ItinerarySidebar.jsx**: [e.g., "Keep the progressive loading but hide the 'Fun Fact' section."]

---

### Example: Making Map Popup Static (Short Only)

> "Please modify `MapContainer.jsx`. Remove the Brief/Standard/Detailed buttons from the popup. Change the rendering logic to ALWAYS display `structured_info.short_description`, ignoring `active_mode`. The Sidebar should remain unchanged."

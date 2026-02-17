# POI Formatting and Presentation Guide

This document outlines how Points of Interest (POIs) are formatted, enriched, and presented across the CityExplorer application. The system uses a multi-layered approach to provide the right amount of information at the right time (Short -> Medium -> Long).

## 1. Data Structure (`PoiIntelligence`)

The AI service (`src/services/PoiIntelligence.js`) enriches raw POIs into a standardized `structured_info` object. This ensures consistency regardless of the data source (Wikipedia, Google, Overpass).

### Structured Info Schema
```json
{
  "short_description": "Catchy 1-2 sentence summary (approx. 50 words). Used for quick scanning.",
  "standard_description": "Balanced paragraph (approx. 100-150 words). The default 'Guide' voice.",
  "full_description": "Detailed text (200+ words). Deep dive into history and context.",
  "one_fun_fact": "A single intriguing anecdote.",
  "fun_facts": ["List of 2-4 fun facts"],
  "matching_reasons": ["Why this matches user interests"],
  "visitor_tips": "Practical tips (e.g. 'Best visited at sunset')",
  "two_minute_highlight": "What to see if in a rush"
}
```

---

## 2. Detail Levels

### Level 1: Short (Scanning)
- **Purpose**: Quick identification in lists.
- **Content**: `short_description`.
- **Usage**: 
  - Initial Sidebar List (before expansion).
  - Map Tooltips (hover).

### Level 2: Standard/Medium (Interaction)
- **Purpose**: The main "Tour Guide" experience. informative but digestible.
- **Content**: `standard_description` + optional `one_fun_fact`.
- **Usage**:
  - **Map Popups**: When a marker is clicked.
  - **Sequential Audio**: Read aloud when arriving at a location.
  - **Sidebar Expanded View**: When a user clicks a trip card.

### Level 3: Extended/Long (Deep Dive)
- **Purpose**: For users who want to learn everything.
- **Content**: `full_description` + `fun_facts` + `matching_reasons`.
- **Usage**:
  - "Read More" modal or full detail view (if implemented).
  - "Tell me more" audio command.

---

## 3. UI Presentation

### A. Itinerary Sidebar
The sidebar displays the route as a chronological timeline.

*   **Collapsed State**:
    *   Shows **Name**, **Category Icon**, and **Travel Time** to next stop.
    *   Action: Click to expand.
*   **Expanded State**:
    *   Shows **Image** (if available).
    *   Displays `standard_description` (or fallback to `description`).
    *   Shows `visitor_tips` if available as a "Pro Tip" badge.
    *   **Audio Button**: Triggers the Text-to-Speech for the *Standard* level.

### B. Map Window (Popups)
The map uses custom Leaflet popups with a Glassmorphism design (`glass-popup` class).

*   **Design**: 
    *   Semi-transparent blur background (`backdrop-filter: blur(8px)`).
    *   Rounded corners, shadow.
*   **Content**:
    *   **Title**: POI Name (Bold, Slate-900).
    *   **Body**: `standard_description` (Slate-700, `text-sm`).
    *   **Scroll**: If text > 300px height, a custom `SmartAutoScroller` automatically scrolls text during audio playback.
*   **Special Cases**:
    *   **Start Point**: 
        *   Title: "Start Point" (or specific name like "UZ Leuven").
        *   Body: `startInfo` (Arrival/Parking instructions).
        *   Text formatting: `whitespace-pre-wrap` to preserve formatting, `min-w-[240px]` to ensure readability.

## 4. AI Response Hygiene

To ensure the application remains stable and user-friendly, all AI-generated content follows strict hygiene rules.

### Strict JSON Output
All descriptors are fetched as JSON. The AI is instructed to:
*   Return **only** valid JSON.
*   Avoid explaining anything outside the JSON block.
*   Properly escape double quotes (`\"`) within the text.
*   Avoid using raw markdown (like `**bold**` or `*italics*`) within the strings, as this interferes with the Text-to-Speech (TTS) engine.

### Automated Cleaning Pipeline
The `PoiIntelligence.js` service runs a regex-based cleaning pipeline before parsing:
1.  **Remove Reasoning**: Strips `<think>...</think>` tags used by "Chain of Thought" models.
2.  **Strip Markdown Blocks**: Removes ` ```json ` and ` ``` ` fences.
3.  **Trim**: Cleans whitespace from both ends.

### Raw JSON Leak Prevention
If the AI response fails JSON parsing, the system checks for keywords like `short_description` or `full_description`. 
- **If detected**: The system assumes it is malformed JSON and returns `null`. This triggers a fallback to Wikipedia or Google Search instead of displaying raw code to the user.

## 5. Audio Formatting
The app uses the same data for audio but strips residual Markdown:
*   **Auto-Play**: Reads the `standard_description`.
*   **Interaction**: User can request "More details" -> Reads `full_description`.
*   **Clarity**: Descriptions are written in short, natural sentences to sound more human when read by the browser's speech synthesis.

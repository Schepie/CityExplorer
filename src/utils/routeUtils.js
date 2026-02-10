import { getPointProgressOnPath } from './geometry';

/**
 * Route Utilities
 * 
 * Contains functions for manipulating journeys and itineraries.
 */

/**
 * Cyclically rotates an array of points for a roundtrip route.
 * This is a pure function with O(n) complexity.
 * 
 * Logic:
 * If the original route is [A, B, C, D, E] and the user picks C as the start,
 * the rotation results in [C, D, E, A, B].
 * 
 * @param {Array} items - The list of items in the route cycle (e.g., [Start, POI1, POI2, ...])
 * @param {string|number} selectedIdOrIndex - The ID or index of the item that should become the new start.
 * @returns {Array} The rotated list where items[0] is the new starting point.
 */
export const rotateCycle = (items, selectedIdOrIndex) => {
    if (!items || items.length === 0) return [];

    let targetIndex = -1;
    if (typeof selectedIdOrIndex === 'number' && selectedIdOrIndex >= 0 && selectedIdOrIndex < items.length) {
        targetIndex = selectedIdOrIndex;
    } else {
        targetIndex = items.findIndex(item => item.id === selectedIdOrIndex);
    }

    if (targetIndex === -1) return [...items]; // No rotation if not found

    // Perform cyclic rotation: O(n) complexity, no mutation
    return [
        ...items.slice(targetIndex),
        ...items.slice(0, targetIndex)
    ];
};

/**
 * Example Usage & Unit Test Case:
 * 
 * const original = [
 *   { id: 'S', name: 'Start' },
 *   { id: 'A', name: 'POI A' },
 *   { id: 'B', name: 'POI B' },
 *   { id: 'C', name: 'POI C' }
 * ];
 * 
 * const rotated = rotateCycle(original, 'B');
 * 
 * Result: [
 *   { id: 'B', name: 'POI B' },
 *   { id: 'C', name: 'POI C' },
 *   { id: 'S', name: 'Start' },
 *   { id: 'A', name: 'POI A' }
 * ]

/**
 * Reverses the direction of a cycle while keeping the anchor point at index 0.
 * This is a pure function with O(n) complexity.
 * 
 * Logic:
 * If the route is [Start, A, B, C], the reversed cycle is [Start, C, B, A].
 * 
 * @param {Array} items - The list of items (already rotated if a specific start is desired).
 * @returns {Array} The list with reversed direction, matching the anchor at items[0].
 */
export const reverseCycle = (items) => {
    if (!items || items.length <= 1) return [...(items || [])];

    // Copy to avoid mutation and reverse the non-anchor part
    const anchor = items[0];
    const rest = items.slice(1);
    return [anchor, ...rest.reverse()];
};

/**
 * Example Usage & Unit Test Case (Reversal):
 * 
 * const original = [
 *   { id: 'C', name: 'Start' },
 *   { id: 'D', name: 'POI D' },
 *   { id: 'E', name: 'POI E' },
 *   { id: 'A', name: 'POI A' },
 *   { id: 'B', name: 'POI B' }
 * ];
 * 
 * const reversed = reverseCycle(original);
 * 
 * Result: [
 *   { id: 'C', name: 'Start' },
 *   { id: 'B', name: 'POI B' },
 *   { id: 'A', name: 'POI A' },
 *   { id: 'E', name: 'POI E' },
 *   { id: 'D', name: 'POI D' }
 * ]
 */

/**
 * Interleaves manual route markers and discovered POIs based on their progress along the path.
 * 
 * @param {Array} manualMarkers - Manual points (persistentMarkers)
 * @param {Array} pois - Discovered POIs
 * @param {Array} routePath - The full polyline coordinates
 * @returns {Array} Interleaved list starting with Start, then ordered points.
 */
export const interleaveRouteItems = (manualMarkers, pois, routePath) => {
    if (!routePath || routePath.length < 2) {
        // Fallback if no path (shouldn't happen with discovery results)
        return [(manualMarkers[0] || {}), ...(manualMarkers.slice(1)), ...pois];
    }

    const startPoint = { ...manualMarkers[0], isSpecial: true, specialType: 'start' };
    const intermediateMarkers = manualMarkers.slice(1).map(m => ({ ...m, isManualMarker: true }));
    const allStops = [...intermediateMarkers, ...pois];

    // Assign progress to each stop
    const stopsWithProgress = allStops.map(stop => ({
        ...stop,
        progress: getPointProgressOnPath({ lat: stop.lat, lng: stop.lng }, routePath)
    }));

    // Sort by progress
    stopsWithProgress.sort((a, b) => a.progress - b.progress);

    return [startPoint, ...stopsWithProgress];
};

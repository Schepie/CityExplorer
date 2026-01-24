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

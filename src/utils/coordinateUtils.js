/**
 * Coordinate Validation Utilities
 * Provides robust validation for geographic coordinates to prevent MapLibre errors.
 */

/**
 * Validates a single coordinate pair.
 * @param {Array|null} coord - Coordinate array in [lng, lat] or [lat, lng] format
 * @returns {boolean} True if coordinate is valid (both elements are finite numbers)
 */
export const isValidCoord = (coord) => {
    return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) &&
        !isNaN(coord[1]) &&
        isFinite(coord[0]) &&
        isFinite(coord[1])
    );
};

/**
 * Sanitizes an array of coordinates by filtering out invalid entries.
 * @param {Array} coords - Array of coordinate pairs
 * @param {string} name - Descriptive name for logging purposes
 * @returns {Array} Filtered array containing only valid coordinates
 */
export const sanitizePath = (coords, name = 'path') => {
    if (!Array.isArray(coords)) {
        console.warn(`[CoordValidation] Invalid path "${name}": not an array`);
        return [];
    }

    const valid = coords.filter((coord, index) => {
        if (!isValidCoord(coord)) {
            console.warn(`[CoordValidation] Invalid coordinate at index ${index} in "${name}":`, coord);
            return false;
        }
        return true;
    });

    const removed = coords.length - valid.length;
    if (removed > 0) {
        console.warn(`[CoordValidation] Removed ${removed} invalid coordinate(s) from "${name}"`);
    }

    return valid;
};

/**
 * Transforms OSRM coordinates [lng, lat] to [lat, lng] format with validation.
 * @param {Array} coords - Array of OSRM coordinates in [lng, lat] format
 * @param {string} name - Descriptive name for logging purposes
 * @returns {Array} Array of coordinates in [lat, lng] format, with invalid entries removed
 */
export const transformOSRMCoords = (coords, name = 'osrm_path') => {
    if (!Array.isArray(coords)) {
        console.warn(`[CoordValidation] Cannot transform "${name}": not an array`);
        return [];
    }

    console.log(`[CoordValidation] Transforming ${coords.length} coordinates for "${name}"`);

    const transformed = coords
        .filter((c, index) => {
            if (!isValidCoord(c)) {
                console.warn(`[CoordValidation] Skipping invalid OSRM coordinate at index ${index} in "${name}":`, c);
                return false;
            }
            return true;
        })
        .map(c => [c[1], c[0]]); // Swap from [lng, lat] to [lat, lng]

    if (transformed.length !== coords.length) {
        console.warn(`[CoordValidation] Filtered ${coords.length - transformed.length} invalid coordinates from "${name}"`);
    }

    return transformed;
};

/**
 * Validates and sanitizes a point object with lat/lng properties.
 * @param {Object} point - Point object with lat and lng properties
 * @param {Array} fallback - Default [lat, lng] to use if point is invalid
 * @returns {Object} Validated point with numeric lat and lng
 */
export const sanitizePoint = (point, fallback = [52.3676, 4.9041]) => {
    if (!point) {
        console.warn('[CoordValidation] Null point provided, using fallback');
        return { lat: fallback[0], lng: fallback[1] };
    }

    const lat = typeof point.lat === 'number' && isFinite(point.lat) ? point.lat : fallback[0];
    const lng = typeof point.lng === 'number' && isFinite(point.lng) ? point.lng : fallback[1];

    if (lat !== point.lat || lng !== point.lng) {
        console.warn('[CoordValidation] Point has invalid coordinates, using fallback:', point);
    }

    return { ...point, lat, lng };
};

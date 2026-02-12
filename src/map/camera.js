/**
 * Centers the map on a given LatLng but with a pixel offset (anchor).
 * For example, anchor [0.5, 0.7] puts the point at 50% width and 70% height.
 * 
 * @param {L.Map} map - Leaflet map instance
 * @param {L.LatLng} latLng - The coordinate to "center" on
 * @param {number[]} anchorPercent - [xPercent, yPercent] (0 to 1)
 */
export const panUserToAnchor = (map, latLng, anchorPercent = [0.5, 0.7]) => {
    if (!map || !latLng) return;

    const [anchorX, anchorY] = anchorPercent;
    const size = map.getSize();

    // Project the latLng to container pixels
    const point = map.latLngToContainerPoint(latLng);

    // Calculate the target pixel position
    const targetX = size.x * anchorX;
    const targetY = size.y * anchorY;

    // Find the difference
    const dx = point.x - targetX;
    const dy = point.y - targetY;

    // Pan the map by that difference
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        map.panBy([dx, dy], { animate: true, duration: 0.5 });
    }
};

/**
 * Simple heuristic for auto-zoom based on a look-ahead distance.
 * @param {number} distanceMeters 
 * @param {number} currentZoom 
 * @returns {number} targetZoom
 */
export const autoZoomFor = (distanceMeters, currentZoom) => {
    // If we have a lot of route ahead, zoom out slightly. If close, zoom in.
    if (distanceMeters > 500) return 15;
    if (distanceMeters < 150) return 18;
    return 16;
};

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-maplibre';
import { calcBearing } from '../utils/geometry';

/**
 * NavigationMapHeadingUp Component
 * MapLibre sub-component that handles the "Heading-Up" camera logic.
 * Keeps the user in the lower portion of the screen and rotates the map
 * so the direction of travel points upwards.
 */
const NavigationMapHeadingUp = ({
    isNavigating,
    userLocation,
    is3DMode = true,
    isFollowing = true
}) => {
    const { current: map } = useMap();
    const prevLocationRef = useRef(null);
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        if (!map || !isNavigating || !userLocation || !isFollowing) {
            // Reset rotation if navigation or following is stopped?
            // Usually we leave it as is until a "North-Up" button is pressed.
            prevLocationRef.current = userLocation;
            return;
        }

        // Robustness: Ensure coordinates are valid numbers
        if (typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number' || isNaN(userLocation.lat) || isNaN(userLocation.lng)) {
            return;
        }

        const now = Date.now();
        if (now - lastUpdateRef.current < 100) return; // Throttle (10fps)
        lastUpdateRef.current = now;

        const currentPos = { lat: userLocation.lat, lng: userLocation.lng };
        const prevPos = prevLocationRef.current;

        // Calculate heading (bearing) from previous to current position
        let bearing = userLocation.heading; // Use device heading if available

        if (bearing === null || bearing === undefined) {
            if (prevPos && (prevPos.lat !== currentPos.lat || prevPos.lng !== currentPos.lng)) {
                bearing = calcBearing(prevPos, currentPos);
            } else {
                // If no movement, keep previous bearing
                bearing = map.getBearing();
            }
        }

        // GPS Accuracy Filter: If accuracy is poor (>20m), reduce update frequency
        const gpsAccuracy = userLocation.accuracy || 999; // meters
        if (gpsAccuracy > 20 && prevPos) {
            // Only update if movement is significant (>10m) when accuracy is poor
            const distance = Math.sqrt(
                Math.pow((currentPos.lat - prevPos.lat) * 111000, 2) +
                Math.pow((currentPos.lng - prevPos.lng) * 111000, 2)
            );
            if (distance < 10) {
                return; // Skip update for small movements with poor GPS
            }
        }

        // Apply easeTo with biased padding for look-ahead
        const currentBearing = map.getBearing();
        let finalBearing = bearing;

        // Enhanced bearing smoothing with exponential moving average
        if (Math.abs(bearing - currentBearing) < 5) {
            // Very small changes: keep current bearing (jitter filter)
            finalBearing = currentBearing;
        } else if (Math.abs(bearing - currentBearing) < 30) {
            // Moderate changes: smooth with 70% current + 30% new
            finalBearing = currentBearing * 0.7 + bearing * 0.3;
        }
        // Large changes (>30°): accept new bearing immediately (real turn)

        // Adjust camera to place user at bottom 1/5 ( ~80% height)
        const h = map.getCanvas().clientHeight;
        const targetY = h * 0.8;
        const centerOffset = targetY - (h / 2);

        // Adjust top padding to push center down
        // With bottom padding fixed at ~180px for controls
        const bottomPad = 180;
        const topPad = (centerOffset * 2) + bottomPad;

        // Sanitize all values before easeTo
        const safeBearing = Number.isFinite(finalBearing) ? finalBearing : (map.getBearing() || 0);
        const safePadding = {
            top: Number.isFinite(topPad) ? Math.max(0, topPad) : 0,
            right: 24,
            bottom: bottomPad,
            left: 24
        };

        map.easeTo({
            center: [currentPos.lng, currentPos.lat],
            bearing: safeBearing,
            pitch: is3DMode ? 60 : 0,
            padding: safePadding,
            duration: 100, // Match throttle
            easing: (t) => t, // Linear easing for constant velocity
            essential: true
        });

        prevLocationRef.current = userLocation;

    }, [map, isNavigating, userLocation, isFollowing]);

    return null;
};

export default NavigationMapHeadingUp;

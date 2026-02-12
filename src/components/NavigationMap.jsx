import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { findPointAhead } from '../map/lookAhead';
import { panUserToAnchor, autoZoomFor } from '../map/camera';
import { useFollowMode } from '../map/useFollowMode';

/**
 * NavigationMap Component
 * React-Leaflet component that wires GPS/Route updates to the camera logic.
 * Throttle: 200ms
 */
const NavigationMap = ({
    isNavigating,
    userLocation,
    polyline,
    onRecenterVisible,
    viewAction,
    onActionHandled
}) => {
    const map = useMap();
    const { isFollowing, recenter } = useFollowMode(isNavigating);
    const lastUpdateRef = useRef(0);

    // Sync recenter logic with explicit USER action
    useEffect(() => {
        if (viewAction === 'USER') {
            recenter();
            // We don't call onActionHandled here because MapController
            // ALSO needs to see the USER action to perform the initial flyTo.
        }
    }, [viewAction, recenter]);

    // Expose recenter to parent if needed (e.g. for a UI button)
    useEffect(() => {
        if (onRecenterVisible) {
            onRecenterVisible(!isFollowing);
        }
    }, [isFollowing, onRecenterVisible]);

    useEffect(() => {
        if (!isNavigating || !userLocation || !isFollowing) return;

        const now = Date.now();
        if (now - lastUpdateRef.current < 200) return; // Throttle 200ms
        lastUpdateRef.current = now;

        // 1. Find look-ahead point
        // Heuristic: looks ahead 300m for general city navigation
        const lookAheadDist = 300;
        const pAhead = findPointAhead(polyline, userLocation, lookAheadDist);

        // 2. Adjust Zoom (Optional heuristic)
        // const targetZoom = autoZoomFor(lookAheadDist, map.getZoom());
        // if (Math.abs(map.getZoom() - targetZoom) > 0.5) {
        //     map.setZoom(targetZoom);
        // }

        // 3. Pan to anchor (50% width, 70% height)
        // This keeps the user at the bottom while North-Up is maintained (no rotation)
        panUserToAnchor(map, userLocation, [0.5, 0.7]);

    }, [map, isNavigating, userLocation, polyline, isFollowing]);

    // Handle manual recenter trigger from parent
    useEffect(() => {
        // This is a pattern where we might want to expose recenter function 
        // but for now we'll rely on the FSM state.
    }, [recenter]);

    return null;
};

export default NavigationMap;

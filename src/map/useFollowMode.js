import { useState, useCallback, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

/**
 * Hook to manage the "Follow Mode" state.
 * Pauses following when the user interacts with the map.
 * 
 * @param {boolean} isNavigating - Current navigation state
 * @returns {Object} { isFollowing, recenter }
 */
export const useFollowMode = (isNavigating) => {
    const [isFollowing, setIsFollowing] = useState(true);
    const interactionTimeout = useRef(null);

    const pauseFollowing = useCallback(() => {
        if (isNavigating) {
            setIsFollowing(false);
            // Optional: Auto-resume after some inactivity? 
            // Usually simpler to require manual recenter per user request.
        }
    }, [isNavigating]);

    const recenter = useCallback(() => {
        setIsFollowing(true);
    }, []);

    // Listen to Leaflet events
    useMapEvents({
        dragstart: () => {
            console.log('FollowMode: User dragged map, pausing.');
            pauseFollowing();
        },
        zoomstart: () => {
            console.log('FollowMode: User zoomed map, pausing.');
            pauseFollowing();
        },
        touchstart: () => {
            // Touch can precede drag
            if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
        }
    });

    return { isFollowing, recenter };
};

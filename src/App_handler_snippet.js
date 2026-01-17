
const handleNavigationRouteFetched = (steps) => {
    console.log("Navigation steps updated from MapContainer:", steps.length);
    setRouteData(prev => {
        if (!prev) return prev;
        return {
            ...prev,
            navigationSteps: steps
        };
    });
    // Optionally open the navigation overlay if not open
    setIsNavigationOpen(true);
};


// Native fetch in Node 18+

const run = async () => {
    // 1. Coordinates (Approximate from screenshot/logs)
    const start = { lat: 50.8799045, lng: 4.6764655 }; // Parking Oost

    // UZ Leuven Campus (POI 1 candidate - guessed location based on screenshot "Orange 1")
    // It's likely "Ziekenhuis Oost" or similar nearby. 
    // Let's pick a point slightly east along the road.
    const p1 = { lat: 50.8795, lng: 4.6780 };

    // POI 2 (Further east)
    const p2 = { lat: 50.8810, lng: 4.6850 };

    const waypoints = [
        `${start.lng},${start.lat}`,
        `${p1.lng},${p1.lat}`,
        `${p2.lng},${p2.lat}`
    ];

    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${waypoints.join(';')}?overview=full&geometries=geojson&steps=true`;

    console.log("Fetching OSRM:", url);

    try {
        const res = await fetch(url);
        const json = await res.json();

        if (json.routes && json.routes.length > 0) {
            const route = json.routes[0];
            console.log(`Total Distance: ${route.distance}m`);

            route.legs.forEach((leg, idx) => {
                console.log(`Leg ${idx}: ${leg.distance}m`);
                if (leg.steps) {
                    console.log(`  Steps: ${leg.steps.length}`);
                    leg.steps.forEach(s => console.log(`    - ${s.maneuver.type} ${s.maneuver.modifier || ''} on ${s.name}`));
                }
            });
        } else {
            console.log("No route found", json);
        }
    } catch (e) {
        console.error("Error", e);
    }
};

run();

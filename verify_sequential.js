
const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const run = () => {
    const start = { lat: 50.8799, lng: 4.6765 }; // Parking Oost

    // Candidates
    const candidates = [
        { name: "Het Teken (Close)", lat: 50.8803, lng: 4.6770 }, // ~50m?
        { name: "Leuvens Historisch (Far)", lat: 50.8790, lng: 4.7000 },
        { name: "Parking Oost (Self)", lat: 50.8799, lng: 4.6765 }
    ];

    console.log("Start:", start);

    const sorted = candidates.map(c => ({
        ...c,
        distFromStart: calcDist(start.lat, start.lng, c.lat, c.lng)
    }))
        .sort((a, b) => a.distFromStart - b.distFromStart);

    console.log("\n--- All Candidates (Sorted by Dist) ---");
    sorted.forEach(c => console.log(`${c.name}: ${c.distFromStart.toFixed(4)} km (${(c.distFromStart * 1000).toFixed(1)} m)`));

    console.log("\n--- Filtering > 0.25 km (250m) ---");
    const filtered = sorted.filter(c => c.distFromStart > 0.25);
    filtered.forEach(c => console.log(`KEPT: ${c.name}`));

    console.log("\n--- Filtering > 0.05 km (50m) ---");
    const filtered50 = sorted.filter(c => c.distFromStart > 0.05);
    filtered50.forEach(c => console.log(`KEPT: ${c.name}`));
};

run();

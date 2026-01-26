
const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const run = () => {
    // 1. Simulate "Parking Oost" coordinates (Nominatim)
    // From logs: 50.87981195, 4.675551375559714 (Photon) or 50.8799045, 4.6764655 (Nominatim)
    const parkingOost = { lat: 50.8799045, lng: 4.6764655 };
    console.log("Start: Parking Oost", parkingOost);

    // 2. Simulate Hypothetical POIs
    // POI 1: Very close (e.g. 50m away)
    const poi1 = { id: 'poi1', name: "POI 1 (Close)", lat: 50.8803, lng: 4.6770 };
    // POI 2: Further (e.g. 300m away)
    const poi2 = { id: 'poi2', name: "POI 2 (Far)", lat: 50.8820, lng: 4.6800 };

    const candidates = [poi1, poi2];

    // 3. Mimic Sorting Logic from App.jsx
    let currentPos = { lat: parkingOost.lat, lng: parkingOost.lng };

    console.log(`\n--- Step 1: Sorting from Start ---`);
    console.log(`Current Pos:`, currentPos);

    const potentialNext = candidates.map(c => ({
        ...c,
        distFromCurr: calcDistance(
            currentPos.lat, currentPos.lng,
            c.lat, c.lng
        )
    })).sort((a, b) => a.distFromCurr - b.distFromCurr);

    potentialNext.forEach((p, idx) => {
        console.log(`#${idx + 1}: ${p.name} Dist: ${(p.distFromCurr * 1000).toFixed(1)}m`);
    });

    // 4. Simulate if currentPos was WRONG (e.g. City Center)
    // Leuven Center ~ 50.8798, 4.7005
    const cityCenter = { lat: 50.8798, lng: 4.7005 };
    console.log(`\n--- Step 1 (BAD): Sorting from City Center ---`);
    console.log(`Current Pos:`, cityCenter);

    const potentialNextBad = candidates.map(c => ({
        ...c,
        distFromCurr: calcDistance(
            cityCenter.lat, cityCenter.lng,
            c.lat, c.lng
        )
    })).sort((a, b) => a.distFromCurr - b.distFromCurr);

    potentialNextBad.forEach((p, idx) => {
        console.log(`#${idx + 1}: ${p.name} Dist: ${(p.distFromCurr * 1000).toFixed(1)}m`);
    });
};

run();

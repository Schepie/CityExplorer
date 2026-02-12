/**
 * Polyline6 Decoder
 * Decodes OSRM polyline6 strings into [lat, lng] arrays. 
 * Polyline6 uses a precision of 1e6 (6 decimal places).
 */
export function decodePolyline6(str) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    const precision = 1e6;

    while (index < str.length) {
        let byte;
        let shift = 0;
        let result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        coordinates.push([lat / precision, lng / precision]);
    }

    return coordinates;
}

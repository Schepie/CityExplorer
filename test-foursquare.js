
const FOURSQUARE_KEY = 'Y12TQFPVLB3FBEO1YOF4JOX4PKSUGFJTYITEARFEEPDIUMOD';

const query = 'Water & strand';
const ll = '50.9303735,5.3378043';

// New hostname and path
const url = `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(query)}&ll=${ll}`;

console.log(`Testing Foursquare URL: ${url}`);
console.log(`Using Service Key: ${FOURSQUARE_KEY.substring(0, 10)}...`);

try {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${FOURSQUARE_KEY}`,
            'Accept': 'application/json',
            'X-Places-Api-Version': '2025-06-17'
        }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`Full Response: ${JSON.stringify(data, null, 2)}`);
} catch (e) {
    console.error(`Fetch Error: ${e.message}`);
}
process.exit(0);

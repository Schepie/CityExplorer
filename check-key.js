
const FOURSQUARE_KEY = 'fsq33OIc1MM5Vv8JuaLYoLMUg5Vn0J4ojRsHjoosUKZM3C4=';

console.log(`Key length: ${FOURSQUARE_KEY.length}`);
let hex = '';
for (let i = 0; i < FOURSQUARE_KEY.length; i++) {
    hex += FOURSQUARE_KEY.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
}
console.log(`Hex: ${hex}`);
process.exit(0);

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testConnection() {
    console.log("--- Supabase Diagnostic ---");
    console.log("URL:", supabaseUrl);
    console.log("Key Length:", supabaseKey ? supabaseKey.length : 0);

    if (!supabaseUrl || !supabaseKey) {
        console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log("Testing connection to 'poi_cache' table...");
        const { data, error } = await supabase
            .from('poi_cache')
            .select('*')
            .limit(1);

        if (error) {
            console.error("FAILED to connect to 'poi_cache' table.");
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);

            if (error.code === '42P01') {
                console.log("\nTIP: The table 'poi_cache' does not exist. Did you run the SQL in docs/SUPABASE_SETUP.md?");
            } else if (error.code === '401' || error.message.includes('JWT')) {
                console.log("\nTIP: Your API key seems invalid. Ensure you are using the 'service_role' key, not the 'anon' or a different key.");
            }
        } else {
            console.log("SUCCESS! Connection established and table 'poi_cache' verified.");
            console.log("Sample Data:", data);
        }
    } catch (err) {
        console.error("Diagnostic script crashed:", err);
    }
}

testConnection();

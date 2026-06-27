// One-off script to update all faculty honorarium rates to 2000
// Run: node update_faculty_rates.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await supabase
        .from('faculty')
        .update({ honorarium_rate_per_hour: 2000 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

    if (error) {
        console.error('Error updating rates:', error);
        process.exit(1);
    }
    console.log('✓ All faculty honorarium rates updated to ₹2,000/hr');
}

run();

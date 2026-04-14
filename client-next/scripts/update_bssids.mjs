import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({path: '.env.local'});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fakeBssids = [
    'A1:B2:C3:D4:E5:01',
    'A1:B2:C3:D4:E5:02',
    'A1:B2:C3:D4:E5:03',
    'A1:B2:C3:D4:E5:04',
    'A1:B2:C3:D4:E5:05'
];

async function run() {
    const { data: venues, error } = await supabase.from('venues').select('*').is('router_bssid', null);
    if (error) { console.error(error); return; }
    
    console.log(`Found ${venues.length} venues with missing BSSID.`);
    
    for (let i = 0; i < venues.length; i++) {
        const v = venues[i];
        const { error: updateErr } = await supabase.from('venues').update({ router_bssid: fakeBssids[i % fakeBssids.length] }).eq('id', v.id);
        if (updateErr) console.error(`Error updating venue ${v.name}:`, updateErr.message);
        else console.log(`Updated venue ${v.name} -> ${fakeBssids[i % fakeBssids.length]}`);
    }
}
run();

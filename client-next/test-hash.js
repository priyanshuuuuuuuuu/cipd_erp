require('dotenv').config({ path: 'c:/Users/parsh/OneDrive/Desktop/BTP/cipd_erp/client-next/.env' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

(async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data: users, error } = await supabase.from('users').select('id, email, password_hash, first_name');
    if (error) { console.log('Error fetching users:', error); return; }
    // hello
    for (let u of users) {
        if (u.first_name && u.first_name.toLowerCase().includes('mayank')) {
            console.log('Found Mayank:', u.email);
            const testPws = ['1234567', '12345678', '2345678', '23456789', 'password'];
            for (let pw of testPws) {
                const match = await bcrypt.compare(pw, u.password_hash);
                if (match) {
                    console.log('>>> MATCH FOUND! The real password is: ' + pw);
                }
            }
        }
    }
})();

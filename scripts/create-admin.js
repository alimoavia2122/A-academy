// Creates the first portal user.  Usage:
//   npm run create-admin -- "owner@example.com" "StrongPassword123" "Owner Name" [admin|accountant]
require('dotenv').config();
const { supabase } = require('../src/config/supabase');

(async () => {
  const [email, password, fullName, role = 'admin'] = process.argv.slice(2);
  if (!email || !password || !fullName || !['admin', 'accountant'].includes(role)) {
    console.log('Usage: npm run create-admin -- "email" "password" "Full Name" [admin|accountant]');
    process.exit(1);
  }
  if (password.length < 8) { console.log('Password must be at least 8 characters.'); process.exit(1); }

  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error('Could not create user:', error.message); process.exit(1); }

  const { error: pErr } = await supabase.from('profiles').insert({ id: data.user.id, full_name: fullName, role });
  if (pErr) { console.error('User created but profile failed:', pErr.message); process.exit(1); }
  console.log(`Created ${role} "${fullName}" (${email}). You can log in now.`);
})();

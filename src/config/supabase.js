// Creates the Supabase clients. The SERVICE key stays on the server only.
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };

// Full-access client (bypasses Row Level Security). Used for all data queries.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, options);

// Fresh anon client per login, so one user's session never leaks into another's.
const createAnonClient = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);

module.exports = { supabase, createAnonClient };

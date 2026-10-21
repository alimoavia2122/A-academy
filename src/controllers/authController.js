const { supabase, createAnonClient } = require('../config/supabase');
const { wrap, AppError } = require('../utils/helpers');

async function loadProfile(userId) {
  const { data } = await supabase.from('profiles').select('full_name, role, active').eq('id', userId).maybeSingle();
  return data;
}

// POST /api/auth/login  { email, password }
exports.login = wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw new AppError('Email and password are required');

  const { data, error } = await createAnonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new AppError('Wrong email or password', 401);

  const profile = await loadProfile(data.user.id);
  if (!profile || !profile.active) throw new AppError('This account has no portal access. Ask the admin.', 403);

  res.json({
    success: true,
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email, name: profile.full_name, role: profile.role },
    },
  });
});

// POST /api/auth/refresh  { refresh_token }  -> new tokens (the access token lasts about 1 hour)
exports.refresh = wrap(async (req, res) => {
  const refresh_token = String(req.body.refresh_token || '');
  if (!refresh_token) throw new AppError('Missing refresh token', 401);
  const { data, error } = await createAnonClient().auth.refreshSession({ refresh_token });
  if (error || !data.session) throw new AppError('Session expired, please log in again', 401);
  res.json({ success: true, data: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
});

// GET /api/auth/me
exports.me = wrap(async (req, res) => res.json({ success: true, data: req.user }));

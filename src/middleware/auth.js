// Checks the "Authorization: Bearer <token>" header with Supabase Auth,
// then loads the user's role from the profiles table into req.user.
const { supabase } = require('../config/supabase');

module.exports = async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'Please log in' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ success: false, error: 'Session expired, please log in again' });

    const { data: profile } = await supabase
      .from('profiles').select('full_name, role, active').eq('id', data.user.id).maybeSingle();
    if (!profile || !profile.active) {
      return res.status(403).json({ success: false, error: 'This account has no portal access' });
    }

    req.user = { id: data.user.id, email: data.user.email, name: profile.full_name, role: profile.role };
    next();
  } catch (err) {
    next(err);
  }
};

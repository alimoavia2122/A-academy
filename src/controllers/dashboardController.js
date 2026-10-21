const { supabase } = require('../config/supabase');
const { wrap, run, currentMonth, monthStart } = require('../utils/helpers');

// GET /api/dashboard  -> totals are calculated inside Postgres (see dashboard_summary in schema.sql)
exports.summary = wrap(async (req, res) => {
  const month = currentMonth();
  const s = await run(supabase.rpc('dashboard_summary', { p_month: monthStart(month) }));
  res.json({ success: true, data: { month, ...s, net: Number(s.collected) - Number(s.expenses) } });
});

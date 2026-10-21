// Small shared helpers used by the controllers.
const { supabase } = require('../config/supabase');

// An error we throw on purpose, with an HTTP status (400 = bad input, 404 = not found ...)
class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Wraps async route handlers so any thrown error reaches errorHandler
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Runs a Supabase query and returns its data, or throws its error
async function run(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const num = (v, fallback = 0) => {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const round2 = (n) => Math.round(n * 100) / 100;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(new Date(s));
const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');

// Removes characters that have special meaning inside Supabase filter strings
const cleanSearch = (q) => String(q || '').replace(/[,()%*\\"']/g, ' ').trim().slice(0, 60);

// Dates are handled as plain "YYYY-MM-DD" text, using Pakistan time for "today"
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const currentMonth = () => today().slice(0, 7);
const monthStart = (ym) => `${ym}-01`;
const monthEnd = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const getSettings = () => run(supabase.from('settings').select('*').eq('id', 1).single());

module.exports = {
  AppError, wrap, run, str, num, round2, isDate, isMonth, isUuid, cleanSearch,
  today, currentMonth, monthStart, monthEnd, addDays, getSettings,
};

// Generates registration numbers such as ARH-2026-0001 (the counter restarts every year).
const { supabase } = require('../config/supabase');

async function nextRollNumber(year) {
  const prefix = `ARH-${year}-`;
  const { data, error } = await supabase
    .from('students').select('reg_no').like('reg_no', `${prefix}%`)
    .order('reg_no', { ascending: false }).limit(1);
  if (error) throw error;
  const last = data.length ? parseInt(data[0].reg_no.slice(prefix.length), 10) : 0;
  return prefix + String(last + 1).padStart(4, '0');
}

module.exports = { nextRollNumber };

const { supabase } = require('../config/supabase');
const {
  wrap, run, isMonth, isUuid, monthStart, monthEnd, getSettings, AppError,
} = require('../utils/helpers');
const { nextChallanNumbers } = require('../utils/challanNumber');

const SELECT =
  '*, students!inner(id, reg_no, name, father_name, phone, class_id, section_id, status, classes(name), sections(name))';

// Shared filters for the list and the print view
function applyFilters(q, f) {
  if (isMonth(f.month)) q = q.eq('month', monthStart(f.month));
  if (f.class_id) q = q.eq('students.class_id', f.class_id);
  if (f.section_id) q = q.eq('students.section_id', f.section_id);
  if (['unpaid', 'partial', 'paid'].includes(f.status)) q = q.eq('status', f.status);
  return q;
}

// GET /api/challans?month=2026-10&class_id=&section_id=&status=
exports.list = wrap(async (req, res) => {
  const q = applyFilters(supabase.from('challans').select(SELECT).order('challan_no').limit(1000), req.query);
  res.json({ success: true, data: await run(q) });
});

// GET /api/challans/print-data?ids=a,b,c   OR   ?month=&class_id=&section_id=&status=
exports.printData = wrap(async (req, res) => {
  let q = supabase.from('challans').select(SELECT).order('challan_no').limit(500);
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',').filter(isUuid).slice(0, 200);
    if (!ids.length) throw new AppError('No valid challans selected');
    q = q.in('id', ids);
  } else {
    q = applyFilters(q, req.query);
  }
  const [challans, settings] = await Promise.all([run(q), getSettings()]);
  if (!challans.length) throw new AppError('No challans found to print', 404);
  res.json({ success: true, data: { settings, challans } });
});

// POST /api/challans/generate { month: "2026-10", class_id?, section_id? }
// Creates one monthly challan per active student. Students who already have a challan
// for that month are skipped (the database also enforces this with a unique constraint).
exports.generate = wrap(async (req, res) => {
  const { month, class_id, section_id } = req.body;
  if (!isMonth(month)) throw new AppError('Please choose a month');
  const settings = await getSettings();
  const mStart = monthStart(month);

  // 1. Which students?
  let sq = supabase.from('students').select('id, monthly_fee, discount')
    .eq('status', 'active').lte('admission_date', monthEnd(month)).limit(2000);
  if (class_id) sq = sq.eq('class_id', class_id);
  if (section_id) sq = sq.eq('section_id', section_id);
  const students = await run(sq);
  if (!students.length) throw new AppError('No active students found for this selection');

  // 2. Skip students who already have this month's challan
  const existing = await run(supabase.from('challans').select('student_id')
    .eq('type', 'monthly').eq('month', mStart).limit(5000));
  const have = new Set(existing.map((c) => c.student_id));
  const todo = students.filter((s) => !have.has(s.id));
  if (!todo.length) return res.json({ success: true, data: { created: 0, skipped: students.length } });

  // 3. Unpaid balances of earlier challans become "arrears" on the new challan.
  //    The old challan is marked carried_to = new challan, so it is not counted twice.
  const open = await run(supabase.from('challans')
    .select('id, student_id, month, type, balance, arrears_months')
    .is('carried_to', null).gt('balance', 0).limit(5000));
  const openBy = {};
  open.forEach((c) => {
    const earlier = c.month < mStart || (c.type === 'admission' && c.month <= mStart);
    if (earlier) (openBy[c.student_id] ||= []).push(c);
  });

  // 4. Build the challans
  const numbers = await nextChallanNumbers(month, todo.length);
  const due_date = `${month}-${String(settings.due_day).padStart(2, '0')}`;
  const rows = todo.map((s, i) => {
    const olds = openBy[s.id] || [];
    const arrears = olds.reduce((sum, c) => sum + Number(c.balance), 0);
    const arrears_months = olds.reduce((sum, c) => sum + c.arrears_months + 1, 0);
    const fee = Math.max(0, Number(s.monthly_fee) - Number(s.discount));
    return {
      challan_no: numbers[i], student_id: s.id, type: 'monthly', month: mStart,
      tuition_fee: s.monthly_fee, discount: s.discount, arrears, arrears_months,
      late_fine: settings.late_fine, total_payable: fee + arrears, due_date,
      created_by: req.user.id,
    };
  });
  const created = await run(supabase.from('challans').insert(rows).select('id, student_id'));

  // 5. Link old challans to the new ones
  for (const c of created) {
    const olds = openBy[c.student_id];
    if (olds && olds.length) {
      await run(supabase.from('challans').update({ carried_to: c.id }).in('id', olds.map((o) => o.id)));
    }
  }
  res.status(201).json({ success: true, data: { created: created.length, skipped: students.length - todo.length } });
});

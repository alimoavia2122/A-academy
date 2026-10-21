const { supabase } = require('../config/supabase');
const { wrap, run, round2, isDate, isMonth, currentMonth, monthStart, monthEnd, today } = require('../utils/helpers');

const sum = (list, fn) => round2(list.reduce((t, x) => t + Number(fn(x)), 0));

// GET /api/reports/defaulters?class_id=&section_id=
// Students whose latest open challan is past its due date. One row per student.
exports.defaulters = wrap(async (req, res) => {
  let q = supabase.from('challans')
    .select('student_id, balance, arrears_months, due_date, students!inner(reg_no, name, father_name, phone, whatsapp, status, class_id, section_id, classes(name), sections(name))')
    .is('carried_to', null).gt('balance', 0).lt('due_date', today()).limit(3000);
  if (req.query.class_id) q = q.eq('students.class_id', req.query.class_id);
  if (req.query.section_id) q = q.eq('students.section_id', req.query.section_id);
  const rows = await run(q);

  const byStudent = {};
  rows.forEach((c) => {
    const s = c.students;
    const r = (byStudent[c.student_id] ||= {
      student_id: c.student_id, reg_no: s.reg_no, name: s.name, father_name: s.father_name,
      phone: s.phone || s.whatsapp || '', status: s.status,
      class_name: s.classes?.name || '', section_name: s.sections?.name || '',
      months_overdue: 0, amount_due: 0, oldest_due_date: c.due_date,
    });
    r.amount_due = round2(r.amount_due + Number(c.balance));
    r.months_overdue = Math.max(r.months_overdue, c.arrears_months + 1);
    if (c.due_date < r.oldest_due_date) r.oldest_due_date = c.due_date;
  });
  const data = Object.values(byStudent).sort((a, b) => b.amount_due - a.amount_due);
  res.json({ success: true, data: { rows: data, total: sum(data, (r) => r.amount_due) } });
});

const PAYMENT_SELECT =
  '*, challans(challan_no, month, type), students(reg_no, name, classes(name), sections(name))';

function totalsByMethod(payments) {
  const out = {};
  payments.forEach((p) => { out[p.method] = round2((out[p.method] || 0) + Number(p.amount)); });
  return out;
}

// GET /api/reports/daily?date=2026-10-21
exports.daily = wrap(async (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const payments = await run(supabase.from('payments').select(PAYMENT_SELECT)
    .eq('paid_on', date).order('created_at').limit(2000));
  res.json({ success: true, data: { date, payments, by_method: totalsByMethod(payments), total: sum(payments, (p) => p.amount) } });
});

// GET /api/reports/monthly?month=2026-10
exports.monthly = wrap(async (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();
  const [payments, challans] = await Promise.all([
    run(supabase.from('payments').select(PAYMENT_SELECT)
      .gte('paid_on', monthStart(month)).lte('paid_on', monthEnd(month)).limit(5000)),
    run(supabase.from('challans').select('total_payable, arrears, balance, carried_to')
      .eq('month', monthStart(month)).limit(5000)),
  ]);

  const byDay = {}, byClass = {};
  payments.forEach((p) => {
    const d = (byDay[p.paid_on] ||= { date: p.paid_on, count: 0, amount: 0 });
    d.count += 1; d.amount = round2(d.amount + Number(p.amount));
    const cn = p.students?.classes?.name || 'Unknown';
    byClass[cn] = round2((byClass[cn] || 0) + Number(p.amount));
  });

  res.json({
    success: true,
    data: {
      month,
      billed: sum(challans, (c) => Number(c.total_payable) - Number(c.arrears)), // new charges only (arrears excluded)
      collected: sum(payments, (p) => p.amount),
      still_due: sum(challans.filter((c) => !c.carried_to), (c) => c.balance),
      challan_count: challans.length,
      by_day: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      by_method: totalsByMethod(payments),
      by_class: byClass,
    },
  });
});

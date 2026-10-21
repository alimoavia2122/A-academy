const { supabase } = require('../config/supabase');
const { wrap, run, str, num, round2, isDate, isMonth, currentMonth, monthStart, monthEnd, today, AppError } = require('../utils/helpers');

const CATEGORIES = ['rent', 'electricity', 'salaries', 'stationery', 'maintenance', 'other'];

function parseExpense(b) {
  const e = {
    expense_date: b.expense_date || today(),
    category: b.category,
    amount: round2(num(b.amount, NaN)),
    description: str(b.description, 250) || null,
  };
  if (!isDate(e.expense_date)) throw new AppError('Date is not valid');
  if (!CATEGORIES.includes(e.category)) throw new AppError('Choose a category');
  if (!(e.amount > 0)) throw new AppError('Enter an amount greater than 0');
  return e;
}

// GET /api/expenses?month=2026-10&category=  -> list + totals per category
exports.list = wrap(async (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : currentMonth();
  let q = supabase.from('expenses').select('*')
    .gte('expense_date', monthStart(month)).lte('expense_date', monthEnd(month))
    .order('expense_date', { ascending: false }).order('created_at', { ascending: false });
  if (CATEGORIES.includes(req.query.category)) q = q.eq('category', req.query.category);
  const items = await run(q);

  const totals = {};
  let total = 0;
  items.forEach((e) => { totals[e.category] = round2((totals[e.category] || 0) + Number(e.amount)); total = round2(total + Number(e.amount)); });
  res.json({ success: true, data: { month, items, totals, total } });
});

exports.create = wrap(async (req, res) => {
  const data = await run(supabase.from('expenses').insert({ ...parseExpense(req.body), created_by: req.user.id }).select().single());
  res.status(201).json({ success: true, data });
});

exports.update = wrap(async (req, res) => {
  const data = await run(supabase.from('expenses').update(parseExpense(req.body)).eq('id', req.params.id).select().single());
  res.json({ success: true, data });
});

exports.remove = wrap(async (req, res) => {
  await run(supabase.from('expenses').delete().eq('id', req.params.id));
  res.json({ success: true, data: null });
});

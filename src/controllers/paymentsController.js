const { supabase } = require('../config/supabase');
const {
  wrap, run, str, num, round2, isDate, isUuid, cleanSearch, today, getSettings, AppError,
} = require('../utils/helpers');
const { nextReceiptNumbers } = require('../utils/challanNumber');

const METHODS = ['cash', 'bank', 'jazzcash', 'easypaisa'];

// GET /api/payments/search?q=&open=1  -> challans matching challan no, roll no, or student name
exports.search = wrap(async (req, res) => {
  const q = cleanSearch(req.query.q);
  if (q.length < 2) throw new AppError('Type at least 2 letters to search');

  const studs = await run(supabase.from('students').select('id')
    .or(`name.ilike.%${q}%,reg_no.ilike.%${q}%,father_name.ilike.%${q}%`).limit(50));
  let filter = `challan_no.ilike.%${q}%`;
  if (studs.length) filter += `,student_id.in.(${studs.map((s) => s.id).join(',')})`;

  let query = supabase.from('challans')
    .select('*, students(reg_no, name, father_name, status, classes(name), sections(name))')
    .or(filter).order('month', { ascending: false }).order('challan_no').limit(40);
  if (req.query.open === '1') query = query.gt('balance', 0).is('carried_to', null);
  res.json({ success: true, data: await run(query) });
});

// GET /api/payments/by-challan/:id
exports.byChallan = wrap(async (req, res) => {
  const data = await run(supabase.from('payments').select('*').eq('challan_id', req.params.id).order('created_at'));
  res.json({ success: true, data });
});

// GET /api/payments/:id -> everything the printable receipt needs
exports.get = wrap(async (req, res) => {
  const [payment, settings] = await Promise.all([
    run(supabase.from('payments')
      .select('*, challans(challan_no, month, type, total_payable, paid_amount, balance), students(reg_no, name, father_name, classes(name), sections(name))')
      .eq('id', req.params.id).single()),
    getSettings(),
  ]);
  res.json({ success: true, data: { payment, settings } });
});

// POST /api/payments { challan_id, amount, paid_on, method, received_by, notes }
exports.record = wrap(async (req, res) => {
  const b = req.body;
  const amount = round2(num(b.amount, NaN));
  const paid_on = b.paid_on || today();
  const method = b.method;
  const received_by = str(b.received_by || req.user.name, 80);

  if (!isUuid(b.challan_id)) throw new AppError('Challan is missing');
  if (!(amount > 0)) throw new AppError('Enter an amount greater than 0');
  if (!METHODS.includes(method)) throw new AppError('Choose a payment method');
  if (!isDate(paid_on) || paid_on > today()) throw new AppError('Payment date cannot be in the future');
  if (!received_by) throw new AppError('Received by is required');

  const c = await run(supabase.from('challans').select('*').eq('id', b.challan_id).single());
  if (c.carried_to) throw new AppError('This challan was carried forward into a newer challan. Collect the fee on the newer challan.');

  // Late fine is added once, if the payment is made after the due date
  let total = Number(c.total_payable);
  let fine_applied = c.fine_applied;
  if (!fine_applied && Number(c.late_fine) > 0 && paid_on > c.due_date) {
    total = round2(total + Number(c.late_fine));
    fine_applied = true;
  }
  const balance = round2(total - Number(c.paid_amount));
  if (balance <= 0) throw new AppError('This challan is already fully paid');
  if (amount > balance) throw new AppError(`Amount is more than the balance due (Rs. ${balance})`);

  const [receipt_no] = await nextReceiptNumbers(paid_on.slice(0, 7), 1);
  const payment = await run(supabase.from('payments').insert({
    receipt_no, challan_id: c.id, student_id: c.student_id, amount, paid_on, method,
    received_by, notes: str(b.notes, 200) || null, created_by: req.user.id,
  }).select().single());

  const paid_amount = round2(Number(c.paid_amount) + amount);
  const status = paid_amount >= total ? 'paid' : 'partial';
  // Only updates if nobody else changed paid_amount in the meantime
  const updated = await run(supabase.from('challans')
    .update({ paid_amount, total_payable: total, fine_applied, status })
    .eq('id', c.id).eq('paid_amount', c.paid_amount).select('id'));
  if (!updated.length) {
    await supabase.from('payments').delete().eq('id', payment.id);
    throw new AppError('This challan was just changed by someone else. Please search again and retry.', 409);
  }
  res.status(201).json({ success: true, data: { payment, status, balance: round2(total - paid_amount) } });
});

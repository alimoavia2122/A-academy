const { supabase } = require('../config/supabase');
const { wrap, run, str, num, AppError } = require('../utils/helpers');

function parseClass(b) {
  const name = str(b.name, 50);
  const monthly_fee = num(b.monthly_fee, NaN);
  if (!name) throw new AppError('Class name is required');
  if (!(monthly_fee >= 0)) throw new AppError('Monthly fee must be 0 or more');
  return { name, monthly_fee, sort_order: Math.trunc(num(b.sort_order, 0)) };
}

// GET /api/classes -> classes with their sections
exports.list = wrap(async (req, res) => {
  const data = await run(supabase.from('classes').select('*, sections(id, name)').order('sort_order').order('name'));
  data.forEach((c) => c.sections.sort((a, b) => a.name.localeCompare(b.name)));
  res.json({ success: true, data });
});

exports.create = wrap(async (req, res) => {
  const data = await run(supabase.from('classes').insert(parseClass(req.body)).select().single());
  res.status(201).json({ success: true, data });
});

// Changing a class fee only affects NEW admissions; students keep their own monthly_fee.
exports.update = wrap(async (req, res) => {
  const data = await run(supabase.from('classes').update(parseClass(req.body)).eq('id', req.params.id).select().single());
  res.json({ success: true, data });
});

exports.remove = wrap(async (req, res) => {
  await run(supabase.from('classes').delete().eq('id', req.params.id));
  res.json({ success: true, data: null });
});

exports.addSection = wrap(async (req, res) => {
  const name = str(req.body.name, 20);
  if (!name) throw new AppError('Section name is required');
  const data = await run(supabase.from('sections').insert({ class_id: req.params.classId, name }).select().single());
  res.status(201).json({ success: true, data });
});

exports.removeSection = wrap(async (req, res) => {
  await run(supabase.from('sections').delete().eq('id', req.params.id));
  res.json({ success: true, data: null });
});

const { supabase } = require('../config/supabase');
const { wrap, run, str, num, getSettings, AppError } = require('../utils/helpers');

exports.get = wrap(async (req, res) => res.json({ success: true, data: await getSettings() }));

exports.update = wrap(async (req, res) => {
  const b = req.body;
  const row = {
    academy_name: str(b.academy_name, 100),
    address: str(b.address, 200),
    phone: str(b.phone, 40),
    late_fine: num(b.late_fine, NaN),
    due_day: Math.trunc(num(b.due_day, NaN)),
    admission_fee_default: num(b.admission_fee_default, NaN),
  };
  if (!row.academy_name) throw new AppError('Academy name is required');
  if (!(row.late_fine >= 0)) throw new AppError('Late fine must be 0 or more');
  if (!(row.due_day >= 1 && row.due_day <= 28)) throw new AppError('Due day must be between 1 and 28');
  if (!(row.admission_fee_default >= 0)) throw new AppError('Admission fee must be 0 or more');
  const data = await run(supabase.from('settings').update(row).eq('id', 1).select().single());
  res.json({ success: true, data });
});

const { supabase } = require('../config/supabase');
const { wrap, run, str, num, isDate, cleanSearch, today, addDays, AppError } = require('../utils/helpers');
const { nextRollNumber } = require('../utils/rollNumber');
const { nextChallanNumbers } = require('../utils/challanNumber');

const SELECT = '*, classes(name), sections(name)';

// Validates the form data and returns a clean object (only allowed columns).
function parseStudent(b) {
  const s = {
    name: str(b.name, 100),
    father_name: str(b.father_name, 100),
    father_cnic: str(b.father_cnic, 15) || null,
    phone: str(b.phone, 20) || null,
    whatsapp: str(b.whatsapp, 20) || null,
    address: str(b.address, 250) || null,
    class_id: b.class_id || null,
    section_id: b.section_id || null,
    admission_date: b.admission_date || today(),
    monthly_fee: num(b.monthly_fee, NaN),
    discount: num(b.discount, 0),
  };
  const errors = [];
  if (s.name.length < 2) errors.push('Student name is required');
  if (s.father_name.length < 2) errors.push('Father name is required');
  if (s.father_cnic && !/^\d{5}-?\d{7}-?\d$/.test(s.father_cnic)) errors.push('Father CNIC should look like 33100-1234567-1');
  const phoneOk = (p) => !p || /^[0-9+\-\s]{7,15}$/.test(p);
  if (!phoneOk(s.phone)) errors.push('Phone number is not valid');
  if (!phoneOk(s.whatsapp)) errors.push('WhatsApp number is not valid');
  if (!s.class_id) errors.push('Class is required');
  if (!isDate(s.admission_date)) errors.push('Admission date is not valid');
  if (!(s.monthly_fee >= 0)) errors.push('Monthly fee must be 0 or more');
  if (s.discount < 0 || s.discount > s.monthly_fee) errors.push('Discount cannot be more than the monthly fee');
  if (errors.length) throw new AppError(errors.join('. '));
  return s;
}

// A section must belong to the chosen class
async function checkSection(s) {
  if (!s.section_id) return;
  const sec = await run(supabase.from('sections').select('class_id').eq('id', s.section_id).maybeSingle());
  if (!sec || sec.class_id !== s.class_id) throw new AppError('The selected section does not belong to the selected class');
}

// GET /api/students?q=&class_id=&section_id=&status=
exports.list = wrap(async (req, res) => {
  const { class_id, section_id, status } = req.query;
  let q = supabase.from('students').select(SELECT).order('reg_no').limit(1000);
  if (class_id) q = q.eq('class_id', class_id);
  if (section_id) q = q.eq('section_id', section_id);
  if (['active', 'left'].includes(status)) q = q.eq('status', status);
  const s = cleanSearch(req.query.q);
  if (s) q = q.or(`name.ilike.%${s}%,father_name.ilike.%${s}%,reg_no.ilike.%${s}%,phone.ilike.%${s}%`);
  res.json({ success: true, data: await run(q) });
});

exports.get = wrap(async (req, res) => {
  res.json({ success: true, data: await run(supabase.from('students').select(SELECT).eq('id', req.params.id).single()) });
});

// POST /api/students -> creates the student, a reg number, and (if admission fee > 0) an admission challan
exports.create = wrap(async (req, res) => {
  const s = parseStudent(req.body);
  await checkSection(s);
  const admission_fee = num(req.body.admission_fee, 0);
  if (admission_fee < 0) throw new AppError('Admission fee must be 0 or more');

  let student = null;
  for (let attempt = 0; attempt < 3 && !student; attempt++) {
    const reg_no = await nextRollNumber(s.admission_date.slice(0, 4));
    const { data, error } = await supabase.from('students')
      .insert({ ...s, reg_no, admission_fee, status: 'active' }).select(SELECT).single();
    if (!error) student = data;
    else if (error.code !== '23505') throw error; // duplicate reg_no -> try again
  }
  if (!student) throw new AppError('Could not create a registration number. Please try again.', 500);

  let challan = null;
  if (admission_fee > 0) {
    const ym = s.admission_date.slice(0, 7);
    const [challan_no] = await nextChallanNumbers(ym, 1);
    challan = await run(supabase.from('challans').insert({
      challan_no, student_id: student.id, type: 'admission', month: `${ym}-01`,
      admission_fee, total_payable: admission_fee, due_date: addDays(s.admission_date, 7),
      created_by: req.user.id,
    }).select().single());
  }
  res.status(201).json({ success: true, data: { student, challan } });
});

exports.update = wrap(async (req, res) => {
  const s = parseStudent(req.body);
  await checkSection(s);
  const data = await run(supabase.from('students').update(s).eq('id', req.params.id).select(SELECT).single());
  res.json({ success: true, data });
});

// PATCH /api/students/:id/status { status: 'active' | 'left' }  (soft delete: data is kept)
exports.setStatus = wrap(async (req, res) => {
  const status = req.body.status;
  if (!['active', 'left'].includes(status)) throw new AppError('Status must be active or left');
  const data = await run(supabase.from('students')
    .update({ status, left_date: status === 'left' ? today() : null })
    .eq('id', req.params.id).select(SELECT).single());
  res.json({ success: true, data });
});

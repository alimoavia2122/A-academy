(() => {
  const user = requireAuth('students');
  if (!user) return;
  const isAdmin = user.role === 'admin';
  let classes = [], settings = {}, students = [], editingId = null;

  const FIELDS = ['name', 'father_name', 'father_cnic', 'phone', 'whatsapp', 'address', 'admission_date', 'class_id', 'section_id', 'monthly_fee', 'discount'];

  async function init() {
    if (!isAdmin) $('btn-add').style.display = 'none';
    try {
      [classes, settings] = await Promise.all([api('/classes'), api('/settings')]);
    } catch (e) { toast(e.message, 'error'); }
    fillSelect($('f-class'), classes, 'All classes', (c) => c.id, (c) => c.name);
    fillSections($('f-section'), classes, '');
    fillSelect($('class_id'), classes, 'Select class', (c) => c.id, (c) => c.name);
    loadStudents();
  }

  async function loadStudents() {
    $('rows').innerHTML = loadingRow(7);
    try {
      students = await api('/students?' + qs({ q: $('f-q').value.trim(), class_id: $('f-class').value, section_id: $('f-section').value, status: $('f-status').value }));
      render();
    } catch (e) { $('rows').innerHTML = emptyRow(7, e.message); }
  }

  function render() {
    $('count').textContent = `${students.length} student${students.length === 1 ? '' : 's'}`;
    if (!students.length) { $('rows').innerHTML = emptyRow(7, 'No students found. Try changing the filters.'); return; }
    $('rows').innerHTML = students.map((s) => `<tr>
      <td><b>${esc(s.reg_no)}</b></td>
      <td>${esc(s.name)}<div class="muted small">s/o ${esc(s.father_name)}</div></td>
      <td>${esc(s.classes?.name)}${s.sections ? ' – ' + esc(s.sections.name) : ''}</td>
      <td>${esc(s.phone || s.whatsapp || '')}</td>
      <td class="num">${fmtRs(Number(s.monthly_fee) - Number(s.discount))}${Number(s.discount) ? `<div class="muted small">after Rs. ${Number(s.discount).toLocaleString('en-US')} discount</div>` : ''}</td>
      <td>${statusBadge(s.status)}</td>
      <td class="num">${isAdmin ? `<button class="btn btn-light btn-sm" data-act="edit" data-id="${s.id}">Edit</button>
        <button class="btn btn-light btn-sm" data-act="status" data-id="${s.id}">${s.status === 'active' ? 'Mark left' : 'Re-activate'}</button>` : ''}</td>
    </tr>`).join('');
  }

  // ----- filters -----
  $('f-q').addEventListener('input', debounce(loadStudents));
  $('f-class').addEventListener('change', () => { fillSections($('f-section'), classes, $('f-class').value); loadStudents(); });
  $('f-section').addEventListener('change', loadStudents);
  $('f-status').addEventListener('change', loadStudents);

  // ----- modal -----
  function openForm(s) {
    editingId = s ? s.id : null;
    $('m-title').textContent = s ? 'Edit student' : 'Add student';
    showFormError($('form-error'), '');
    FIELDS.forEach((f) => { $(f).value = s ? (s[f] ?? '') : ''; });
    if (!s) { $('admission_date').value = todayStr(); $('discount').value = 0; $('admission_fee').value = settings.admission_fee_default || 0; }
    fillSections($('section_id'), classes, $('class_id').value, 'No section');
    $('section_id').value = s?.section_id || '';
    $('admfee-box').style.display = s ? 'none' : '';
    openModal('m-student');
    $('name').focus();
  }
  $('btn-add').addEventListener('click', () => openForm(null));
  document.querySelectorAll('#m-student [data-close]').forEach((b) => b.addEventListener('click', () => closeModal('m-student')));

  // Picking a class fills its sections and its default monthly fee
  $('class_id').addEventListener('change', () => {
    fillSections($('section_id'), classes, $('class_id').value, 'No section');
    const c = classes.find((x) => x.id === $('class_id').value);
    if (c && !editingId) $('monthly_fee').value = c.monthly_fee;
  });

  function validate(b) {
    const errs = [];
    if (b.name.length < 2) errs.push('Student name is required');
    if (b.father_name.length < 2) errs.push('Father name is required');
    if (b.father_cnic && !/^\d{5}-?\d{7}-?\d$/.test(b.father_cnic)) errs.push('Father CNIC should look like 33100-1234567-1');
    if (b.phone && !/^[0-9+\-\s]{7,15}$/.test(b.phone)) errs.push('Phone number is not valid');
    if (b.whatsapp && !/^[0-9+\-\s]{7,15}$/.test(b.whatsapp)) errs.push('WhatsApp number is not valid');
    if (!b.class_id) errs.push('Please choose a class');
    if (!b.admission_date) errs.push('Admission date is required');
    if (b.monthly_fee === '' || Number(b.monthly_fee) < 0) errs.push('Monthly fee is required');
    if (Number(b.discount) < 0 || Number(b.discount) > Number(b.monthly_fee)) errs.push('Discount cannot be more than the monthly fee');
    return errs;
  }

  $('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    FIELDS.forEach((f) => { body[f] = $(f).value.trim(); });
    body.discount = body.discount || 0;
    if (!editingId) body.admission_fee = $('admission_fee').value || 0;
    const errs = validate(body);
    if (errs.length) return showFormError($('form-error'), errs.join('. '));

    const btn = $('save-btn');
    setBusy(btn, true, 'Saving…');
    try {
      if (editingId) {
        await api('/students/' + editingId, { method: 'PUT', body });
        toast('Student updated');
      } else {
        const r = await api('/students', { method: 'POST', body });
        toast(`Student added: ${r.student.reg_no}`);
        closeModal('m-student');
        if (r.challan && (await confirmBox(`Admission challan ${r.challan.challan_no} is ready. Print it now?`, 'Print challan', false, 'Not now'))) {
          window.open('/print/challan.html?ids=' + r.challan.id, '_blank');
        }
      }
      closeModal('m-student');
      loadStudents();
    } catch (ex) { showFormError($('form-error'), ex.message); }
    finally { setBusy(btn, false); }
  });

  // ----- row actions -----
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = students.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'edit') return openForm(s);
    const leaving = s.status === 'active';
    const ok = await confirmBox(leaving
      ? `Mark ${s.name} as left? No new challans will be made. Old records are kept.`
      : `Re-activate ${s.name}?`, leaving ? 'Mark left' : 'Re-activate', leaving);
    if (!ok) return;
    try {
      await api(`/students/${s.id}/status`, { method: 'PATCH', body: { status: leaving ? 'left' : 'active' } });
      toast(leaving ? 'Student marked as left' : 'Student re-activated');
      loadStudents();
    } catch (ex) { toast(ex.message, 'error'); }
  });

  init();
})();

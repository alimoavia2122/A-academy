(() => {
  if (!requireAuth('classes', ['admin'])) return;
  let classes = [], editingId = null, sectionClassId = null;

  async function load() {
    $('rows').innerHTML = loadingRow(4);
    try { classes = await api('/classes'); render(); }
    catch (e) { $('rows').innerHTML = emptyRow(4, e.message); }
  }

  function render() {
    if (!classes.length) { $('rows').innerHTML = emptyRow(4, 'No classes yet. Click "Add class" to start.'); return; }
    $('rows').innerHTML = classes.map((c) => `<tr>
      <td><b>${esc(c.name)}</b></td>
      <td class="num">${fmtRs(c.monthly_fee)}</td>
      <td>${c.sections.map((s) => `<span class="badge badge-gray" style="margin-right:.3rem">${esc(s.name)}
          <button data-act="del-section" data-id="${s.id}" data-name="${esc(s.name)}" aria-label="Delete section ${esc(s.name)}" style="border:0;background:none;cursor:pointer;color:var(--red);font-weight:700">×</button></span>`).join('')}
        <button class="btn btn-light btn-sm" data-act="add-section" data-id="${c.id}">+ Section</button></td>
      <td class="num"><button class="btn btn-light btn-sm" data-act="edit" data-id="${c.id}">Edit</button>
        <button class="btn btn-light btn-sm" data-act="del" data-id="${c.id}">Delete</button></td></tr>`).join('');
  }

  // ----- class modal -----
  function openClass(c) {
    editingId = c ? c.id : null;
    $('m-title').textContent = c ? 'Edit class' : 'Add class';
    $('c-name').value = c?.name || ''; $('c-fee').value = c?.monthly_fee ?? ''; $('c-order').value = c?.sort_order ?? classes.length + 1;
    showFormError($('form-error'), '');
    openModal('m-class'); $('c-name').focus();
  }
  $('btn-add').addEventListener('click', () => openClass(null));
  document.querySelectorAll('.modal [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('.modal-back').classList.remove('open')));

  $('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('c-name').value.trim(), monthly_fee: $('c-fee').value, sort_order: $('c-order').value };
    if (!body.name) return showFormError($('form-error'), 'Class name is required');
    if (body.monthly_fee === '' || Number(body.monthly_fee) < 0) return showFormError($('form-error'), 'Enter the monthly fee (0 or more)');
    const btn = $('save-btn'); setBusy(btn, true, 'Saving…');
    try {
      await api(editingId ? '/classes/' + editingId : '/classes', { method: editingId ? 'PUT' : 'POST', body });
      toast('Class saved'); closeModal('m-class'); load();
    } catch (ex) { showFormError($('form-error'), ex.message); }
    finally { setBusy(btn, false); }
  });

  // ----- section modal -----
  $('section-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('s-name').value.trim();
    if (!name) return showFormError($('sec-error'), 'Section name is required');
    const btn = $('sec-btn'); setBusy(btn, true, 'Adding…');
    try {
      await api(`/classes/${sectionClassId}/sections`, { method: 'POST', body: { name } });
      toast('Section added'); closeModal('m-section'); load();
    } catch (ex) { showFormError($('sec-error'), ex.message); }
    finally { setBusy(btn, false); }
  });

  // ----- row actions -----
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    try {
      if (b.dataset.act === 'edit') return openClass(classes.find((c) => c.id === id));
      if (b.dataset.act === 'add-section') {
        sectionClassId = id; $('s-name').value = ''; showFormError($('sec-error'), '');
        $('s-title').textContent = 'Add section to ' + classes.find((c) => c.id === id).name;
        openModal('m-section'); return $('s-name').focus();
      }
      if (b.dataset.act === 'del-section') {
        if (!(await confirmBox(`Delete section ${b.dataset.name}?`, 'Delete', true))) return;
        await api('/classes/sections/' + id, { method: 'DELETE' }); toast('Section deleted'); return load();
      }
      if (b.dataset.act === 'del') {
        const c = classes.find((x) => x.id === id);
        if (!(await confirmBox(`Delete ${c.name}? This only works if the class has no students.`, 'Delete', true))) return;
        await api('/classes/' + id, { method: 'DELETE' }); toast('Class deleted'); load();
      }
    } catch (ex) { toast(ex.message, 'error'); }
  });

  // ----- settings -----
  const SET_FIELDS = ['academy_name', 'address', 'phone', 'due_day', 'late_fine', 'admission_fee_default'];
  api('/settings').then((s) => SET_FIELDS.forEach((f) => { $(f).value = s[f] ?? ''; })).catch((e) => toast(e.message, 'error'));

  $('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    SET_FIELDS.forEach((f) => { body[f] = $(f).value.trim(); });
    if (!body.academy_name) return showFormError($('set-error'), 'Academy name is required');
    if (!(body.due_day >= 1 && body.due_day <= 28)) return showFormError($('set-error'), 'Due day must be between 1 and 28');
    showFormError($('set-error'), '');
    const btn = $('set-btn'); setBusy(btn, true, 'Saving…');
    try { await api('/settings', { method: 'PUT', body }); toast('Settings saved'); }
    catch (ex) { showFormError($('set-error'), ex.message); }
    finally { setBusy(btn, false); }
  });

  load();
})();

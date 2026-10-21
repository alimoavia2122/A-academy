(() => {
  if (!requireAuth('expenses')) return;
  const CATS = ['rent', 'electricity', 'salaries', 'stationery', 'maintenance', 'other'];
  let items = [], editingId = null;

  fillSelect($('f-category'), CATS, 'All categories', (c) => c, cap);
  fillSelect($('category'), CATS, 'Select category', (c) => c, cap);
  $('f-month').value = curMonthStr();

  async function load() {
    $('rows').innerHTML = loadingRow(5);
    try {
      const d = await api('/expenses?' + qs({ month: $('f-month').value, category: $('f-category').value }));
      items = d.items;
      $('totals').innerHTML = `<div class="stat"><div class="k">Total, ${fmtMonth(d.month)}</div><div class="v">${fmtRs(d.total)}</div></div>` +
        CATS.filter((c) => d.totals[c]).map((c) => `<div class="stat"><div class="k">${cap(c)}</div><div class="v" style="font-size:1.25rem">${fmtRs(d.totals[c])}</div></div>`).join('');
      $('rows').innerHTML = items.length ? items.map((e) => `<tr>
        <td>${fmtDate(e.expense_date)}</td><td>${cap(e.category)}</td><td>${esc(e.description || '')}</td>
        <td class="num">${fmtRs(e.amount)}</td>
        <td class="num"><button class="btn btn-light btn-sm" data-act="edit" data-id="${e.id}">Edit</button>
          <button class="btn btn-light btn-sm" data-act="del" data-id="${e.id}">Delete</button></td></tr>`).join('')
        : emptyRow(5, 'No expenses for this month. Click "Add expense" to record one.');
    } catch (e) { $('rows').innerHTML = emptyRow(5, e.message); }
  }
  $('f-month').addEventListener('change', load);
  $('f-category').addEventListener('change', load);

  function openForm(e) {
    editingId = e ? e.id : null;
    $('m-title').textContent = e ? 'Edit expense' : 'Add expense';
    $('expense_date').value = e ? e.expense_date : todayStr();
    $('category').value = e ? e.category : '';
    $('amount').value = e ? e.amount : '';
    $('description').value = e?.description || '';
    showFormError($('form-error'), '');
    openModal('m-exp'); $('amount').focus();
  }
  $('btn-add').addEventListener('click', () => openForm(null));
  document.querySelectorAll('#m-exp [data-close]').forEach((b) => b.addEventListener('click', () => closeModal('m-exp')));

  $('exp-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = { expense_date: $('expense_date').value, category: $('category').value, amount: $('amount').value, description: $('description').value.trim() };
    const errs = [];
    if (!body.expense_date) errs.push('Date is required');
    if (!body.category) errs.push('Choose a category');
    if (!(Number(body.amount) > 0)) errs.push('Enter an amount greater than 0');
    if (errs.length) return showFormError($('form-error'), errs.join('. '));
    const btn = $('save-btn'); setBusy(btn, true, 'Saving…');
    try {
      await api(editingId ? '/expenses/' + editingId : '/expenses', { method: editingId ? 'PUT' : 'POST', body });
      toast('Expense saved'); closeModal('m-exp'); load();
    } catch (ex) { showFormError($('form-error'), ex.message); }
    finally { setBusy(btn, false); }
  });

  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const item = items.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'edit') return openForm(item);
    if (!(await confirmBox(`Delete this ${fmtRs(item.amount)} ${item.category} expense?`, 'Delete', true))) return;
    try { await api('/expenses/' + item.id, { method: 'DELETE' }); toast('Expense deleted'); load(); }
    catch (ex) { toast(ex.message, 'error'); }
  });

  load();
})();

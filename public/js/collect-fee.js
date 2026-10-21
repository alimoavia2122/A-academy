(() => {
  const user = requireAuth('collect-fee');
  if (!user) return;
  let results = [], current = null;

  async function search() {
    const q = $('q').value.trim();
    if (q.length < 2) { $('rows').innerHTML = emptyRow(9, 'Type at least 2 letters to search.'); return; }
    $('rows').innerHTML = loadingRow(9);
    try {
      results = await api('/payments/search?' + qs({ q, open: $('open-only').checked ? '1' : '' }));
      $('rows').innerHTML = results.length ? results.map((c) => {
        const canPay = !c.carried_to && Number(c.balance) > 0;
        return `<tr>
          <td><b>${esc(c.challan_no)}</b>${c.type === 'admission' ? '<div class="muted small">Admission</div>' : ''}</td>
          <td>${esc(c.students.reg_no)} · ${esc(c.students.name)}<div class="muted small">s/o ${esc(c.students.father_name)}</div></td>
          <td>${esc(c.students.classes?.name)}${c.students.sections ? ' – ' + esc(c.students.sections.name) : ''}</td>
          <td>${fmtMonth(c.month.slice(0, 7))}<div class="muted small">Due ${fmtDate(c.due_date)}</div></td>
          <td class="num">${fmtRs(c.total_payable)}</td><td class="num">${fmtRs(c.paid_amount)}</td>
          <td class="num">${c.carried_to ? '–' : fmtRs(c.balance)}</td>
          <td>${statusBadge(c.status, c.carried_to)}</td>
          <td class="num"><button class="btn ${canPay ? '' : 'btn-light'} btn-sm" data-id="${c.id}">${canPay ? 'Collect' : 'History'}</button></td></tr>`;
      }).join('') : emptyRow(9, 'Nothing found. Untick "Only unpaid" to see paid challans too.');
    } catch (e) { $('rows').innerHTML = emptyRow(9, e.message); }
  }

  $('q').addEventListener('input', debounce(search));
  $('open-only').addEventListener('change', search);

  // Late fine that will be added if paying after the due date
  const fineFor = (c, paidOn) => (!c.fine_applied && Number(c.late_fine) > 0 && paidOn > c.due_date ? Number(c.late_fine) : 0);

  function updateFineNote() {
    const fine = fineFor(current, $('paid_on').value);
    const note = $('fine-note');
    note.style.display = fine ? 'block' : 'none';
    if (fine) note.textContent = `Paid after the due date: a late fine of ${fmtRs(fine)} will be added. Balance becomes ${fmtRs(Number(current.balance) + fine)}.`;
    return fine;
  }

  async function openPay(id) {
    current = results.find((c) => c.id === id);
    const canPay = !current.carried_to && Number(current.balance) > 0;
    showFormError($('form-error'), '');
    $('c-info').innerHTML = `<div><b>${esc(current.students.name)}</b> <span class="muted">(${esc(current.students.reg_no)})</span></div>
      <div class="muted small">${esc(current.challan_no)} · ${fmtMonth(current.month.slice(0, 7))} · Payable ${fmtRs(current.total_payable)} · Paid ${fmtRs(current.paid_amount)}</div>
      <div style="font-size:1.2rem;font-weight:700;margin-top:.3rem">${current.carried_to ? 'Carried forward to a newer challan' : 'Balance ' + fmtRs(current.balance)}</div>`;
    $('pay-form').style.display = canPay ? '' : 'none';
    $('c-history').innerHTML = '<span class="spinner"></span>';
    if (canPay) {
      $('paid_on').value = todayStr(); $('method').value = 'cash'; $('received_by').value = user.name; $('notes').value = '';
      $('amount').value = Number(current.balance) + fineFor(current, todayStr());
      updateFineNote();
    }
    openModal('m-pay');
    try {
      const pays = await api('/payments/by-challan/' + id);
      $('c-history').innerHTML = pays.length ? `<div class="label">Payments so far</div>` + pays.map((p) =>
        `<div class="flex justify-between small" style="padding:.25rem 0;border-bottom:1px solid var(--line)"><span>${fmtDate(p.paid_on)} · ${esc(cap(p.method))} · ${fmtRs(p.amount)}</span>
         <a href="/print/receipt.html?id=${p.id}" target="_blank">Receipt ${esc(p.receipt_no)}</a></div>`).join('') : '<div class="muted small">No payments yet.</div>';
    } catch (e) { $('c-history').innerHTML = ''; }
  }

  $('rows').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) openPay(b.dataset.id); });
  document.querySelectorAll('#m-pay [data-close]').forEach((b) => b.addEventListener('click', () => closeModal('m-pay')));
  $('paid_on').addEventListener('change', updateFineNote);

  $('pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number($('amount').value);
    const max = Number(current.balance) + updateFineNote();
    const errs = [];
    if (!(amount > 0)) errs.push('Enter an amount greater than 0');
    if (amount > max) errs.push(`Amount is more than the balance due (${fmtRs(max)})`);
    if (!$('paid_on').value || $('paid_on').value > todayStr()) errs.push('Payment date cannot be in the future');
    if (!$('received_by').value.trim()) errs.push('Received by is required');
    if (errs.length) return showFormError($('form-error'), errs.join('. '));
    showFormError($('form-error'), '');

    const btn = $('pay-btn'); setBusy(btn, true, 'Saving…');
    try {
      const r = await api('/payments', { method: 'POST', body: {
        challan_id: current.id, amount, paid_on: $('paid_on').value, method: $('method').value,
        received_by: $('received_by').value.trim(), notes: $('notes').value.trim() } });
      closeModal('m-pay');
      toast(r.status === 'paid' ? 'Payment saved. Challan fully paid.' : `Payment saved. Balance ${fmtRs(r.balance)}`);
      search();
      if (await confirmBox('Print the fee receipt now?', 'Print receipt', false, 'Not now')) window.open('/print/receipt.html?id=' + r.payment.id, '_blank');
    } catch (ex) { showFormError($('form-error'), ex.message); }
    finally { setBusy(btn, false); }
  });
})();

(async () => {
  if (!requireAuth(null, null, false)) return;
  $('print-btn').addEventListener('click', () => window.print());

  // One challan = one landscape A4 page with 3 copies side by side
  function copy(label, c, s, bank) {
    const st = c.students;
    const fee = Math.max(0, Number(c.tuition_fee) - Number(c.discount));
    const lines = [];
    if (c.type === 'admission') lines.push(['Admission fee', c.admission_fee]);
    else {
      lines.push(['Tuition fee', c.tuition_fee]);
      if (Number(c.discount)) lines.push(['Discount', '- ' + Number(c.discount).toLocaleString('en-US')]);
    }
    if (Number(c.arrears)) lines.push([`Previous arrears (${c.arrears_months} month${c.arrears_months === 1 ? '' : 's'})`, c.arrears]);
    if (c.fine_applied) lines.push(['Late fine', c.late_fine]);
    const row = ([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="r">${typeof v === 'string' ? 'Rs. ' + esc(v) : fmtRs(v)}</td></tr>`;
    const afterDue = c.fine_applied || !Number(c.late_fine) ? '' :
      `<tr><td class="k">Late fine after due date</td><td class="r">${fmtRs(c.late_fine)}</td></tr>
       <tr><td class="k">Payable after due date</td><td class="r"><b>${fmtRs(Number(c.balance) + Number(c.late_fine))}</b></td></tr>`;
    return `<div class="copy">
      <div class="head"><div class="logo">LOGO</div><b>${esc(s.academy_name)}</b><span>${esc(s.address)}${s.phone ? ' · ' + esc(s.phone) : ''}</span></div>
      <div class="tag">${esc(label)} COPY &mdash; ${c.type === 'admission' ? 'ADMISSION CHALLAN' : 'FEE CHALLAN'}</div>
      <table>
        <tr><td class="k">Challan no</td><td><b>${esc(c.challan_no)}</b></td></tr>
        <tr><td class="k">Month</td><td>${fmtMonth(c.month.slice(0, 7))}</td></tr>
        <tr><td class="k">Due date</td><td><b>${fmtDate(c.due_date)}</b></td></tr>
        <tr><td class="k">Roll no</td><td>${esc(st.reg_no)}</td></tr>
        <tr><td class="k">Student</td><td>${esc(st.name)}</td></tr>
        <tr><td class="k">Father</td><td>${esc(st.father_name)}</td></tr>
        <tr><td class="k">Class</td><td>${esc(st.classes?.name)}${st.sections ? ' – ' + esc(st.sections.name) : ''}</td></tr>
      </table>
      <table>${lines.map(row).join('')}
        ${Number(c.paid_amount) ? `<tr><td class="k">Already paid</td><td class="r">- ${fmtRs(c.paid_amount)}</td></tr>` : ''}
        <tr class="total"><td class="k">Total payable</td><td class="r">${fmtRs(c.balance)}</td></tr>${afterDue}</table>
      ${bank ? '<div class="note">Bank: ______________________ &nbsp; Account no: ______________________<br>Deposit slip no: ______________</div>' : '<div class="note">Please pay on or before the due date.</div>'}
      <div class="sign"><span>${bank ? 'Bank stamp &amp; signature' : 'Cashier signature'}</span><span>${label === 'Student' ? 'Parent signature' : 'Date'}</span></div>
    </div>`;
  }

  try {
    const d = await api('/challans/print-data' + location.search);
    $('info').textContent = `${d.challans.length} challan${d.challans.length === 1 ? '' : 's'} ready (${d.challans.length} page${d.challans.length === 1 ? '' : 's'})`;
    $('out').innerHTML = d.challans.map((c) => `<section class="sheet">${copy('Student', c, d.settings, false)}${copy('Academy', c, d.settings, false)}${copy('Bank', c, d.settings, true)}</section>`).join('');
  } catch (e) { $('info').textContent = e.message; }
})();

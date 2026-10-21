(async () => {
  if (!requireAuth(null, null, false)) return;
  $('print-btn').addEventListener('click', () => window.print());
  const id = new URLSearchParams(location.search).get('id');
  try {
    const { payment: p, settings: s } = await api('/payments/' + encodeURIComponent(id));
    const st = p.students, c = p.challans;
    $('out').innerHTML = `
      <div class="head"><div class="logo">LOGO</div><b>${esc(s.academy_name)}</b><span>${esc(s.address)}${s.phone ? ' · ' + esc(s.phone) : ''}</span></div>
      <div class="title">FEE RECEIPT</div>
      <table>
        <tr><td class="k">Receipt no</td><td><b>${esc(p.receipt_no)}</b></td></tr>
        <tr><td class="k">Date</td><td>${fmtDate(p.paid_on)}</td></tr>
        <tr><td class="k">Roll no</td><td>${esc(st.reg_no)}</td></tr>
        <tr><td class="k">Student</td><td>${esc(st.name)} (s/o ${esc(st.father_name)})</td></tr>
        <tr><td class="k">Class</td><td>${esc(st.classes?.name)}${st.sections ? ' – ' + esc(st.sections.name) : ''}</td></tr>
        <tr><td class="k">Challan</td><td>${esc(c.challan_no)} · ${fmtMonth(c.month.slice(0, 7))}${c.type === 'admission' ? ' (admission)' : ''}</td></tr>
        <tr><td class="k">Payment method</td><td>${esc(cap(p.method))}</td></tr>
        ${p.notes ? `<tr><td class="k">Notes</td><td>${esc(p.notes)}</td></tr>` : ''}
      </table>
      <table>
        <tr class="amount"><td class="k">Amount received</td><td class="r">${fmtRs(p.amount)}</td></tr>
        <tr><td class="k">Challan total</td><td class="r">${fmtRs(c.total_payable)}</td></tr>
        <tr><td class="k">Paid so far</td><td class="r">${fmtRs(c.paid_amount)}</td></tr>
        <tr><td class="k">Balance remaining</td><td class="r"><b>${fmtRs(c.balance)}</b></td></tr>
      </table>
      <div class="sign"><span>Received by: ${esc(p.received_by)}</span><span>Stamp</span></div>`;
    document.title = 'Receipt ' + p.receipt_no;
  } catch (e) { $('out').textContent = e.message; }
})();

(() => {
  if (!requireAuth('reports')) return;
  let classes = [], defaulters = [], loaded = {};

  const kv = (obj) => Object.entries(obj).map(([k, v]) => `<tr><td>${esc(cap(k))}</td><td class="num">${fmtRs(v)}</td></tr>`).join('') || emptyRow(2, 'No payments');
  const stat = (k, v) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v" style="font-size:1.35rem">${esc(v)}</div></div>`;

  // ----- tabs -----
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    ['defaulters', 'daily', 'monthly'].forEach((n) => { $('tab-' + n).style.display = n === t.dataset.tab ? '' : 'none'; });
    if (!loaded[t.dataset.tab]) { loaded[t.dataset.tab] = true; ({ defaulters: loadDefaulters, daily: loadDaily, monthly: loadMonthly })[t.dataset.tab](); }
  }));
  $('btn-print').addEventListener('click', () => window.print());

  // ----- defaulters -----
  async function loadDefaulters() {
    $('d-rows').innerHTML = loadingRow(6);
    try {
      const d = await api('/reports/defaulters?' + qs({ class_id: $('d-class').value, section_id: $('d-section').value }));
      defaulters = d.rows;
      $('d-summary').textContent = `${defaulters.length} student${defaulters.length === 1 ? '' : 's'} · Total due ${fmtRs(d.total)}`;
      $('d-rows').innerHTML = defaulters.length ? defaulters.map((r) => `<tr><td><b>${esc(r.reg_no)}</b></td>
        <td>${esc(r.name)}<div class="muted small">s/o ${esc(r.father_name)}${r.status === 'left' ? ' · left' : ''}</div></td>
        <td>${esc(r.class_name)}${r.section_name ? ' – ' + esc(r.section_name) : ''}</td><td>${esc(r.phone)}</td>
        <td class="num">${r.months_overdue}</td><td class="num">${fmtRs(r.amount_due)}</td></tr>`).join('')
        : emptyRow(6, 'No defaulters. All fees are up to date.');
    } catch (e) { $('d-rows').innerHTML = emptyRow(6, e.message); }
  }
  $('d-class').addEventListener('change', () => { fillSections($('d-section'), classes, $('d-class').value); loadDefaulters(); });
  $('d-section').addEventListener('change', loadDefaulters);
  $('d-csv').addEventListener('click', () => {
    if (!defaulters.length) return toast('Nothing to export', 'error');
    downloadCSV(`defaulters-${todayStr()}.csv`, [['Roll no', 'Student', 'Father', 'Class', 'Section', 'Phone', 'Months overdue', 'Amount due (Rs.)']]
      .concat(defaulters.map((r) => [r.reg_no, r.name, r.father_name, r.class_name, r.section_name, r.phone, r.months_overdue, r.amount_due])));
  });

  // ----- daily -----
  async function loadDaily() {
    $('y-rows').innerHTML = loadingRow(7);
    try {
      const d = await api('/reports/daily?date=' + $('y-date').value);
      $('y-totals').innerHTML = stat('Total collected, ' + fmtDate(d.date), fmtRs(d.total)) + stat('Payments', d.payments.length) +
        Object.entries(d.by_method).map(([m, v]) => stat(cap(m), fmtRs(v))).join('');
      $('y-rows').innerHTML = d.payments.length ? d.payments.map((p) => `<tr><td>${esc(p.receipt_no)}</td>
        <td>${esc(p.students?.reg_no)} · ${esc(p.students?.name)}</td><td>${esc(p.students?.classes?.name)}${p.students?.sections ? ' – ' + esc(p.students.sections.name) : ''}</td>
        <td>${esc(p.challans?.challan_no)}</td><td>${esc(cap(p.method))}</td><td>${esc(p.received_by)}</td><td class="num">${fmtRs(p.amount)}</td></tr>`).join('')
        : emptyRow(7, 'No payments on this date.');
    } catch (e) { $('y-rows').innerHTML = emptyRow(7, e.message); }
  }
  $('y-date').addEventListener('change', loadDaily);

  // ----- monthly -----
  async function loadMonthly() {
    try {
      const d = await api('/reports/monthly?month=' + $('m-month').value);
      $('m-totals').innerHTML = stat('Billed (new charges)', fmtRs(d.billed)) + stat('Collected', fmtRs(d.collected)) +
        stat('Still due on this month\'s challans', fmtRs(d.still_due)) + stat('Challans issued', d.challan_count);
      $('m-days').innerHTML = d.by_day.map((x) => `<tr><td>${fmtDate(x.date)}</td><td class="num">${x.count}</td><td class="num">${fmtRs(x.amount)}</td></tr>`).join('') || emptyRow(3, 'No payments');
      $('m-methods').innerHTML = kv(d.by_method);
      $('m-classes').innerHTML = kv(d.by_class);
    } catch (e) { toast(e.message, 'error'); }
  }
  $('m-month').addEventListener('change', loadMonthly);

  (async () => {
    $('y-date').value = todayStr(); $('m-month').value = curMonthStr();
    try { classes = await api('/classes'); } catch (e) { toast(e.message, 'error'); }
    fillSelect($('d-class'), classes, 'All classes', (c) => c.id, (c) => c.name);
    fillSections($('d-section'), classes, '');
    loaded.defaulters = true;
    loadDefaulters();
  })();
})();

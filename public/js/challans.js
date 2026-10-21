(() => {
  if (!requireAuth('challans')) return;
  let classes = [];

  const filters = () => ({ month: $('f-month').value, class_id: $('f-class').value, section_id: $('f-section').value, status: $('f-status').value });

  async function init() {
    $('g-month').value = curMonthStr();
    $('f-month').value = curMonthStr();
    try { classes = await api('/classes'); } catch (e) { toast(e.message, 'error'); }
    ['g', 'f'].forEach((p) => {
      fillSelect($(p + '-class'), classes, p === 'g' ? 'All classes' : 'All classes', (c) => c.id, (c) => c.name);
      fillSections($(p + '-section'), classes, '');
      $(p + '-class').addEventListener('change', () => { fillSections($(p + '-section'), classes, $(p + '-class').value); if (p === 'f') load(); });
    });
    ['f-month', 'f-section', 'f-status'].forEach((id) => $(id).addEventListener('change', load));
    load();
  }

  async function load() {
    $('rows').innerHTML = loadingRow(9);
    try {
      const list = await api('/challans?' + qs(filters()));
      const payable = list.filter((c) => !c.carried_to).reduce((t, c) => t + Number(c.total_payable), 0);
      const balance = list.filter((c) => !c.carried_to).reduce((t, c) => t + Number(c.balance), 0);
      $('summary').textContent = `${list.length} challan${list.length === 1 ? '' : 's'} · Total payable ${fmtRs(payable)} · Balance ${fmtRs(balance)}`;
      $('rows').innerHTML = list.length ? list.map((c) => `<tr>
        <td><b>${esc(c.challan_no)}</b>${c.type === 'admission' ? '<div class="muted small">Admission</div>' : ''}</td>
        <td>${esc(c.students.reg_no)} · ${esc(c.students.name)}</td>
        <td>${esc(c.students.classes?.name)}${c.students.sections ? ' – ' + esc(c.students.sections.name) : ''}</td>
        <td>${fmtMonth(c.month.slice(0, 7))}<div class="muted small">Due ${fmtDate(c.due_date)}</div></td>
        <td class="num">${fmtRs(c.total_payable)}${Number(c.arrears) ? `<div class="muted small">incl. arrears ${fmtRs(c.arrears)}</div>` : ''}</td>
        <td class="num">${fmtRs(c.paid_amount)}</td>
        <td class="num">${c.carried_to ? '–' : fmtRs(c.balance)}</td>
        <td>${statusBadge(c.status, c.carried_to)}</td>
        <td class="num"><a class="btn btn-light btn-sm" target="_blank" href="/print/challan.html?ids=${c.id}">Print</a></td></tr>`).join('')
        : emptyRow(9, 'No challans for this selection. Use "Generate challans" above.');
    } catch (e) { $('rows').innerHTML = emptyRow(9, e.message); }
  }

  $('g-btn').addEventListener('click', async () => {
    const month = $('g-month').value;
    if (!month) return toast('Please choose a month', 'error');
    const cls = $('g-class').value ? classes.find((c) => c.id === $('g-class').value).name : 'all students';
    if (!(await confirmBox(`Generate ${fmtMonth(month)} challans for ${cls}?`, 'Generate'))) return;
    const btn = $('g-btn'); setBusy(btn, true, 'Generating…');
    try {
      const r = await api('/challans/generate', { method: 'POST', body: { month, class_id: $('g-class').value, section_id: $('g-section').value } });
      toast(`${r.created} challan${r.created === 1 ? '' : 's'} created, ${r.skipped} skipped (already existed)`);
      $('f-month').value = month; load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(btn, false); }
  });

  $('btn-print-all').addEventListener('click', () => {
    const f = filters();
    if (!f.month && !f.class_id) return toast('Choose a month (and class) first, so you do not print everything', 'error');
    window.open('/print/challan.html?' + qs(f), '_blank');
  });

  init();
})();

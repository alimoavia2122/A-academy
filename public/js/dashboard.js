(async () => {
  if (!requireAuth('dashboard')) return;
  try {
    const d = await api('/dashboard');
    $('month-label').textContent = fmtMonth(d.month);
    $('c-students').textContent = Number(d.active_students).toLocaleString('en-US');
    $('c-billed').textContent = fmtRs(d.billed);
    $('c-collected').textContent = fmtRs(d.collected);
    $('c-pending').textContent = fmtRs(d.pending);
    $('c-expenses').textContent = fmtRs(d.expenses);
    $('s-collected').textContent = fmtRs(d.collected);
    $('s-expenses').textContent = fmtRs(d.expenses);
    const net = $('s-net');
    net.textContent = fmtRs(d.net);
    net.style.color = d.net < 0 ? 'var(--red)' : '#116a39';
  } catch (e) {
    $('c-students').textContent = '-';
    toast(e.message, 'error');
  }
})();

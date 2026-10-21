/* Login guard + sidebar. Every protected page calls requireAuth('page-key'). */
const NAV = [
  { href: '/dashboard.html', key: 'dashboard', label: 'Dashboard', icon: '▦', roles: ['admin', 'accountant'] },
  { href: '/students.html', key: 'students', label: 'Students', icon: '☺', roles: ['admin', 'accountant'] },
  { href: '/classes.html', key: 'classes', label: 'Classes & settings', icon: '▤', roles: ['admin'] },
  { href: '/challans.html', key: 'challans', label: 'Challans', icon: '▭', roles: ['admin', 'accountant'] },
  { href: '/collect-fee.html', key: 'collect-fee', label: 'Collect fee', icon: '₨', roles: ['admin', 'accountant'] },
  { href: '/expenses.html', key: 'expenses', label: 'Expenses', icon: '↧', roles: ['admin', 'accountant'] },
  { href: '/reports.html', key: 'reports', label: 'Reports', icon: '≣', roles: ['admin', 'accountant'] },
];

function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }

// Returns the logged-in user, or sends the visitor to the login page.
//   roles    : optional list of roles allowed on this page
//   withShell: false for print pages (no sidebar)
function requireAuth(active, roles = null, withShell = true) {
  const user = getUser();
  if (!user || !localStorage.getItem(TOKEN_KEY)) { location.href = '/login.html'; return null; }
  if (roles && !roles.includes(user.role)) { location.href = '/dashboard.html'; return null; }
  if (withShell) renderSidebar(user, active);
  return user;
}

function renderSidebar(user, active) {
  const side = $('sidebar');
  if (!side) return;
  side.innerHTML = `
    <div class="brand"><b>Arhum Academy</b><span>Dully Wala</span></div>
    <nav aria-label="Main">${NAV.filter((n) => n.roles.includes(user.role)).map((n) =>
      `<a class="nav-link ${n.key === active ? 'active' : ''}" href="${n.href}"><span aria-hidden="true">${n.icon}</span>${n.label}</a>`).join('')}</nav>
    <div class="side-user"><div><b>${esc(user.name)}</b></div><div style="color:#8fb5a8">${esc(cap(user.role))}</div>
      <button class="btn btn-light btn-sm" id="logout-btn">Log out</button></div>`;
  $('logout-btn').addEventListener('click', () => { clearSession(); location.href = '/login.html'; });
  const menu = $('menu-btn');
  if (menu) menu.addEventListener('click', () => side.classList.toggle('open'));
}

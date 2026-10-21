/* Shared helpers loaded on every page: API calls, formatting, toasts, dialogs. */
const TOKEN_KEY = 'arh_token', REFRESH_KEY = 'arh_refresh', USER_KEY = 'arh_user';
const $ = (id) => document.getElementById(id);

function clearSession() { [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k)); }

// Gets a new access token (they expire after about an hour)
async function refreshSession() {
  const refresh_token = localStorage.getItem(REFRESH_KEY);
  if (!refresh_token) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    localStorage.setItem(TOKEN_KEY, json.data.access_token);
    localStorage.setItem(REFRESH_KEY, json.data.refresh_token);
    return true;
  } catch { return false; }
}

// api('/students?status=active')  or  api('/students', { method: 'POST', body: {...} })
// Returns the "data" part of the response, or throws an Error with a readable message.
async function api(path, options = {}, retried = false) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch('/api' + path, {
      method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }

  if (res.status === 401 && path !== '/auth/login') {
    if (!retried && (await refreshSession())) return api(path, options, true);
    clearSession();
    location.href = '/login.html';
    throw new Error('Session expired. Please log in again.');
  }
  let json = {};
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || json.success === false) throw new Error(json.error || 'Request failed');
  return json.data;
}

// ---------- formatting ----------
const fmtRs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = String(d).slice(0, 10).split('-'); return `${day}-${MONTHS[+m - 1]}-${y}`; };
const fmtMonth = (d) => { if (!d) return ''; const [y, m] = String(d).split('-'); return `${MONTHS_LONG[+m - 1]} ${y}`; };
const todayStr = () => new Date().toLocaleDateString('en-CA');          // YYYY-MM-DD in local time
const curMonthStr = () => todayStr().slice(0, 7);                       // YYYY-MM
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qs = (obj) => Object.entries(obj).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function statusBadge(status, carried) {
  if (carried) return '<span class="badge badge-gray">Carried forward</span>';
  const cls = { paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red', active: 'badge-green', left: 'badge-gray' }[status] || 'badge-gray';
  return `<span class="badge ${cls}">${esc(cap(status))}</span>`;
}

// ---------- UI helpers ----------
function toast(message, type = 'ok') {
  let box = $('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'error' : '');
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

const openModal = (id) => $(id).classList.add('open');
const closeModal = (id) => $(id).classList.remove('open');

// Confirmation dialog. Returns a Promise<boolean>.  if (await confirmBox('Delete?', 'Delete', true)) ...
function confirmBox(message, okText = 'Yes', danger = false, cancelText = 'Cancel') {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back open';
    back.style.zIndex = 90;
    back.innerHTML = `<div class="modal" style="max-width:26rem"><p style="margin:0 0 1rem">${esc(message)}</p>
      <div class="flex justify-end gap-2"><button class="btn btn-light" data-r="0">${esc(cancelText)}</button>
      <button class="btn ${danger ? 'btn-danger' : ''}" data-r="1">${esc(okText)}</button></div></div>`;
    back.addEventListener('click', (e) => {
      const r = e.target.dataset && e.target.dataset.r;
      if (r !== undefined) { back.remove(); resolve(r === '1'); }
    });
    document.body.appendChild(back);
  });
}

// Disables a button and shows text while saving
function setBusy(btn, busy, text = 'Please wait…') {
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

function showFormError(el, message) { el.textContent = message; el.classList.toggle('show', !!message); }

const loadingRow = (cols) => `<tr><td colspan="${cols}" class="text-center muted" style="padding:2rem"><span class="spinner"></span> Loading…</td></tr>`;
const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="text-center muted" style="padding:2rem">${esc(text)}</td></tr>`;

function fillSelect(sel, items, placeholder, val, label) {
  sel.innerHTML = (placeholder === null ? '' : `<option value="">${esc(placeholder)}</option>`) +
    items.map((i) => `<option value="${esc(val(i))}">${esc(label(i))}</option>`).join('');
}
function fillSections(sel, classes, classId, placeholder = 'All sections') {
  const c = classes.find((x) => x.id === classId);
  fillSelect(sel, c ? c.sections : [], placeholder, (s) => s.id, (s) => s.name);
}

// rows = array of arrays; the first row is the header
function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Closes any modal when its dark background is clicked or Esc is pressed
document.addEventListener('click', (e) => { if (e.target.classList && e.target.classList.contains('modal-back') && e.target.id) closeModal(e.target.id); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-back.open[id]').forEach((m) => m.classList.remove('open')); });

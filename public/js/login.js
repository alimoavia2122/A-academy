(() => {
  if (localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY)) { location.href = '/dashboard.html'; return; }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    const err = $('form-error');
    showFormError(err, '');
    if (!email || !password) return showFormError(err, 'Please enter your email and password.');

    const btn = $('login-btn');
    setBusy(btn, true, 'Logging in…');
    try {
      const d = await api('/auth/login', { method: 'POST', body: { email, password } });
      localStorage.setItem(TOKEN_KEY, d.access_token);
      localStorage.setItem(REFRESH_KEY, d.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(d.user));
      location.href = '/dashboard.html';
    } catch (ex) {
      showFormError(err, ex.message);
      setBusy(btn, false);
    }
  });
})();

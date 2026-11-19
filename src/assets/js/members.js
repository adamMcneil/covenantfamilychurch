// Member directory (/members/): sign in with a code emailed by Supabase Auth,
// then download the directory from a private Supabase Storage bucket that only
// signed-in members can read. Only people added under Authentication > Users in
// Supabase can sign in. Setup: README.md, "Member directory".
(() => {
  const root = document.querySelector('.members');
  if (!root) return;
  const { url, key, bucket, file, downloadName } = root.dataset;
  const emailForm = root.querySelector('.members-email');
  const codeForm = root.querySelector('.members-code');
  const signedIn = root.querySelector('.members-in');
  const status = root.querySelector('.form-status');
  const STORE = 'cfc-members-session';
  let email = '';

  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  const show = step => {
    for (const el of [emailForm, codeForm, signedIn]) el.hidden = el !== step;
  };

  // POST to the Supabase API; throws with the HTTP status on failure.
  const call = async (path, body, token) => {
    let res;
    try {
      res = await fetch(url + path, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body || {}),
      });
    } catch {
      throw Object.assign(new Error('network'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.msg || data.message || data.error || res.statusText), { status: res.status });
    return data;
  };

  // The sign-in lasts for this browser tab only.
  const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)); } catch { return null; } };
  const save = s => { try { s ? sessionStorage.setItem(STORE, JSON.stringify(s)) : sessionStorage.removeItem(STORE); } catch {} };
  const keep = (data, who) => {
    const s = {
      token: data.access_token,
      refresh: data.refresh_token,
      expires: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      email: data.user?.email || who || '',
    };
    save(s);
    return s;
  };

  // A session whose access token is still good, refreshing it if needed.
  const session = async () => {
    const s = load();
    if (!s) return null;
    if (s.expires - Date.now() > 60000) return s;
    try {
      return keep(await call('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh }), s.email);
    } catch {
      save(null);
      return null;
    }
  };

  const showSignedIn = s => {
    root.querySelector('.members-who').textContent = s.email;
    show(signedIn);
  };

  const unavailable = () => say('The sign-in service could not be reached. Please try again in a minute.', true);

  emailForm.addEventListener('submit', async e => {
    e.preventDefault();
    email = emailForm.email.value.trim();
    say('Sending…');
    try {
      // create_user: false, so an address not on the member list never gets an account.
      await call('/auth/v1/otp', { email, create_user: false });
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return unavailable();
      if (err.status === 429) return say('Please wait a minute before asking for another code.', true);
      // Anything else (usually "not on the member list") gets the same answer as success,
      // so the page never reveals who is or isn't a member.
    }
    show(codeForm);
    codeForm.code.value = '';
    codeForm.code.focus();
    say(`If ${email} is on the member list, a sign-in code is on its way. It can take a minute; check your spam folder too.`);
  });

  codeForm.addEventListener('submit', async e => {
    e.preventDefault();
    say('Checking…');
    try {
      const data = await call('/auth/v1/verify', { type: 'email', email, token: codeForm.code.value.trim() });
      showSignedIn(keep(data, email));
      say('');
    } catch (err) {
      if (err.status === 0 || err.status >= 500) return unavailable();
      say('That code did not work. Check it and try again, or use a different email to get a new code.', true);
    }
  });

  root.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'restart') {
      show(emailForm);
      say('');
      emailForm.email.focus();
    }
    if (action === 'signout') {
      const s = load();
      save(null);
      show(emailForm);
      say('You are signed out.');
      if (s) call('/auth/v1/logout?scope=local', {}, s.token).catch(() => {});
    }
    if (action === 'download') {
      const s = await session();
      if (!s) {
        show(emailForm);
        return say('Your sign-in has expired. Please sign in again.', true);
      }
      say('Preparing the download…');
      try {
        const path = `/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(file)}`;
        const { signedURL } = await call(path, { expiresIn: 60 }, s.token);
        location.href = `${url}/storage/v1${signedURL}&download=${encodeURIComponent(downloadName)}`;
        say('');
      } catch (err) {
        if (err.status === 0 || err.status >= 500) return unavailable();
        say('The directory could not be downloaded. Please let the pastor know.', true);
      }
    }
  });

  // Start: arriving from an invitation email (#access_token=…), already signed in, or signed out.
  (async () => {
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.has('access_token') || hash.has('error')) history.replaceState(null, '', location.pathname + location.search);
    if (hash.has('access_token')) {
      const data = Object.fromEntries(hash);
      try {
        const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${data.access_token}` } });
        data.user = await res.json();
      } catch {}
      return showSignedIn(keep(data));
    }
    if (hash.has('error')) {
      show(emailForm);
      return say('That link has expired. Enter your email below to get a sign-in code instead.', true);
    }
    const s = await session();
    if (s) showSignedIn(s);
    else show(emailForm);
  })();
})();

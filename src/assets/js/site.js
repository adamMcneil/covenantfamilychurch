// Covenant Family Church: small progressive enhancements. The site works without this file.
(() => {
  // Old WordPress search links (/?s=term) go to the new search page.
  const params = new URLSearchParams(location.search);
  const searchForm = document.querySelector('form[role="search"]');
  if (params.has('s') && searchForm) {
    location.replace(searchForm.action + '?q=' + encodeURIComponent(params.get('s')));
    return;
  }

  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Submenus: buttons open them for touch and keyboard users.
  document.querySelectorAll('.submenu-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.has-children');
      const open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      document.querySelectorAll('.has-children.is-open').forEach(other => {
        if (other !== item) {
          other.classList.remove('is-open');
          other.querySelector('.submenu-toggle')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.has-children.is-open').forEach(item => {
      item.classList.remove('is-open');
      item.querySelector('.submenu-toggle')?.setAttribute('aria-expanded', 'false');
    });
  });

  // Photo album lightbox
  const dialog = document.querySelector('.lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    const img = dialog.querySelector('img');
    const caption = dialog.querySelector('.lightbox-caption');
    document.querySelectorAll('.album-photo').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        img.src = link.href;
        img.alt = link.dataset.caption || '';
        caption.textContent = link.dataset.caption || '';
        if (link.dataset.post) {
          const a = document.createElement('a');
          a.href = link.dataset.post;
          a.textContent = 'View post';
          caption.append(' ', a);
        }
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  }

  // Contact form: posts to the configured form service, or falls back to
  // opening the visitor's email app when no service is set up yet.
  document.querySelectorAll('.contact-form').forEach(form => {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.querySelector('[name="botcheck"]').value) return;
      const data = new FormData(form);
      const name = `${data.get('first_name')} ${data.get('last_name')}`.trim();
      status.classList.remove('is-error');

      if (!form.getAttribute('action')) {
        const body = `${data.get('message')}\n\n${name}\n${data.get('email')}`;
        location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(body)}`;
        status.textContent = 'Your email app should open with the message filled in. Press send there to deliver it.';
        return;
      }

      data.set('name', name);
      data.delete('botcheck');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Sending…';
      try {
        const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = 'Message sent. Thank you, we will be in touch soon.';
      } catch {
        status.classList.add('is-error');
        status.textContent = `The message did not send. Please try again, or email ${form.dataset.mailto} directly.`;
      } finally {
        button.disabled = false;
      }
    });
  });
})();

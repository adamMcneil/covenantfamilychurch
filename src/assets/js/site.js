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
    if (nav?.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  // Home page slider: arrows and dots move the strip (it already swipes), and wrap around like the old site's.
  document.querySelectorAll('.slider').forEach(slider => {
    const track = slider.querySelector('.slider-track');
    const slides = [...track.querySelectorAll('.slide')];
    const dots = [...slider.querySelectorAll('.slider-dot')];
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    const show = i => {
      const n = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[n].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    };
    slider.querySelector('.slider-prev')?.addEventListener('click', () => show(current - 1));
    slider.querySelector('.slider-next')?.addEventListener('click', () => show(current + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
    const seen = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        current = slides.indexOf(e.target);
        dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
      });
    }, { root: track, threshold: 0.6 });
    slides.forEach(s => seen.observe(s));
  });

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

      const captcha = form.querySelector('.h-captcha');
      if (captcha && !data.get('h-captcha-response')) {
        status.classList.add('is-error');
        status.textContent = window.hcaptcha
          ? 'Please tick the “I am human” box before sending.'
          : `The spam check did not load. Please reload the page, or email ${form.dataset.mailto} directly.`;
        return;
      }

      data.set('name', name);
      ['first_name', 'last_name', 'botcheck'].forEach(field => data.delete(field));
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Sending…';
      try {
        const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        const reply = await res.json().catch(() => ({}));
        if (!res.ok || reply.success === false) throw new Error(reply.message || String(res.status));
        form.reset();
        status.textContent = 'Message sent. Thank you, we will be in touch soon.';
      } catch {
        status.classList.add('is-error');
        status.textContent = `The message did not send. Please try again, or email ${form.dataset.mailto} directly.`;
      } finally {
        button.disabled = false;
        if (captcha) window.hcaptcha?.reset();
      }
    });
  });
})();

// Version picker for previews: a small bar at the bottom of the page to switch between the
// main site and each preview branch, staying on the same page. build-previews.sh fills in
// the versions and adds this script to every page.
//
// It always shows on preview pages. On the main site it shows only to someone who has opened a
// preview (remembered in this browser) or who adds ?preview to the address, so ordinary
// visitors never see it. Its × hides it again on the main site.
(() => {
  const versions = __VERSIONS__;
  if (versions.length < 2) return;

  const root = new URL(document.currentScript.src).pathname.replace(/preview\/picker\.js$/, '');
  const path = location.pathname.startsWith(root) ? location.pathname.slice(root.length) : '';
  const match = path.match(/^preview\/([^/]+)\/(.*)$/);
  const current = match && versions.some(v => v.branch === match[1]) ? match[1] : '';
  const page = current ? match[2] : path;

  const KEY = 'cfc-show-previews';
  const store = {
    get: () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } },
    set: on => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch {} },
  };
  if (current || new URLSearchParams(location.search).has('preview')) store.set(true);
  else if (!store.get()) return;

  const bar = document.createElement('div');
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Site version');
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:14px', 'transform:translateX(-50%)', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'gap:10px', 'max-width:calc(100% - 24px)',
    'padding:8px 10px 8px 16px', 'border-radius:999px', 'border:1px solid #b48a3a',
    'background:#1a2544', 'color:#fff', 'box-shadow:0 6px 24px rgba(0,0,0,.28)',
    'font:500 15px/1.2 "Alegreya Sans","Segoe UI",system-ui,sans-serif',
  ].join(';');

  const label = document.createElement('label');
  label.textContent = 'Version';
  label.htmlFor = 'cfc-version';
  label.style.cssText = 'color:#e3c88f;white-space:nowrap';

  const select = document.createElement('select');
  select.id = 'cfc-version';
  select.style.cssText = 'font:inherit;color:#1a2544;background:#fff;border:0;border-radius:999px;padding:6px 12px;min-width:0;cursor:pointer';
  for (const v of versions) select.add(new Option(v.label, v.branch, false, v.branch === current));
  select.addEventListener('change', () => {
    const to = select.value ? `${root}preview/${select.value}/${page}` : `${root}${page}`;
    location.href = to + location.search.replace(/[?&]preview\b[^&]*/, '').replace(/^&/, '?') + location.hash;
  });

  bar.append(label, select);

  if (!current) {
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Hide the version picker');
    close.style.cssText = 'font:inherit;font-size:20px;line-height:1;color:#fff;background:none;border:0;padding:2px 6px;cursor:pointer';
    close.addEventListener('click', () => { store.set(false); bar.remove(); });
    bar.append(close);
  }

  document.body.append(bar);
  document.body.style.paddingBottom = '72px';
})();

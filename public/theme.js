// Run before styles paint. Only an explicit choice is stored; first visits follow the system.
(() => {
  const key = 'delib:theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  function labelButtons() {
    const dark = root.dataset.theme === 'dark';
    const en = root.lang.startsWith('en');
    const label = en ? (dark ? 'Light' : 'Dark') : (dark ? '亮色' : '暗色');
    const action = en ? `Switch to ${label.toLowerCase()} mode` : `切換${label}模式`;
    const path = dark
      ? 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5'
      : 'M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.hidden = false;
      button.setAttribute('aria-label', action);
      button.title = action;
      button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span>`;
    });
  }
  function apply() {
    root.dataset.theme = valid(preference) ? preference : system.matches ? 'dark' : 'light';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = root.dataset.theme === 'dark' ? '#090d13' : '#f4f6ef';
    labelButtons();
    window.dispatchEvent(new CustomEvent('delib:themechange', { detail: { theme: root.dataset.theme } }));
  }
  apply();
  document.addEventListener('DOMContentLoaded', labelButtons, { once: true });
  new MutationObserver(labelButtons).observe(root, { attributes: true, attributeFilter: ['lang'] });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, preference); } catch {}
    apply();
  });
  system.addEventListener('change', () => { if (!valid(preference)) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = event.newValue; apply(); }
  });
})();

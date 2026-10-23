/* Standalone theme controls: kept separate so visual preferences remain usable
   even when a learning module is still loading or has an unrelated error. */
(() => {
  const presets = {
    sage: { label: 'Sage desk', icon: '✦' },
    violet: { label: 'Violet studio', icon: '✧' },
    sunset: { label: 'Sunset ledger', icon: '☼' },
    midnight: { label: 'Midnight neon', icon: '◒' }
  };
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const legacyTheme = read('ledgerly-theme');
  let selected = legacyTheme === 'light' ? 'sage' : legacyTheme === 'dark' ? 'midnight' : legacyTheme;
  if (!Object.hasOwn(presets, selected)) selected = document.documentElement.dataset.theme;
  if (!Object.hasOwn(presets, selected)) selected = 'sage';

  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove('show'), 2600);
  }

  function apply(theme, announce = false) {
    selected = Object.hasOwn(presets, theme) ? theme : 'sage';
    const preset = presets[selected];
    const dark = selected === 'midnight';
    document.documentElement.dataset.theme = selected;
    write('ledgerly-theme', selected);
    const themeIcon = $('#themeIcon');
    const themeLabel = $('#themeLabel');
    const modeIcon = $('#modeIcon');
    const modeLabel = $('#modeLabel');
    if (themeIcon) themeIcon.textContent = preset.icon;
    if (themeLabel) themeLabel.textContent = preset.label;
    if (modeIcon) modeIcon.textContent = dark ? '◒' : '☼';
    if (modeLabel) modeLabel.textContent = dark ? 'Dark' : 'Light';
    $('#themeToggle')?.setAttribute('aria-label', `Choose a Ledgerly theme. Current theme: ${preset.label}`);
    $('#modeToggle')?.setAttribute('aria-label', `Choose light or dark mode. Current mode: ${dark ? 'dark' : 'light'}`);
    $$('.theme-option').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.themeChoice === selected)));
    $$('.mode-option').forEach(option => option.setAttribute('aria-pressed', String(option.dataset.themeMode === (dark ? 'dark' : 'light'))));
    if (announce) toast(`${preset.label} applied`);
  }

  $$('.theme-option').forEach(option => option.addEventListener('click', event => {
    event.preventDefault();
    apply(option.dataset.themeChoice, true);
    $('#themePicker').open = false;
  }));
  $$('.mode-option').forEach(option => option.addEventListener('click', event => {
    event.preventDefault();
    apply(option.dataset.themeMode === 'dark' ? 'midnight' : 'sage', true);
    $('#modePicker').open = false;
  }));
  $('#themeToggle')?.addEventListener('click', () => { $('#modePicker').open = false; });
  $('#modeToggle')?.addEventListener('click', () => { $('#themePicker').open = false; });
  document.addEventListener('click', event => {
    if (!$('#themePicker')?.contains(event.target)) $('#themePicker').open = false;
    if (!$('#modePicker')?.contains(event.target)) $('#modePicker').open = false;
  });
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    $('#themePicker').open = false;
    $('#modePicker').open = false;
  });
  apply(selected);
})();

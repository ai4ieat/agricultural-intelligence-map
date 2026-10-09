// Runs in the head so a saved theme is applied before the first paint.
(() => {
  const key = 'aim-theme';
  const root = document.documentElement;
  let theme = 'atlas';
  try { if (localStorage.getItem(key) === 'farm') theme = 'farm'; } catch {}
  root.dataset.theme = theme;
  function apply(next) {
    theme = next;
    root.dataset.theme = theme;
    const button = document.getElementById('theme-toggle');
    const farm = theme === 'farm';
    button.setAttribute('aria-pressed', String(farm));
    button.setAttribute('aria-label', farm ? 'ธีมฟาร์ม เปิดอยู่ — สลับเป็นธีมเดิม' : 'สลับเป็นธีมฟาร์ม');
    button.title = farm ? 'กลับไปธีมเดิม' : 'ลองธีมฟาร์ม';
    button.querySelector('.theme-label').textContent = farm ? 'ธีมฟาร์ม' : 'ธีมเดิม';
    button.querySelector('.theme-icon').textContent = farm ? '☀' : '♧';
    try { localStorage.setItem(key, theme); } catch {}
    document.dispatchEvent(new CustomEvent('aim-theme-change', {detail: theme}));
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').addEventListener('click', () => apply(theme === 'farm' ? 'atlas' : 'farm'));
    apply(theme);
  });
  window.addEventListener('storage', event => {
    if (event.key === key && document.getElementById('theme-toggle')) apply(event.newValue === 'farm' ? 'farm' : 'atlas');
  });
})();

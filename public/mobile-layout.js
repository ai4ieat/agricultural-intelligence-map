'use strict';
// Resize the mobile list independently of its scrollable content.
(() => {
  const sidebar = document.getElementById('sidebar');
  const handle = document.getElementById('sheet-handle');
  const workspace = document.querySelector('.workspace');
  const info = document.getElementById('map-info');
  const mobile = matchMedia('(max-width:700px)');
  let level = 1, drag = null, suppressClick = false;
  const heights = () => {
    const available = workspace.clientHeight;
    return [40, Math.min(272, available * .43), Math.min(available * .9, Math.max(272, available * .82))];
  };
  function settle(next) {
    level = Math.max(0, Math.min(2, next));
    sidebar.style.setProperty('--sheet-height', heights()[level] + 'px');
    sidebar.dataset.sheet = String(level);
    sidebar.classList.remove('collapsed', 'sheet-dragging');
    handle.setAttribute('aria-expanded', String(level === 2));
    document.getElementById('mobile-panel').setAttribute('aria-expanded', String(level > 0));
    handle.querySelector('span').textContent = level === 2 ? 'ปัดลงเพื่อดูแผนที่เพิ่ม' : level === 0 ? 'ปัดขึ้นเพื่อค้นหาและดูรายการ' : 'รายการนิคม · ปัดขึ้นเพื่อดูเพิ่ม';
  }
  handle.addEventListener('pointerdown', event => {
    if (!mobile.matches || event.button !== 0) return;
    suppressClick = false;
    drag = { id:event.pointerId, y:event.clientY, height:sidebar.getBoundingClientRect().height, moved:0 };
    handle.setPointerCapture(event.pointerId);
    sidebar.classList.add('sheet-dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.moved = drag.y - event.clientY;
    const limits = heights();
    sidebar.style.setProperty('--sheet-height', Math.max(limits[0], Math.min(limits[2], drag.height + drag.moved)) + 'px');
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const current = drag.height + drag.moved;
    const values = heights();
    let next = values.reduce((best, height, index) => Math.abs(height-current) < Math.abs(values[best]-current) ? index : best, level);
    if (Math.abs(drag.moved) > 36 && next === level) next += Math.sign(drag.moved);
    suppressClick = Math.abs(drag.moved) > 6;
    drag = null;
    settle(event.type === 'pointercancel' ? level : next);
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    settle(level === 2 ? 1 : 2);
  });
  handle.addEventListener('keydown', event => {
    if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    settle(event.key === 'Home' ? 0 : event.key === 'End' ? 2 : level + (event.key === 'ArrowUp' ? 1 : -1));
  });
  document.getElementById('mobile-panel').addEventListener('click', () => settle(level ? 0 : 1));
  document.getElementById('search').addEventListener('focus', () => { if (mobile.matches) settle(2); });
  window.IEAT_SHEET = { reveal: () => { if (mobile.matches && level === 0) settle(1); } };
  function layout() { info.open = !mobile.matches; if(mobile.matches)settle(level); }
  mobile.addEventListener('change', layout);
  new ResizeObserver(() => { if (mobile.matches && !drag) settle(level); }).observe(workspace);
  layout();
})();

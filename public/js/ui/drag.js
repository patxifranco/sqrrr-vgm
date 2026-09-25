export function makeDraggable(el, handle) {
  let sx = 0, sy = 0, sl = 0, st = 0, on = false;
  const down = e => {
    if (!e.target.closest(handle) || e.target.closest('.title-bar-controls')) return;
    const r = el.getBoundingClientRect();
    el.style.transform = 'none';
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top; on = true;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };
  const move = e => {
    if (!on) return;
    el.style.left = `${sl + e.clientX - sx}px`;
    el.style.top = `${st + e.clientY - sy}px`;
  };
  const up = () => { on = false; document.body.style.userSelect = ''; };
  el.addEventListener('mousedown', down);
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  return () => {
    el.removeEventListener('mousedown', down);
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
}

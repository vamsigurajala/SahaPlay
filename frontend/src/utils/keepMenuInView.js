// Ref callback for absolutely-positioned popup menus anchored to a message
// bubble (the long-press emoji/copy/delete menu). The menu is wider than a
// short bubble, so anchored to the bubble's edge it can poke past the side of
// the screen / chat area. Once mounted, this measures the menu and nudges it
// (transform only — layout is untouched) back inside the nearest clipping
// ancestor, intersected with the viewport.
const MARGIN = 8;

function clipBounds(el) {
  let left = 0;
  let top = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;
  let node = el.parentElement;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const r = node.getBoundingClientRect();
      left = Math.max(left, r.left);
      top = Math.max(top, r.top);
      right = Math.min(right, r.right);
      bottom = Math.min(bottom, r.bottom);
      break;
    }
    node = node.parentElement;
  }
  return { left, top, right, bottom };
}

export function keepMenuInView(el) {
  if (!el) return;
  el.style.transform = '';
  const rect = el.getBoundingClientRect();
  if (!rect.width) return;
  const b = clipBounds(el);
  let dx = 0;
  let dy = 0;
  if (rect.right > b.right - MARGIN) dx = b.right - MARGIN - rect.right;
  if (rect.left + dx < b.left + MARGIN) dx = b.left + MARGIN - rect.left;
  if (rect.bottom > b.bottom - MARGIN) dy = b.bottom - MARGIN - rect.bottom;
  if (rect.top + dy < b.top + MARGIN) dy = b.top + MARGIN - rect.top;
  if (dx || dy) el.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
}

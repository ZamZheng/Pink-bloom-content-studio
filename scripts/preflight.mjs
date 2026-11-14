// 此函数在 Chromium 中执行；只检查几何布局，不改写或重排内容。
export function inspectLayout({ safeArea, visualFocus, regions = {}, avoidAreas = [] }) {
  const errors = [];
  const seen = new Set();
  const add = (type, region, detail) => {
    const key = `${type}:${region}`;
    if (!seen.has(key)) { seen.add(key); errors.push({ type, region, detail }); }
  };
  const tolerance = 1;
  const card = document.getElementById('card').getBoundingClientRect();
  const bounds = area => ({ left: card.left + area.x, top: card.top + area.y, right: card.left + area.x + area.width, bottom: card.top + area.y + area.height });
  const outside = (a, b) => a.left < b.left - tolerance || a.right > b.right + tolerance || a.top < b.top - tolerance || a.bottom > b.bottom + tolerance;
  const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance;
  const blocks = [...document.querySelectorAll('[data-block]')];
  for (const el of document.querySelectorAll('[data-region], .surface')) {
    const box = el.getBoundingClientRect();
    const region = el.closest('[data-safe-area]')?.dataset.safeArea;
    const safe = bounds(regions[region] || safeArea);
    const name = el.dataset.region || '卡片内容区';
    if (el.scrollWidth > el.clientWidth + tolerance || el.scrollHeight > el.clientHeight + tolerance) add('overflow', name, '文字溢出区域可用空间');
    if (outside(box, card)) add('crop', name, '区域超出画幅，会被裁切');
    if (outside(box, safe)) add('safe-area', name, '区域超出背景文字安全区');
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (outside(rect, box)) add('overflow', name, '真实文字边界溢出');
        if (outside(rect, card)) add('crop', name, '文字超出画幅');
        if (outside(rect, safe)) add('safe-area', name, '文字超出背景安全区');
        for (const area of avoidAreas) if (intersects(rect, bounds(area))) add('background-conflict', name, `文字进入背景避让区 ${area.id || ''}`);
        let ancestor = walker.currentNode.parentElement;
        while (ancestor && ancestor !== document.body) {
          const style = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          const clippedX = /hidden|clip|auto|scroll/.test(style.overflowX) && (rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance);
          const clippedY = /hidden|clip|auto|scroll/.test(style.overflowY) && (rect.top < bounds.top - tolerance || rect.bottom > bounds.bottom + tolerance);
          if (clippedX || clippedY) add('clip', name, '文字被祖先区域裁切或隐藏');
          ancestor = ancestor.parentElement;
        }
      }
    }
  }
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i];
    for (const b of blocks.slice(i + 1)) {
      if (!a.contains(b) && !b.contains(a) && intersects(a.getBoundingClientRect(), b.getBoundingClientRect())) add('overlap', `${a.dataset.region} / ${b.dataset.region}`, '独立内容块相互遮挡');
    }
    if (visualFocus) {
      const focus = { left: card.left + visualFocus.x, top: card.top + visualFocus.y, right: card.left + visualFocus.x + visualFocus.width, bottom: card.top + visualFocus.y + visualFocus.height };
      if (intersects(a.getBoundingClientRect(), focus)) add('visual-focus', a.dataset.region, '文字块遮挡背景标注的视觉重心');
    }
  }
  return {
    ok: !errors.length, errors,
    metrics: blocks.map(el => {
      const rect = el.getBoundingClientRect();
      return { region: el.dataset.region, x: rect.x - card.x, y: rect.y - card.y, width: rect.width, height: rect.height };
    }),
  };
}

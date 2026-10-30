(() => {
  const selector = "body:is([data-doctor-protected], [data-nurse-protected], [data-pharmacy-protected]) :is(.stat-card > b, .stat-card > strong, .nurse-summary-card strong, [data-count-up])";
  const active = new WeakSet();
  const animatedOnce = new WeakSet();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function animate(node) {
    if (!(node instanceof Element) || active.has(node) || animatedOnce.has(node)) return;
    if (node.closest("[hidden], .page:not(.active), .view:not(.active)")) return;
    animatedOnce.add(node);
    if (reduceMotion.matches) return;
    const original = node.textContent.trim();
    const match = original.match(/^(\D*?)([\d,]+(?:\.\d+)?)(\D*)$/);
    if (!match) return;
    const target = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(target) || target <= 0) return;
    const decimals = (match[2].split(".")[1] || "").length;
    const start = performance.now();
    active.add(node);
    const frame = now => {
      const progress = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = (target * eased).toFixed(decimals);
      node.textContent = `${match[1]}${Number(value).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${match[3]}`;
      if (progress < 1) requestAnimationFrame(frame);
      else { node.textContent = original; active.delete(node); }
    };
    node.textContent = `${match[1]}${(0).toFixed(decimals)}${match[3]}`;
    requestAnimationFrame(frame);
  }

  document.querySelectorAll(selector).forEach(animate);
  new MutationObserver(records => records.forEach(record => {
    if (record.type === "attributes") {
      const root = record.target;
      if (!root.closest?.("[hidden], .page:not(.active), .view:not(.active)")) {
        if (root.matches?.(selector)) animate(root);
        root.querySelectorAll?.(selector).forEach(animate);
      }
    }
    if (record.type === "childList") {
      const target = record.target instanceof Element ? record.target.closest(selector) : record.target.parentElement?.closest(selector);
      if (target && !active.has(target)) animate(target);
    }
    record.addedNodes.forEach(node => {
      if (node instanceof Element) {
        if (node.matches(selector)) animate(node);
        node.querySelectorAll(selector).forEach(animate);
      }
    });
  })).observe(document.body, { attributes: true, attributeFilter: ["class", "hidden"], childList: true, subtree: true });
})();

/* Preserve existing search inputs and their filtering handlers. */
(() => {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('search-toggle.css', document.currentScript.src).href; document.head.append(css);
  function setup(input) {
    const shell = input.closest('label'); if (!shell || shell.classList.contains('cp-search-toggle')) return;
    const label = input.getAttribute('aria-label') || input.placeholder || 'Search records'; input.setAttribute('aria-label', label); shell.classList.add('cp-search-toggle');
    const icon = document.createElement('button'); icon.type = 'button'; icon.className = 'cp-search-open'; icon.setAttribute('aria-label', label);
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'cp-search-close'; clear.setAttribute('aria-label', 'Clear search');
    clear.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
    shell.append(icon, clear);
    const update = () => { clear.hidden = !input.value; };
    const reset = () => { input.value = ''; input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); update(); input.focus(); };
    icon.addEventListener('click', e => { e.preventDefault(); input.focus(); }); clear.addEventListener('click', e => { e.preventDefault(); reset(); });
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); reset(); } });
    update();
  }
  function start() { document.querySelectorAll('input[type="search"]').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();

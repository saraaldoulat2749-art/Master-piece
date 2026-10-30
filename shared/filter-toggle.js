(() => {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('filter-toggle.css', document.currentScript.src).href; document.head.append(css);
  const toolbarSelector = '.records-toolbar, .filter-row, .toolbar, .pharmacy-orders-toolbar';
  const make = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  let sequence = 0;
  function setup(toolbar, controls) {
    if (document.body.classList.contains('admin-unified')) {
      toolbar.classList.add('admin-inline-toolbar');
      const group = make('div', 'admin-inline-filters');
      controls.forEach(control => {
        const label = control.closest('label');
        const title = [...label.childNodes].filter(n => n.nodeType === 3 || n.nodeName === 'SPAN').map(n => n.textContent.trim()).filter(Boolean).join(' ') || control.getAttribute('aria-label') || 'Status';
        label.classList.add('admin-inline-filter');
        label.replaceChildren(make('span', '', title), control);
        control.setAttribute('aria-label', title);
        group.append(label);
      });
      const count = toolbar.querySelector('[data-record-count]');
      if (count) count.before(group); else toolbar.append(group);
      toolbar.querySelectorAll('.product-filters:empty').forEach(n => { n.hidden = true; });
      return;
    }
    toolbar.classList.add('cp-filter-toolbar');
    const trigger = make('button', 'cp-filters-button'); trigger.type = 'button';
    trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="17" r="2" fill="white"/></svg><span>Filters</span>';
    const count = make('span', 'cp-filter-count'); trigger.append(count);
    const panel = make('section', 'cp-filters-panel'); panel.id = 'cp-filters-panel-' + ++sequence; panel.setAttribute('aria-label', 'Filter options'); trigger.setAttribute('aria-controls', panel.id);
    const header = make('div', 'cp-filters-heading'); const copy = make('div', ''); copy.append(make('h3', '', 'Refine results'), make('p', '', 'Results update as you choose.'));
    const reset = make('button', 'cp-filters-reset', 'Reset all'); reset.type = 'button'; header.append(copy, reset);
    const grid = make('div', 'cp-filters-grid');
    const fields = controls.map(control => {
      const label = control.closest('label');
      const title = [...label.childNodes].filter(n => n.nodeType === 3 || n.nodeName === 'SPAN').map(n => n.textContent.trim()).filter(Boolean).join(' ') || control.getAttribute('aria-label') || 'Filter';
      control.setAttribute('aria-label', title); label.classList.add('cp-filter-field');
      label.replaceChildren(make('span', 'cp-filter-field-title', title), control); grid.append(label); return { control, title };
    });
    const footer = make('div', 'cp-filters-footer'); const done = make('button', 'cp-filters-done', 'Done'); done.type = 'button'; footer.append(done); panel.append(header, grid, footer);
    const chips = make('div', 'cp-filter-chips'); chips.setAttribute('aria-label', 'Active filters'); toolbar.append(trigger, chips, panel);
    toolbar.querySelectorAll('.product-filters:empty').forEach(n => { n.hidden = true; });
    const active = c => c.tagName === 'SELECT' ? c.value !== (c.options[0]?.value ?? '') : Boolean(c.value);
    const setOpen = (open, focus = false) => { panel.hidden = !open; panel.inert = !open; trigger.setAttribute('aria-expanded', String(open)); if (focus) (open ? controls[0] : trigger).focus(); };
    const clear = c => { if (c.tagName === 'SELECT') c.selectedIndex = 0; else c.value = ''; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); };
    function update() {
      const selected = fields.filter(({control}) => active(control)); count.textContent = String(selected.length); count.hidden = !selected.length; reset.disabled = !selected.length;
      trigger.classList.toggle('has-filters', Boolean(selected.length)); trigger.setAttribute('aria-label', 'Filters, ' + selected.length + ' active'); chips.replaceChildren(); chips.hidden = !selected.length;
      selected.forEach(({control, title}) => {
        const value = control.tagName === 'SELECT' ? control.selectedOptions[0]?.textContent : control.value;
        const chip = make('button', 'cp-filter-chip'); chip.type = 'button'; chip.append(make('span', '', title + ': ' + value), make('span', 'cp-filter-chip-x', '×')); chip.setAttribute('aria-label', 'Remove ' + title + ' filter');
        chip.addEventListener('click', () => { clear(control); update(); trigger.focus(); }); chips.append(chip);
      });
    }
    trigger.addEventListener('click', () => setOpen(panel.hidden, true)); done.addEventListener('click', () => setOpen(false, true)); reset.addEventListener('click', () => { controls.forEach(clear); update(); });
    controls.forEach(c => { c.addEventListener('input', update); c.addEventListener('change', update); });
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false, true); } });
    setOpen(false); update();
  }
  function start() {
    const groups = new Map();
    document.querySelectorAll('select, input[type="date"]').forEach(c => { const t = c.closest(toolbarSelector); if (!t || !c.closest('label') || c.closest('dialog, tbody')) return; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(c); });
    groups.forEach((controls, toolbar) => setup(toolbar, controls));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();

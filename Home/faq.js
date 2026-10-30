(() => {
    const section = document.getElementById('faq');
    if (!section) return;

    // The shared navbar is loaded asynchronously, so delegate its anchor click.
    document.addEventListener('click', event => {
        const link = event.target.closest('.careplus-navbar a[href$="#faq"]');
        if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        section.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
        if (window.location.hash !== '#faq') history.pushState(null, '', '#faq');
    });

    const buttons = [...section.querySelectorAll('.cp-faq-item button')];
    const setExpanded = (button, expanded) => {
        const answer = document.getElementById(button.getAttribute('aria-controls'));
        button.setAttribute('aria-expanded', String(expanded));
        button.closest('.cp-faq-item').classList.toggle('is-open', expanded);
        answer.inert = !expanded;
        answer.setAttribute('aria-hidden', String(!expanded));
    };

    section.classList.add('cp-faq-ready');
    buttons.forEach((button, index) => {
        setExpanded(button, index === 0);
        button.addEventListener('click', () => {
            const opening = button.getAttribute('aria-expanded') !== 'true';
            buttons.forEach(other => setExpanded(other, other === button && opening));
        });
        button.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
            if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = buttons.length - 1;
            if (next !== undefined) {
                event.preventDefault();
                buttons[next].focus();
            }
        });
    });

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            entry.target.classList.toggle('cp-faq-visible', entry.isIntersecting);
        });
    }, { threshold: 0.08 });
    section.querySelectorAll('.cp-faq-heading, .cp-faq-visual, .cp-faq-item').forEach((element, index) => {
        if (element.classList.contains('cp-faq-item')) {
            element.style.setProperty('--faq-delay', `${(index - 2) * 75}ms`);
        }
        element.classList.add('cp-faq-reveal');
        observer.observe(element);
    });
})();

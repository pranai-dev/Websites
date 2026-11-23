(() => {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('navlinks');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    document.querySelectorAll('.service-group').forEach(group => {
      group.hidden = filter !== 'all' && group.dataset.category !== filter;
    });
  }));

  const socials = window.SHANTALLE_SOCIALS || {};
  document.querySelectorAll('[data-social-network]').forEach(link => {
    const network = link.dataset.socialNetwork;
    const destination = (socials[network] || '').trim();
    if (destination) {
      link.href = destination;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.removeAttribute('aria-disabled');
      link.classList.remove('is-unconfigured');
    } else {
      link.href = '#social-links';
      link.setAttribute('aria-disabled', 'true');
      link.classList.add('is-unconfigured');
      link.title = `Adicionar o endereço oficial do ${network}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        const notice = document.getElementById('socialNotice');
        if (notice) {
          notice.textContent = `O perfil oficial do ${network} será vinculado aqui.`;
          notice.hidden = false;
        }
      });
    }
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

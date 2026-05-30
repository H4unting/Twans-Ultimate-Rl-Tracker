/** 3-section navigation: Home · Review · Squad */

export const NAV_SECTIONS = {
  home: {
    label: 'Home',
    icon: '🏠',
    defaultPage: 'dashboard',
    pages: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'log', label: 'Log' },
      { id: 'focus', label: 'Focus' },
    ],
  },
  review: {
    label: 'Review',
    icon: '📊',
    defaultPage: 'matchlogs',
    pages: [
      { id: 'matchlogs', label: 'Match Logs' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'reports', label: 'Reports' },
    ],
  },
  squad: {
    label: 'Squad',
    icon: '👥',
    defaultPage: 'group',
    pages: [{ id: 'group', label: 'Squad' }],
  },
};

const PAGE_SECTION = Object.fromEntries(
  Object.entries(NAV_SECTIONS).flatMap(([section, cfg]) =>
    cfg.pages.map(p => [p.id, section]),
  ),
);

export function getSectionForPage(pageId) {
  return PAGE_SECTION[pageId] ?? 'home';
}

export function wireNavigation({ onNavigate, getActivePage }) {
  const primary = document.getElementById('primary-nav');
  const sub = document.getElementById('sub-nav');

  primary?.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const cfg = NAV_SECTIONS[section];
      onNavigate(cfg.defaultPage, section);
    });
  });

  sub?.addEventListener('click', e => {
    const pill = e.target.closest('[data-page]');
    if (!pill) return;
    onNavigate(pill.dataset.page, getSectionForPage(pill.dataset.page));
  });

  document.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      onNavigate(NAV_SECTIONS[section].defaultPage, section);
    });
  });

  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      onNavigate(btn.dataset.page, getSectionForPage(btn.dataset.page));
    });
  });

  return () => updateNavUI(getActivePage());
}

export function updateNavUI(pageId) {
  const section = getSectionForPage(pageId);
  const sub = document.getElementById('sub-nav');
  const cfg = NAV_SECTIONS[section];

  document.querySelectorAll('.section-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  if (sub && cfg) {
    sub.innerHTML = cfg.pages.map(p => `
      <button type="button" class="sub-nav-pill${p.id === pageId ? ' active' : ''}" data-page="${p.id}">${p.label}</button>
    `).join('');
  }

  document.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  document.body.classList.toggle('home-active', pageId === 'dashboard');
  document.body.dataset.section = section;
  document.body.dataset.page = pageId;
}

export function mountDock(pageId) {
  const dock = document.getElementById('quick-dock');
  const slot = document.getElementById('home-dock-slot');
  const footer = document.getElementById('dock-footer-slot');
  if (!dock) return;
  if (pageId === 'dashboard' && slot) {
    slot.appendChild(dock);
    document.body.classList.add('dock-in-home');
  } else if (footer) {
    footer.appendChild(dock);
    document.body.classList.remove('dock-in-home');
  }
}

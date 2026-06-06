/** Unified navigation — single top row + review sub-nav */

import { getNavSections } from './games.js';
import { state } from './state.js';

const TOP_BAR_PAGE_IDS = new Set(['profile']);

/** Top-level nav order (home pages + section shortcuts). */
const TOP_NAV_ORDER = [
  { kind: 'page', pageId: 'dashboard' },
  { kind: 'page', pageId: 'log' },
  { kind: 'page', pageId: 'sessions' },
  { kind: 'section', sectionId: 'review' },
  { kind: 'section', sectionId: 'squad' },
  { kind: 'page', pageId: 'setup' },
];

function pageSectionMap(gameId = state.activeGame) {
  const sections = getNavSections(gameId);
  return Object.fromEntries(
    Object.entries(sections).flatMap(([section, cfg]) =>
      cfg.pages.map(p => [p.id, section]),
    ),
  );
}

export function getSectionForPage(pageId, gameId = state.activeGame) {
  return pageSectionMap(gameId)[pageId] ?? 'home';
}

function getTopNavItems(gameId) {
  const sections = getNavSections(gameId);
  return TOP_NAV_ORDER.map(item => {
    if (item.kind === 'page') {
      const page = sections.home?.pages.find(p => p.id === item.pageId);
      return page
        ? { type: 'page', id: item.pageId, label: page.label, section: 'home' }
        : null;
    }
    const sec = sections[item.sectionId];
    return sec
      ? { type: 'section', id: item.sectionId, label: sec.label }
      : null;
  }).filter(Boolean);
}

function renderMainNav(pageId, gameId) {
  const main = document.getElementById('main-nav');
  if (!main) return;

  const section = getSectionForPage(pageId, gameId);
  const items = getTopNavItems(gameId);

  main.innerHTML = items.map(item => {
    const active = item.type === 'page'
      ? pageId === item.id
      : section === item.id;
    const logClass = item.id === 'log' ? ' tab-log' : '';
    const sectionClass = item.type === 'section' ? ' tab-section' : '';
    const activeClass = active ? ' active' : '';

    if (item.type === 'page') {
      return `<button type="button" class="tab main-nav-tab${logClass}${activeClass}" data-page="${item.id}">${item.label}</button>`;
    }
    return `<button type="button" class="tab main-nav-tab tab-section${activeClass}" data-section="${item.id}">${item.label}</button>`;
  }).join('');
}

function renderReviewSubNav(pageId, gameId) {
  const reviewSub = document.getElementById('review-sub-nav');
  if (!reviewSub) return;

  const section = getSectionForPage(pageId, gameId);
  const reviewCfg = getNavSections(gameId).review;

  if (section !== 'review' || !reviewCfg) {
    reviewSub.classList.add('hidden');
    reviewSub.innerHTML = '';
    return;
  }

  reviewSub.classList.remove('hidden');
  reviewSub.innerHTML = reviewCfg.pages
    .filter(p => !TOP_BAR_PAGE_IDS.has(p.id))
    .map(p => `
      <button type="button" class="sub-nav-pill${p.id === pageId ? ' active' : ''}" data-page="${p.id}">${p.label}</button>
    `).join('');
}

function syncMobileNavLabels(allSections) {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;

  const dashBtn = mobileNav.querySelector('.mobile-nav-btn[data-page="dashboard"]');
  const dashPage = allSections.home?.pages.find(p => p.id === 'dashboard');
  if (dashBtn && dashPage && dashBtn.lastChild) {
    dashBtn.lastChild.textContent = dashPage.label;
  }

  const logBtn = mobileNav.querySelector('.mobile-nav-btn[data-page="log"]');
  const logPage = allSections.home?.pages.find(p => p.id === 'log');
  if (logBtn && logPage && logBtn.lastChild) {
    logBtn.lastChild.textContent = logPage.label;
  }

  const sessionsBtn = mobileNav.querySelector('.mobile-nav-btn[data-page="sessions"]');
  const sessionsPage = allSections.home?.pages.find(p => p.id === 'sessions');
  if (sessionsBtn && sessionsPage && sessionsBtn.lastChild) {
    sessionsBtn.lastChild.textContent = sessionsPage.label;
  }

  mobileNav.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    const secCfg = allSections[btn.dataset.section];
    if (secCfg && btn.lastChild) btn.lastChild.textContent = secCfg.label;
  });
}

function syncMobileNavActive(pageId, section) {
  const mobileNav = document.getElementById('mobile-nav');
  if (!mobileNav) return;

  mobileNav.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

  const pageBtn = mobileNav.querySelector(`.mobile-nav-btn[data-page="${pageId}"]`);
  if (pageBtn && (section === 'home' || pageId === 'dashboard' || pageId === 'log' || pageId === 'sessions')) {
    pageBtn.classList.add('active');
    return;
  }

  if (section === 'review' || section === 'squad') {
    mobileNav.querySelector(`.mobile-nav-btn[data-section="${section}"]`)?.classList.add('active');
  }
}

export function wireNavigation({ onNavigate, getActivePage }) {
  const main = document.getElementById('main-nav');
  const reviewSub = document.getElementById('review-sub-nav');

  main?.addEventListener('click', e => {
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn) {
      onNavigate(pageBtn.dataset.page, getSectionForPage(pageBtn.dataset.page));
      return;
    }
    const sectionBtn = e.target.closest('[data-section]');
    if (sectionBtn) {
      const section = sectionBtn.dataset.section;
      const cfg = getNavSections(state.activeGame)[section];
      if (!cfg?.defaultPage) return;
      onNavigate(cfg.defaultPage, section);
    }
  });

  reviewSub?.addEventListener('click', e => {
    const pill = e.target.closest('[data-page]');
    if (!pill) return;
    onNavigate(pill.dataset.page, 'review');
  });

  document.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const cfg = getNavSections(state.activeGame)[section];
      if (!cfg?.defaultPage) return;
      onNavigate(cfg.defaultPage, section);
    });
  });

  document.querySelectorAll('.mobile-nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      onNavigate(btn.dataset.page, getSectionForPage(btn.dataset.page));
    });
  });

  document.getElementById('top-profile-btn')?.addEventListener('click', () => {
    onNavigate('profile', 'home');
  });

  updateNavUI(getActivePage());
}

export function mountDock() {
  const dock = document.getElementById('quick-dock');
  const footer = document.getElementById('dock-footer-slot');
  if (!dock || !footer) return;
  footer.appendChild(dock);
  document.body.classList.remove('dock-in-home');
}

export function updateNavUI(pageId, gameId = state.activeGame) {
  const section = getSectionForPage(pageId, gameId);
  const allSections = getNavSections(gameId);

  renderMainNav(pageId, gameId);
  renderReviewSubNav(pageId, gameId);

  document.getElementById('top-profile-btn')?.classList.toggle('active', pageId === 'profile');

  syncMobileNavLabels(allSections);
  syncMobileNavActive(pageId, section);

  document.body.dataset.section = section;
  document.body.dataset.page = pageId;
}

/** 3-section navigation: Home/Ops · Review/Intel · Squad */

import { getNavSections } from './games.js';
import { state } from './state.js';

const TOP_BAR_PAGE_IDS = new Set(['profile']);

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

export function wireNavigation({ onNavigate, getActivePage }) {
  const primary = document.getElementById('primary-nav');
  const sub = document.getElementById('sub-nav');

  primary?.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      const cfg = getNavSections(state.activeGame)[section];
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
      onNavigate(getNavSections(state.activeGame)[section].defaultPage, section);
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

  return () => updateNavUI(getActivePage());
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
  const sub = document.getElementById('sub-nav');
  const cfg = getNavSections(gameId)[section];
  const allSections = getNavSections(gameId);

  document.querySelectorAll('.section-tab').forEach(btn => {
    const key = btn.dataset.section;
    btn.classList.toggle('active', key === section);
    const secCfg = allSections[key];
    if (secCfg) {
      btn.textContent = secCfg.label;
    }
  });

  if (sub && cfg) {
    sub.innerHTML = cfg.pages
      .filter(p => !TOP_BAR_PAGE_IDS.has(p.id))
      .map(p => `
      <button type="button" class="sub-nav-pill${p.id === pageId ? ' active' : ''}" data-page="${p.id}">${p.label}</button>
    `).join('');
  }

  document.getElementById('top-profile-btn')?.classList.toggle('active', pageId === 'profile');

  const mobileNav = document.getElementById('mobile-nav');
  mobileNav?.querySelectorAll('.mobile-nav-btn[data-section]').forEach(btn => {
    const key = btn.dataset.section;
    btn.classList.toggle('active', key === section);
    const secCfg = allSections[key];
    if (secCfg) {
      const label = btn.querySelector('span:last-child') || btn;
      if (btn.childNodes.length >= 2) {
        btn.lastChild.textContent = secCfg.label;
      }
    }
  });

  const logBtn = mobileNav?.querySelector('.mobile-nav-btn[data-page="log"]');
  if (logBtn) {
    const logPage = allSections.home?.pages.find(p => p.id === 'log');
    if (logPage && logBtn.lastChild) logBtn.lastChild.textContent = logPage.label;
  }
  const focusBtn = mobileNav?.querySelector('.mobile-nav-btn[data-page="focus"]');
  if (focusBtn) {
    const focusPage = allSections.home?.pages.find(p => p.id === 'focus');
    if (focusPage && focusBtn.lastChild) focusBtn.lastChild.textContent = focusPage.label;
  }

  document.body.dataset.section = section;
  document.body.dataset.page = pageId;
}

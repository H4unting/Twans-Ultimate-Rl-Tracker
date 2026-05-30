/** Groups page — Phase 2 stub + list user's groups */

export function renderGroupsPage(groups) {
  const el = document.getElementById('group-content');
  if (!el) return;

  const listHTML = groups?.length ? groups.map(g => `
    <div class="group-card">
      <h3>${g.name}</h3>
      <div class="coach-sub">Code: <strong>${g.invite_code}</strong> · Role: ${g.role}</div>
    </div>`).join('') : '';

  el.innerHTML = `
    <div class="group-hero">
      <h2>Grind Squads</h2>
      <p class="page-desc">Team up with a duo partner or invite a coach to track progress together. Full group features arrive in the next update.</p>
    </div>
    ${listHTML || '<div class="empty">You are not in any groups yet.</div>'}
    <div class="group-coming-soon">
      <p><strong>Coming soon:</strong> Create a squad, share an invite code, and let your coach see your stats.</p>
    </div>`;
}

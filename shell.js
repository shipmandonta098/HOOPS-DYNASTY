'use strict';

/**
 * shell.js — the sidebar navigation, shared by every in-career screen.
 *
 * The nav list lives here ONCE. Screens that exist get a real link; the rest
 * render disabled rather than as dead "#" anchors that look clickable and
 * aren't. When you build a screen, give it an `href` below and it lights up
 * everywhere at the same time.
 */

/** id -> the screen's file. Anything without one is not built yet. */
export const NAV = [
  { id: 'dashboard',  label: 'Dashboard',       icon: '🏠', href: './gm-dashboard.html' },
  { id: 'roster',     label: 'Roster',          icon: '👥', href: './roster.html' },
  { id: 'staff',      label: 'Staff',           icon: '🧑‍🏫' },
  { id: 'players',    label: 'Players',         icon: '🏀' },
  { id: 'teamMgmt',   label: 'Team Management', icon: '🗂️' },
  { id: 'teamStats',  label: 'Team Stats',      icon: '📊' },
  { id: 'schedule',   label: 'Schedule',        icon: '📅', href: './schedule.html' },
  { id: 'standings',  label: 'Standings',       icon: '🏆', href: './standings.html' },
  { id: 'playoffs',   label: 'Playoffs',        icon: '🏅' },
  { id: 'finances',   label: 'Finances',        icon: '💰' },
  { id: 'draft',      label: 'Draft',           icon: '🎯' },
  { id: 'scouting',   label: 'Scouting',        icon: '🔍' },
  { id: 'training',   label: 'Training',        icon: '🏋️' },
  { id: 'gmOffice',   label: 'GM Office',       icon: '🏢' },
  { id: 'history',    label: 'History',         icon: '📜' },
  { id: 'sep' },
  { id: 'messages',   label: 'Messages',        icon: '✉️' },
  { id: 'tasks',      label: 'Tasks',           icon: '✅' },
  { id: 'settings',   label: 'Settings',        icon: '⚙️' },
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Fill `<nav class="nav">` with the list above.
 * @param {string} activeId   the NAV id of the screen being viewed
 * @param {string|null} leagueId  carried through on every link as ?id=
 */
export function mountNav(activeId, leagueId) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const q = leagueId ? '?id=' + encodeURIComponent(leagueId) : '';

  nav.innerHTML = NAV.map((item) => {
    if (item.id === 'sep') return '<div class="sep"></div>';
    const active = item.id === activeId;
    const built = Boolean(item.href);
    // The current screen is not a link to itself; unbuilt screens are inert.
    const cls = [active ? 'active' : '', built ? '' : 'is-todo'].filter(Boolean).join(' ');
    const attrs = built && !active
      ? `href="${item.href}${q}"`
      : 'href="#" aria-disabled="true"' + (built ? '' : ' title="Not built yet"');
    return `<a class="${cls}" ${attrs} data-nav="${esc(item.label)}">` +
           `<span class="ic">${item.icon}</span>${esc(item.label)}</a>`;
  }).join('');

  // Swallow clicks on anything that isn't a real destination.
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && a.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });
}

/** Resolve which save to show: ?id=, then the last one opened, then newest. */
export async function activeLeagueId(listSavesDetailed) {
  const q = new URLSearchParams(location.search).get('id');
  if (q) return q;
  try { const s = localStorage.getItem('activeLeagueId'); if (s) return s; } catch (_) {}
  const list = await listSavesDetailed();
  return list.length ? list[0].id : null;
}

/**
 * Mark the career as played, now. Every in-career screen calls this on boot:
 * having the career open IS playing it, and without this "last played" only
 * moved when a roster move happened to write the save.
 *
 * Fire-and-forget — a failure here must never stop a screen rendering.
 */
export function markPlayed(touchLastPlayed, id) {
  if (!id) return;
  Promise.resolve()
    .then(() => touchLastPlayed(id))
    .catch((err) => console.warn('Could not record last-played time:', err));
}

/** Shared "you have no career loaded" screen. */
export function renderNoCareer() {
  const main = document.querySelector('.main');
  if (!main) return;
  main.innerHTML = `
    <div class="no-career">
      <h1>No active career</h1>
      <p>Start one from <a href="./new-career.html">New Career</a>,
         or pick one from <a href="./load-career.html">Load Career</a>.</p>
    </div>`;
}

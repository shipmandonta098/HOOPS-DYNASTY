'use strict';

/**
 * standings.js — the table, computed from games that were actually played.
 *
 * EVERY COLUMN HERE IS A RESULT, and this league has not played any yet.
 *
 * That is the whole design constraint. Win-loss, win percentage, games behind,
 * conference record, home and away splits, last ten and streak are all facts
 * about games that have been simulated. Nothing in this file invents one. In a
 * save where nothing has been played, every one of those columns is a dash and
 * the table says so — which is the same rule the Schedule screen follows, and
 * for the same reason: 0-0 is a claim that a team has played and not won.
 *
 * What IS real before a ball is bounced is the league's SHAPE: which teams
 * exist, which conference and division each is in, how many make the playoffs.
 * That is what the page shows until the simulator fills the rest in, and every
 * column fills itself the moment a score is written back.
 *
 * A note on ordering. With no games played there is no standing, so teams are
 * listed alphabetically rather than in an order that would imply a ranking
 * nobody has earned. Once games exist the sort is the real one.
 */

import { resolveTeams } from './scheduleRules.js';

/** Seeds that clinch outright, and how many beyond them play in, by default. */
export const PLAYOFF_DEFAULTS = { berths: 6, playIn: 4 };

/**
 * How far a team is behind the leader, in games.
 *
 * The standard formula: half the sum of the win gap and the loss gap, so a team
 * two wins and two losses back is two games behind rather than four.
 */
const gamesBehind = (leader, row) =>
  ((leader.wins - row.wins) + (row.losses - leader.losses)) / 2;

/**
 * Every team's record, computed in one pass over the played games.
 *
 * @param {object} league
 * @returns {Map} teamId -> record
 */
export function computeRecords(league) {
  const teams = resolveTeams(league.teams, league.structure);
  const confOf = new Map(teams.map((t) => [t.id, t.conference]));
  const rows = new Map();
  for (const t of teams) {
    rows.set(t.id, {
      id: t.id, wins: 0, losses: 0, played: 0,
      homeW: 0, homeL: 0, awayW: 0, awayL: 0, confW: 0, confL: 0, divW: 0, divL: 0,
      // Kept in date order so streak and last-ten read off the end of the season
      // rather than off whatever order the fixture list happens to be in.
      form: [],
    });
  }

  const played = (((league.schedule || {}).games) || [])
    .filter((g) => g.played && g.homeScore != null && g.awayScore != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const divOf = new Map(teams.map((t) => [t.id, t.division]));
  for (const g of played) {
    const h = rows.get(g.home), a = rows.get(g.away);
    if (!h || !a) continue;                       // a game against a team that left
    const homeWon = g.homeScore > g.awayScore;
    const sameConf = confOf.get(g.home) && confOf.get(g.home) === confOf.get(g.away);
    const sameDiv = divOf.get(g.home) && divOf.get(g.home) === divOf.get(g.away);

    for (const [row, won, atHome] of [[h, homeWon, true], [a, !homeWon, false]]) {
      row.played++;
      if (won) row.wins++; else row.losses++;
      if (atHome) { if (won) row.homeW++; else row.homeL++; }
      else if (won) row.awayW++; else row.awayL++;
      if (sameConf) { if (won) row.confW++; else row.confL++; }
      if (sameDiv) { if (won) row.divW++; else row.divL++; }
      row.form.push(won ? 'W' : 'L');
    }
  }

  for (const row of rows.values()) {
    // Nulls rather than zeros wherever nothing has happened: "no games yet" and
    // "played and lost" are different statements and must not print the same.
    row.pct = row.played ? row.wins / row.played : null;
    row.home = row.played ? `${row.homeW}-${row.homeL}` : null;
    row.away = row.played ? `${row.awayW}-${row.awayL}` : null;
    row.conf = row.played ? `${row.confW}-${row.confL}` : null;
    row.div = row.played ? `${row.divW}-${row.divL}` : null;
    const last = row.form.slice(-10);
    row.last10 = last.length
      ? `${last.filter((x) => x === 'W').length}-${last.filter((x) => x === 'L').length}` : null;
    if (row.form.length) {
      const kind = row.form[row.form.length - 1];
      let n = 0;
      for (let i = row.form.length - 1; i >= 0 && row.form[i] === kind; i--) n++;
      row.streak = `${kind}${n}`;
      row.streakKind = kind;
    } else {
      row.streak = null;
      row.streakKind = null;
    }
  }
  return rows;
}

/**
 * The tiebreak order.
 *
 * Win percentage first, then head-to-head is the real rule — but head-to-head
 * needs games to have been played, so this uses the ordinary fallbacks
 * (conference record, then division record, then more wins) and finally the
 * team name so that two teams with identical everything still sort stably
 * rather than swapping places on every render.
 */
function compare(a, b) {
  const pa = a.pct == null ? -1 : a.pct;
  const pb = b.pct == null ? -1 : b.pct;
  if (pb !== pa) return pb - pa;
  if (b.confW - b.confL !== a.confW - a.confL) return (b.confW - b.confL) - (a.confW - a.confL);
  if (b.divW - b.divL !== a.divW - a.divL) return (b.divW - b.divL) - (a.divW - a.divL);
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0;
}

/**
 * The playoff cut lines for a group of a given size.
 *
 * Derived from settings and then CLAMPED TO THE GROUP, because a league with
 * six teams in a conference cannot send eight of them to the playoffs. Nothing
 * here assumes fifteen teams a side.
 */
export function cutLines(settings, size) {
  const s = settings || {};
  const berths = Math.max(0, Math.min(size,
    s.playoffBerths != null ? Number(s.playoffBerths) : PLAYOFF_DEFAULTS.berths));
  const playIn = Math.max(0, Math.min(size - berths,
    s.playInSlots != null ? Number(s.playInSlots) : PLAYOFF_DEFAULTS.playIn));
  return { berths, playIn, out: size - berths - playIn };
}

/** A seed's status, for the colour rail down the left of the table. */
export function seedStatus(seed, lines) {
  if (seed <= lines.berths) return 'berth';
  if (seed <= lines.berths + lines.playIn) return 'playin';
  return 'out';
}

/**
 * The standings, grouped the way the chosen scope asks for.
 *
 * @param {object} league
 * @param {string} scope  'league' | 'conference' | 'division'
 * @returns {{ groups, played, teams }} `played` is how many games the league
 *   has actually simulated — zero means every record column is a dash, and the
 *   screen says why rather than showing thirty teams tied at nothing.
 */
export function standings(league, scope = 'conference') {
  const teams = resolveTeams(league.teams, league.structure);
  const byId = new Map((league.teams || []).map((t) => [t.id, t]));
  const records = computeRecords(league);
  const structure = league.structure || {};
  const confName = new Map((structure.conferences || []).map((c) => [c.id, c.name]));
  const divName = new Map((structure.divisions || []).map((d) => [d.id, d.name]));
  const divConf = new Map((structure.divisions || []).map((d) => [d.id, d.conferenceId]));

  const rows = teams.map((t) => {
    const full = byId.get(t.id) || {};
    return {
      ...records.get(t.id),
      team: full,
      name: `${full.city || ''} ${full.name || ''}`.trim() || t.id,
      sortName: `${full.city || ''} ${full.name || ''}`.trim() || t.id,
      conference: t.conference,
      division: t.division,
    };
  });

  const played = rows.reduce((n, r) => n + r.played, 0) / 2;

  // PLAYOFF STATUS IS A PROPERTY OF THE CONFERENCE, not of whichever grouping
  // happens to be on screen. Teams qualify out of their conference, so a club's
  // status is computed once from the conference table and then shown unchanged
  // in the division and league views.
  //
  // Deriving it per group instead was wrong in a way that looked fine: a
  // five-team division clamps six berths down to five, so every club in every
  // division came out marked as qualifying. A league with no conferences falls
  // back to seeding the whole league, which is the only grouping it has.
  const confIds = [...new Set(rows.map((r) => r.conference).filter(Boolean))];
  const qualifyIn = confIds.length
    ? confIds.map((id) => rows.filter((r) => r.conference === id))
    : [rows];
  const statusOf = new Map();
  // WITH NOTHING PLAYED THERE IS NO PLAYOFF PICTURE, so none is drawn. The
  // seeding would come from the alphabetical fallback order, which would put a
  // green "playoff berth" beside whichever club happens to start with an A —
  // a projection dressed as a standing, and exactly the kind of thing the rest
  // of this screen refuses to print.
  if (played) {
    for (const pool of qualifyIn) {
      const lines = cutLines(league.settings, pool.length);
      [...pool].sort(compare).forEach((r, i) => {
        statusOf.set(r.id, seedStatus(i + 1, lines));
      });
    }
  }

  /** One group of teams, sorted and seeded. */
  const group = (label, sub, list, qualifying) => {
    const sorted = [...list].sort(compare);
    const leader = sorted[0];
    return {
      label, sub,
      // The cut lines are only DRAWN where the grouping is the one teams
      // actually qualify out of. A dashed rule under sixth place in a five-team
      // division would be marking a boundary that does not exist.
      lines: qualifying && played ? cutLines(league.settings, sorted.length) : null,
      rows: sorted.map((r, i) => ({
        ...r,
        seed: i + 1,
        // Games behind is a comparison between two records. With no games
        // played there is nothing to compare, so it is null rather than zero.
        gb: !played ? null : (r === leader ? 0 : gamesBehind(leader, r)),
        status: statusOf.get(r.id) || null,
      })),
    };
  };

  if (scope === 'division') {
    const ids = [...new Set(rows.map((r) => r.division).filter(Boolean))]
      .sort((a, b) => String(divName.get(a) || a).localeCompare(String(divName.get(b) || b)));
    const groups = ids.map((id) => group(
      divName.get(id) || id,
      confName.get(divConf.get(id)) || null,
      rows.filter((r) => r.division === id), false,
    ));
    const rest = rows.filter((r) => !r.division);
    if (rest.length) groups.push(group('Unassigned', null, rest, false));
    // A league with no divisions has nothing to group by, so it falls back
    // rather than showing one heading called "Unassigned".
    return { scope, groups: groups.length ? groups : [group('League', null, rows, !confIds.length)],
      played, teams: rows.length };
  }

  if (scope === 'conference') {
    const ids = [...new Set(rows.map((r) => r.conference).filter(Boolean))]
      .sort((a, b) => String(confName.get(a) || a).localeCompare(String(confName.get(b) || b)));
    const groups = ids.map((id) => group(
      confName.get(id) || id, null, rows.filter((r) => r.conference === id), true,
    ));
    const rest = rows.filter((r) => !r.conference);
    if (rest.length) groups.push(group('Unassigned', null, rest, false));
    return { scope, groups: groups.length ? groups : [group('League', null, rows, true)],
      played, teams: rows.length };
  }

  return { scope, groups: [group('League', null, rows, !confIds.length)], played, teams: rows.length };
}

/** `.750`, the way a win percentage is written — no leading zero. */
export function formatPct(pct) {
  if (pct == null) return null;
  return pct.toFixed(3).replace(/^0/, '');
}

/** `—` for the leader, `3.0` for everyone else. */
export function formatGB(gb) {
  if (gb == null) return null;
  return gb === 0 ? '—' : gb.toFixed(1);
}

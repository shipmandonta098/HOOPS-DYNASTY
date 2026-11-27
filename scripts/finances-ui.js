/* ==========================================================================
   HOOPS DYNASTY — Finances section (player profile)
   Salaries, Current Contract (with a year-by-year table), and Contract
   History, in the Basketball-Reference organisation. Every number comes
   from the contract store (scripts/contracts.js). Styles: styles/finances.css
   (tables reuse styles/career-stats.css).

   Option colors are one system (OPTION_KINDS + --opt-* theme tokens): the
   color is never the only signal — each cell also carries the abbreviation,
   and a title / accessible label spells it out.
   ========================================================================== */
(function () {
  'use strict';

  var dom = window.HDDom;
  var el = dom.el;
  function K() { return window.HDContracts; }
  function Rules() { return window.HDContractRules; }
  function S() { return window.HDSeason; }

  var DASH = '—';
  function usd(v) { return typeof v === 'number' && isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : DASH; }
  function dateLabel(iso) { return iso ? S().formatDate(iso, 'medium') : DASH; }
  function seasonLabel(y) { return S().label(y); }

  // Centralized option / guarantee designations
  var OPTION_KINDS = {
    PO: { cls: 'is-po', label: 'Player Option', desc: 'The player decides whether this season is played under the contract.' },
    TO: { cls: 'is-to', label: 'Team Option', desc: 'The team decides whether to keep this season.' },
    NG: { cls: 'is-ng', label: 'Non-Guaranteed', desc: 'No salary is guaranteed until the guarantee date.' },
    PG: { cls: 'is-pg', label: 'Partially Guaranteed', desc: 'Only part of the salary is guaranteed until the guarantee date.' },
    EXT: { cls: 'is-ext', label: 'Extension', desc: 'Season added by a contract extension.' }
  };

  function tagsFor(y) {
    var tags = [];
    if (y.option === 'player') tags.push('PO');
    if (y.option === 'team') tags.push('TO');
    if (y.guarantee === 'none') tags.push('NG');
    if (y.guarantee === 'partial') tags.push('PG');
    if (y.extension) tags.push('EXT');
    return tags;
  }

  function optionStatusText(y) {
    if (!y.option) return '';
    if (y.optionStatus === 'exercised') return 'exercised' + (y.decidedBeforeDynasty ? ' (before the league began)' : '');
    if (y.optionStatus === 'declined') return 'declined';
    return 'decision due ' + dateLabel(y.optionDeadline);
  }

  function tag(code, y) {
    var k = OPTION_KINDS[code];
    var extra = code === 'PO' || code === 'TO' ? ' — ' + optionStatusText(y)
      : (code === 'NG' || code === 'PG') && y.guaranteeDate ? ' — becomes fully guaranteed ' + dateLabel(y.guaranteeDate) : '';
    return el('abbr', { class: 'fin-tag ' + k.cls + (y.optionStatus === 'declined' ? ' is-declined' : ''), title: k.label + extra + '. ' + k.desc, text: code });
  }

  function legend() {
    return el('ul', { class: 'fin-legend', 'aria-label': 'Contract designations' }, Object.keys(OPTION_KINDS).map(function (code) {
      return el('li', null, [el('abbr', { class: 'fin-tag ' + OPTION_KINDS[code].cls, title: OPTION_KINDS[code].desc, text: code }), el('span', { text: OPTION_KINDS[code].label })]);
    }).concat([el('li', null, [el('span', { class: 'fin-legend-current', 'aria-hidden': 'true' }), el('span', { text: 'Current season' })])]));
  }

  function leagueAbbr(save) {
    var words = String(save.league.name || '').split(/\s+/).filter(Boolean);
    var a = words.map(function (w) { return w.charAt(0); }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (a || 'LG').slice(0, 4);
  }

  function block(id, title, children) {
    return el('div', { class: 'cs-block fin-block' }, [el('h4', { class: 'cs-title', id: id, text: title })].concat(children));
  }
  function wrap(label, table) { return el('div', { class: 'cs-wrap', tabindex: '0', role: 'region', 'aria-label': label + ' (scrolls sideways)' }, [table]); }
  function th(text, cls, title) { return el('th', { scope: 'col', class: cls || '', title: title || null, text: text }); }

  /* --- Salaries ------------------------------------------------------------ */

  function salaries(save, player, ids) {
    var data = K().salaryRows(save, player.id);
    var lg = leagueAbbr(save);
    var body = el('tbody');
    // Newest season first; a traded season keeps its combined row above its splits
    var rows = data.rows.map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) { return b.r.seasonYear - a.r.seasonYear || a.i - b.i; }).map(function (x) { return x.r; });
    rows.forEach(function (r) {
      var team = r.combined ? r.teams + ' Teams' : (r.teamName || DASH);
      body.appendChild(el('tr', { class: (r.split ? 'is-split' : '') + (r.combined ? ' is-combined' : '') + (r.inProgress ? ' is-current' : '') }, [
        el('th', { scope: 'row', class: 'is-text', text: seasonLabel(r.seasonYear) }),
        el('td', { class: 'is-text', text: r.split ? '↳ ' + team : team }),
        el('td', { class: 'is-text', text: lg }),
        el('td', { text: r.split ? '' : usd(r.salary) }),
        el('td', { text: r.split ? '' : usd(r.capHit) }),
        el('td', null, [el('span', { text: usd(r.earned) }), r.inProgress && !r.split ? el('span', { class: 'fin-note-inline', text: ' to date' }) : null])
      ]));
    });
    var table = el('table', { class: 'cs-table fin-table' }, [
      el('caption', { class: 'hd-visually-hidden', text: 'Salaries by season' }),
      el('thead', null, [el('tr', null, [th('Season', 'is-text'), th('Team', 'is-text'), th('Lg', 'is-text', 'League'),
        th('Salary', '', 'Contracted salary for the season'), th('Cap Hit', '', 'Charge against the team’s salary cap'), th('Earned', '', 'Salary actually paid (processed paychecks)')])]),
      body,
      el('tfoot', null, [el('tr', { class: 'is-career' }, [
        el('th', { scope: 'row', class: 'is-text', text: 'Career' }),
        el('td', { class: 'is-text', text: 'Earned' }), el('td'), el('td'), el('td'),
        el('td', { text: usd(data.career) })
      ])])
    ]);
    return block(ids.salaries, 'Salaries', [
      data.rows.length ? wrap('Salaries', table) : el('p', { class: 'cs-empty', text: 'No salary on record.' }),
      el('p', { class: 'cs-legend', text: 'Earned counts only paychecks actually processed in the league. Projected salary, future seasons and unexercised options are never included in career earnings.' }),
      data.incomplete ? el('p', { class: 'cs-note', text: 'Career earnings may be incomplete due to unavailable historical salary records.' }) : null
    ]);
  }

  /* --- Current contract ---------------------------------------------------- */

  function yearTable(save, c) {
    var season = save.calendar.seasonYear;
    var years = c.years;
    var team = save.teams.filter(function (t) { return t.id === c.teamId; })[0];
    function cell(y, value, opts) {
      opts = opts || {};
      var declined = y.optionStatus === 'declined';
      var cls = (y.seasonYear === season ? 'is-current ' : '') + (y.seasonYear < season ? 'is-past ' : '') + (y.extension ? 'is-ext-year ' : '') + (declined ? 'is-declined ' : '');
      return el('td', { class: cls }, [
        el('span', { class: 'fin-amt', text: declined && !opts.showDeclined ? DASH : usd(value) }),
        opts.tags ? el('span', { class: 'fin-tags' }, tagsFor(y).map(function (code) { return tag(code, y); })) : null,
        opts.tags && declined ? el('span', { class: 'fin-declined', text: 'Declined' }) : null
      ]);
    }
    var head = el('tr', null, [th('Team', 'is-text fin-sticky')].concat(years.map(function (y) {
      return el('th', { scope: 'col', class: (y.seasonYear === season ? 'is-current' : '') + (y.extension ? ' is-ext-year' : ''),
        'aria-current': y.seasonYear === season ? 'true' : null, text: seasonLabel(y.seasonYear) });
    })));
    var rows = [
      el('tr', null, [el('th', { scope: 'row', class: 'is-text fin-sticky' }, [team ? el('img', { src: team.logo, alt: '', width: 16, height: 16 }) : null, el('span', { text: team ? team.fullName : DASH })])]
        .concat(years.map(function (y) { return cell(y, y.salary, { tags: true, showDeclined: true }); }))),
      el('tr', { class: 'fin-sub' }, [el('th', { scope: 'row', class: 'is-text fin-sticky', text: 'Cap hit' })].concat(years.map(function (y) { return cell(y, y.capHit); }))),
      el('tr', { class: 'fin-sub' }, [el('th', { scope: 'row', class: 'is-text fin-sticky', text: 'Guaranteed' })].concat(years.map(function (y) { return cell(y, K().guaranteedFor(y)); })))
    ];
    return wrap('Contract by season', el('table', { class: 'cs-table fin-table fin-years' }, [
      el('caption', { class: 'hd-visually-hidden', text: 'Contract by season' }), el('thead', null, [head]), el('tbody', null, rows)
    ]));
  }

  function clauses(save, c) {
    var items = [];
    c.years.forEach(function (y) {
      if (y.option) items.push((y.option === 'team' ? 'Team' : 'Player') + ' option, ' + seasonLabel(y.seasonYear) + ' (' + usd(y.salary) + '): ' + optionStatusText(y) + '.');
      if (y.guarantee !== 'full' && y.guaranteeDate) items.push(seasonLabel(y.seasonYear) + ': ' + (y.guarantee === 'partial' ? usd(y.guaranteedAmount) + ' guaranteed' : 'non-guaranteed') + ' until ' + dateLabel(y.guaranteeDate) + ', then fully guaranteed if still on the roster.');
    });
    if (c.clauses.tradeBonusPct) items.push('Trade bonus: ' + c.clauses.tradeBonusPct + '% of the remaining guaranteed salary, paid by the trading team.');
    if (c.clauses.noTrade) items.push('No-trade clause.');
    if (c.clauses.signingBonus) items.push('Signing bonus: ' + usd(c.clauses.signingBonus) + '.');
    (c.clauses.incentives || []).forEach(function (i) { items.push('Incentive: ' + i.text); });
    return el('div', { class: 'fin-clauses' }, [
      el('h5', { class: 'fin-subtitle', text: 'Clauses & Deadlines' }),
      items.length ? el('ul', null, items.map(function (t) { return el('li', { text: t }); })) : el('p', { class: 'cs-legend', text: 'No options, guarantees or special clauses.' })
    ]);
  }

  function current(save, player, ids) {
    var c = K().activeContract(save, player.id);
    var status = K().playerStatus(save, player.id);
    if (!c) {
      var text = { 'UFA': 'Unrestricted free agent.', 'RFA': 'Restricted free agent.', 'unsigned-rookie': 'Unsigned rookie.', 'retired': 'Retired.' }[status] || 'Not under contract.';
      return block(ids.current, 'Current Contract', [el('p', { class: 'cs-empty', text: text })]);
    }
    var season = save.calendar.seasonYear;
    var y = K().yearFor(c, season);
    var fa = K().freeAgency(c);
    var team = save.teams.filter(function (t) { return t.id === c.teamId; })[0];
    var original = c.years.filter(function (x) { return !x.extension; }).length;
    var type = Rules().TYPES[c.type];
    var faText = fa.year + ' · ' + (fa.status === 'RFA' ? 'Restricted (RFA)' : 'Unrestricted (UFA)');
    var rows = [
      ['Franchise', (team ? team.fullName : DASH) + (c.signingTeamId !== c.teamId ? ' (signed with the ' + c.signingTeamName + ')' : '')],
      ['Contract type', type ? type.label : c.type],
      ['Signed', dateLabel(c.signedDate) + (c.preDynasty ? ' · on file when the league began' : '')],
      ['Original length', original + (original === 1 ? ' season' : ' seasons') + (c.extensions.length ? ' + ' + (c.years.length - original) + '-season extension' : '')],
      ['Total value', usd(K().totalValue(c)) + (c.years.some(function (x) { return x.option && x.optionStatus === 'pending'; }) ? ' (incl. option seasons)' : '')],
      ['Guaranteed', usd(K().guaranteedValue(c))],
      ['Remaining guaranteed', usd(K().remainingGuaranteed(c, season))],
      ['Salary ' + seasonLabel(season), y ? usd(y.salary) : DASH],
      ['Cap hit ' + seasonLabel(season), y ? usd(y.capHit) : DASH],
      ['Average annual value', usd(K().aav(c))],
      ['Expires', 'After ' + seasonLabel(c.endSeason)],
      ['Seasons remaining', String(K().yearsRemaining(c, season)) + ' (incl. ' + seasonLabel(season) + ')'],
      ['Free agency', faText]
    ];
    fa.conditional.forEach(function (o) {
      rows.push(['If declined', 'Free agent in ' + o.year + ' if the ' + seasonLabel(o.seasonYear) + ' ' + o.option + ' option is declined (decision by ' + dateLabel(o.deadline) + ')']);
    });
    return block(ids.current, 'Current Contract', [
      el('dl', { class: 'fin-summary' }, rows.map(function (r) { return el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]); })),
      yearTable(save, c),
      legend(),
      clauses(save, c)
    ]);
  }

  /* --- History ------------------------------------------------------------- */

  // Contract History = the financial records of the league's transaction
  // log (scripts/transactions.js): the same records as Transactions.
  function TX() { return window.HDTransactions; }
  function txTeam(tx, pid) {
    if (tx.type === 'trade' && tx.assets) {
      var mine = tx.assets.filter(function (a) { return a.kind === 'player' && a.playerId === pid; })[0];
      if (mine) return tx.teamNames[mine.to];
    }
    var id = tx.toTeamIds[0] || tx.fromTeamIds[0];
    return id ? tx.teamNames[id] : null;
  }
  function txAmount(tx) {
    var m = tx.money;
    if (!m) return null;
    return [m.total, m.amount, m.salary, m.remainingGuaranteed].filter(function (v) { return typeof v === 'number'; })[0];
  }

  function historyBlock(save, player, ids) {
    var list = K().history(save, player.id);
    var body = el('tbody', null, list.map(function (t) {
      var amt = txAmount(t);
      return el('tr', null, [
        el('th', { scope: 'row', class: 'is-text', text: t.date ? dateLabel(t.date) : 'Date not recorded' }),
        el('td', { class: 'is-text', text: txTeam(t, player.id) || DASH }),
        el('td', { class: 'is-text', text: TX().TYPES[t.type].label }),
        el('td', { class: 'is-text fin-details', text: TX().textOf(TX().describe(save, t, player.id)).replace(/\.$/, t.preDynasty && t.type !== 'acquired' ? ' (on file when the league began).' : '.') }),
        el('td', { text: amt == null ? DASH : usd(amt) })
      ]);
    }));
    return block(ids.history, 'Contract History', [
      list.length ? wrap('Contract history', el('table', { class: 'cs-table fin-table fin-history' }, [
        el('caption', { class: 'hd-visually-hidden', text: 'Contract history, most recent first' }),
        el('thead', null, [el('tr', null, [th('Date', 'is-text'), th('Team', 'is-text'), th('Transaction', 'is-text'), th('Details', 'is-text'), th('Amount')])]),
        body
      ])) : el('p', { class: 'cs-empty', text: 'No contract transactions on record.' })
    ]);
  }

  /* --- Section ------------------------------------------------------------- */

  var STATUS = { 'under-contract': 'Under Contract', 'UFA': 'Unrestricted Free Agent', 'RFA': 'Restricted Free Agent', 'unsigned-rookie': 'Unsigned Rookie', 'retired': 'Retired' };

  function section(ctx) {
    var save = ctx.save, player = ctx.player;
    if (!save.contracts || !K()) return null;
    var ids = { salaries: 'fin-salaries', current: 'fin-current', history: 'fin-history' };
    var status = K().playerStatus(save, player.id);
    var root = el('section', { class: 'pp-section pp-finances', 'aria-labelledby': 'pp-finances-title' }, [
      el('div', { class: 'cs-head' }, [
        el('h3', { class: 'hd-eyebrow pp-section-title', id: 'pp-finances-title', text: 'Finances' }),
        el('span', { class: 'fin-status is-' + status.toLowerCase(), text: STATUS[status] })
      ]),
      el('nav', { class: 'cs-nav', 'aria-label': 'Finances tables' }, [['salaries', 'Salaries'], ['current', 'Current Contract'], ['history', 'Contract History']].map(function (n) {
        return el('a', { href: '#' + ids[n[0]], 'data-fin-jump': ids[n[0]], text: n[1] });
      }).concat(window.HDTransactionsUI && save.transactions ? [el('a', { href: '#pp-tx-title', 'data-fin-jump': 'pp-tx-title', 'data-fin-outside': '', text: 'Transactions' })] : [])),
      salaries(save, player, ids),
      current(save, player, ids),
      historyBlock(save, player, ids)
    ]);
    root.addEventListener('click', function (e) {
      var jump = e.target.closest('[data-fin-jump]');
      if (!jump) return;
      e.preventDefault();
      var id = jump.getAttribute('data-fin-jump');
      var h = root.querySelector('#' + id) || (root.parentNode && root.parentNode.querySelector('#' + id));
      if (h) { h.setAttribute('tabindex', '-1'); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); h.focus({ preventScroll: true }); }
    });
    return root;
  }

  window.HDFinancesUI = { section: section, OPTION_KINDS: OPTION_KINDS, tagsFor: tagsFor };
})();

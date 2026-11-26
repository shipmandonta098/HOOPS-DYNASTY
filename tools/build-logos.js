#!/usr/bin/env node
/* ==========================================================================
   Generates assets/logos/<franchise id>.svg from data/franchises.js.

   Each logo = a badge shape (logo.badge) filled with the primary color and
   trimmed in the tertiary color, plus an original emblem (logo.emblem) drawn
   mostly in the secondary color with tertiary accents.

   Usage:  node tools/build-logos.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { FRANCHISES, EXPANSION } = require('../data/franchises.js');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'logos');

/* --- Badges (120 x 120 canvas) ------------------------------------------- */
// Each returns { shape, trim, cy } — cy is the emblem's optical center.
// K is a thin outer keyline (secondary color) so dark badges stay visible on
// dark backgrounds.
const BADGES = {
  roundel: (P, T, K) => ({
    shape: `<circle cx="60" cy="60" r="57" fill="${P}" stroke="${K}" stroke-width="2.5"/>`,
    trim: `<circle cx="60" cy="60" r="50" fill="none" stroke="${T}" stroke-width="3"/>`,
    cy: 60
  }),
  shield: (P, T, K) => ({
    shape: `<path d="M60 4 108 18v38c0 30-20 50-48 61C32 106 12 86 12 56V18Z" fill="${P}" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>`,
    trim: `<path d="M60 12 100 24v32c0 25-17 42-40 52C37 98 20 81 20 56V24Z" fill="none" stroke="${T}" stroke-width="3" stroke-linejoin="round"/>`,
    cy: 57
  }),
  hexagon: (P, T, K) => ({
    shape: `<path d="M60 3 109.4 31.5v57L60 117 10.6 88.5v-57Z" fill="${P}" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>`,
    trim: `<path d="M60 12.5 101.2 36.3v47.4L60 107.5 18.8 83.7V36.3Z" fill="none" stroke="${T}" stroke-width="3" stroke-linejoin="round"/>`,
    cy: 60
  }),
  diamond: (P, T, K) => ({
    shape: `<rect x="19" y="19" width="82" height="82" rx="12" transform="rotate(45 60 60)" fill="${P}" stroke="${K}" stroke-width="2.5"/>`,
    trim: `<rect x="27" y="27" width="66" height="66" rx="7" transform="rotate(45 60 60)" fill="none" stroke="${T}" stroke-width="3"/>`,
    cy: 60
  })
};

/* --- Emblems (drawn around 60,60; roughly within 30..90) ---------------- */
// S = secondary (main mark), A = tertiary (accent), P = primary (cut-outs)
const EMBLEMS = {
  phoenix: (S, A) => `
    <path d="M60 88 52 70C40 66 30 55 25 36c12 10 21 14 29 16-4-10-4-20 2-30 2 12 4 20 4 26 0-6 2-14 4-26 6 10 6 20 2 30 8-2 17-6 29-16-5 19-15 30-27 34Z" fill="${S}"/>
    <path d="M60 86 52 98l8-4 8 4Z" fill="${A}"/>`,
  ship: (S, A) => `
    <rect x="58" y="26" width="4" height="50" fill="${A}"/>
    <path d="M63 32q22 15 0 40Z" fill="${S}"/>
    <path d="M57 36q-18 13 0 36Z" fill="${S}"/>
    <path d="M62 24l12 4-12 4Z" fill="${A}"/>
    <path d="M30 78h60l-8 12H38Z" fill="${S}"/>`,
  compass: (S, A, P) => `
    <circle cx="60" cy="60" r="27" fill="none" stroke="${A}" stroke-width="3"/>
    <path d="M60 24 66 54 96 60 66 66 60 96 54 66 24 60 54 54Z" fill="${S}"/>
    <path d="M60 42 64 56 78 60 64 64 60 78 56 64 42 60 56 56Z" fill="${A}" transform="rotate(45 60 60)"/>
    <circle cx="60" cy="60" r="4" fill="${P}"/>`,
  crown: (S, A) => `
    <path d="M32 78 28 42l16 15 16-23 16 23 16-15-4 36Z" fill="${S}"/>
    <rect x="32" y="81" width="56" height="8" rx="1" fill="${A}"/>
    <circle cx="28" cy="40" r="4" fill="${A}"/><circle cx="60" cy="31" r="4.5" fill="${A}"/><circle cx="92" cy="40" r="4" fill="${A}"/>`,
  gale: (S, A) => `
    <g fill="none" stroke-linecap="round" stroke-width="7">
      <path d="M26 46h44c11 0 13-15 3-17-6-1-9 4-8 7" stroke="${S}"/>
      <path d="M26 62h56c13 0 14 18 2 19-6 0-9-4-8-8" stroke="${S}"/>
      <path d="M34 77h22" stroke="${A}"/>
    </g>`,
  anvil: (S, A) => `
    <path d="M28 52h60c0 9-9 12-16 12l-4 8h8v12H44V72h8l-4-8c-11 0-18-5-20-12Z" fill="${S}"/>
    <path d="M36 52V46h44v6Z" fill="${S}"/>
    <g stroke="${A}" stroke-width="4" stroke-linecap="round"><path d="M58 38 56 26"/><path d="M68 38l6-10"/><path d="M48 39l-7-8"/></g>`,
  gear: (S, A, P) => {
    let teeth = '';
    for (let i = 0; i < 8; i++) teeth += `<rect x="55" y="27" width="10" height="12" rx="1.5" transform="rotate(${i * 45} 60 60)"/>`;
    return `
    <g fill="${S}">${teeth}<circle cx="60" cy="60" r="24"/></g>
    <circle cx="60" cy="60" r="16" fill="${P}"/>
    <path d="M63 46 52 63h8l-3 12 11-17h-8Z" fill="${A}"/>`;
  },
  chevrons: (S, A) => `
    <path d="M28 40h12l20 20-20 20H28l20-20Z" fill="${S}"/>
    <path d="M50 40h12l20 20-20 20H50l20-20Z" fill="${A}"/>
    <path d="M72 46h7l14 14-14 14h-7l14-14Z" fill="${S}" opacity=".55"/>`,
  wave: (S, A) => `
    <path d="M26 80c3-28 26-46 50-40 15 4 19 18 11 24-6 4-14-1-11-8-12-2-22 8-24 24Z" fill="${S}"/>
    <rect x="26" y="83" width="68" height="5" rx="2.5" fill="${A}"/>`,
  anchor: (S, A) => `
    <g fill="none" stroke="${S}" stroke-width="7" stroke-linecap="round">
      <circle cx="60" cy="33" r="6"/>
      <path d="M60 40v48"/>
      <path d="M33 66c3 14 14 22 27 22s24-8 27-22"/>
    </g>
    <path d="M45 50h30" stroke="${A}" stroke-width="7" stroke-linecap="round"/>
    <path d="M27 62l6 8 7-6Z M93 62l-6 8-7-6Z" fill="${S}"/>`,
  tower: (S, A) => `
    <path d="M40 32h8v7h8v-7h8v7h8v-7h8v15l-6 6v27h9v8H37v-8h9V53l-6-6Z" fill="${S}"/>
    <rect x="57" y="58" width="6" height="14" rx="3" fill="${A}"/>`,
  planet: (S, A) => `
    <circle cx="60" cy="60" r="20" fill="${S}"/>
    <ellipse cx="60" cy="60" rx="36" ry="11" fill="none" stroke="${A}" stroke-width="5" transform="rotate(-20 60 60)"/>
    <path d="M41 60a19 19 0 0 1 38-6" fill="none" stroke="${S}" stroke-width="5" transform="rotate(-20 60 60)"/>
    <circle cx="88" cy="38" r="3" fill="${A}"/>`,
  bell: (S, A) => `
    <rect x="53" y="22" width="14" height="8" rx="2" fill="${A}"/>
    <path d="M60 30c-14 0-18 12-18 26 0 12-4 18-10 24h56c-6-6-10-12-10-24 0-14-4-26-18-26Z" fill="${S}"/>
    <path d="M64 36l-4 10 5 6-4 12" fill="none" stroke="${A}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="60" cy="88" r="5" fill="${A}"/>`,
  northstar: (S, A) => `
    <path d="M60 22 66 54 98 60 66 66 60 98 54 66 22 60 54 54Z" fill="${S}"/>
    <path d="M60 44 63 57 76 60 63 63 60 76 57 63 44 60 57 57Z" fill="${A}" transform="rotate(45 60 60)"/>
    <circle cx="86" cy="34" r="3" fill="${A}"/><circle cx="34" cy="86" r="2.5" fill="${A}"/>`,
  dome: (S, A) => `
    <rect x="58.5" y="22" width="3" height="10" fill="${A}"/>
    <path d="M40 54a20 20 0 0 1 40 0Z" fill="${S}"/>
    <rect x="36" y="54" width="48" height="5" fill="${A}"/>
    <g fill="${S}"><rect x="39" y="61" width="5" height="18"/><rect x="49" y="61" width="5" height="18"/><rect x="66" y="61" width="5" height="18"/><rect x="76" y="61" width="5" height="18"/></g>
    <rect x="32" y="81" width="56" height="7" fill="${S}"/>
    <rect x="56" y="32" width="8" height="6" fill="${S}"/>`,
  horseshoe: (S, A) => `
    <path d="M38 86 34 56c-2-18 10-30 26-30s28 12 26 30l-4 30H70l3-29c1-11-5-18-13-18s-14 7-13 18l3 29Z" fill="${S}"/>
    <g fill="${A}"><circle cx="41" cy="50" r="2.6"/><circle cx="42" cy="64" r="2.6"/><circle cx="44" cy="77" r="2.6"/><circle cx="79" cy="50" r="2.6"/><circle cx="78" cy="64" r="2.6"/><circle cx="76" cy="77" r="2.6"/></g>`,
  mountains: (S, A) => `
    <path d="M22 84 48 38 62 60 72 46 98 84Z" fill="${S}"/>
    <path d="M48 38 41 50l7-3 5 5 3-4Z M72 46 67 54l5-2 4 4 2-2Z" fill="${A}"/>
    <circle cx="82" cy="32" r="6" fill="${A}"/>`,
  rocket: (S, A, P) => `
    <path d="M60 22c12 10 16 26 14 46H46c-2-20 2-36 14-46Z" fill="${S}"/>
    <circle cx="60" cy="46" r="6" fill="${P}"/>
    <path d="M46 58 36 74l10-2Z M74 58l10 16-10-2Z" fill="${A}"/>
    <path d="M50 72h20l-4 8h-12Z" fill="${S}"/>
    <path d="M54 82h12l-6 14Z" fill="${A}"/>`,
  sunset: (S, A) => `
    <path d="M36 62a24 24 0 0 1 48 0Z" fill="${A}"/>
    <g fill="none" stroke="${S}" stroke-width="5" stroke-linecap="round">
      <path d="M26 70c6-4 11-4 17 0s11 4 17 0 11-4 17 0 11 4 17 0"/>
      <path d="M32 82c6-4 11-4 17 0s11 4 17 0 11-4 17 0"/>
    </g>`,
  star: (S, A) => `
    <path d="M60 24l10.6 21.5 23.7 3.4-17.2 16.8 4.1 23.6L60 78.2 38.8 89.3l4.1-23.6-17.2-16.8 23.7-3.4Z" fill="${S}"/>
    <path d="M60 42l5 10.2 11.3 1.6-8.2 8 1.9 11.2L60 67.7l-10 5.3 1.9-11.2-8.2-8 11.3-1.6Z" fill="${A}"/>`,
  paddlewheel: (S, A) => {
    let spokes = '';
    for (let i = 0; i < 4; i++) spokes += `<rect x="58" y="33" width="4" height="54" transform="rotate(${i * 45} 60 60)"/>`;
    let paddles = '';
    for (let i = 0; i < 8; i++) paddles += `<rect x="53" y="24" width="14" height="9" rx="1.5" transform="rotate(${i * 45 + 22.5} 60 60)"/>`;
    return `
    <g fill="${A}">${paddles}</g>
    <circle cx="60" cy="60" r="25" fill="none" stroke="${S}" stroke-width="5"/>
    <g fill="${S}">${spokes}</g>
    <circle cx="60" cy="60" r="12" fill="none" stroke="${S}" stroke-width="4"/>
    <circle cx="60" cy="60" r="5" fill="${A}"/>`;
  },
  snowflake: (S, A) => {
    let arms = '';
    for (let i = 0; i < 6; i++) {
      arms += `<g transform="rotate(${i * 60} 60 60)"><path d="M60 60V26"/><path d="M60 36l-8-8M60 36l8-8"/><path d="M60 47l-6-6M60 47l6-6"/></g>`;
    }
    return `
    <g fill="none" stroke="${S}" stroke-width="5" stroke-linecap="round">${arms}</g>
    <circle cx="60" cy="60" r="6" fill="${A}"/>`;
  },
  harlequin: (S, A) => `
    <path d="M60 24 78 42 60 60 42 42Z" fill="${S}"/>
    <path d="M78 42 96 60 78 78 60 60Z" fill="${A}"/>
    <path d="M60 60 78 78 60 96 42 78Z" fill="${S}"/>
    <path d="M42 42 60 60 42 78 24 60Z" fill="${A}"/>`,
  tornado: (S, A) => `
    <g fill="none" stroke-linecap="round" stroke-width="6">
      <path d="M28 32h64" stroke="${S}"/>
      <path d="M34 45h50" stroke="${S}"/>
      <path d="M42 58h36" stroke="${S}"/>
      <path d="M50 71h22" stroke="${S}"/>
      <path d="M56 84h10" stroke="${S}"/>
    </g>
    <path d="M78 64 70 78h6l-4 12 12-16h-7l5-10Z" fill="${A}"/>`,
  snake: (S, A, P) => `
    <path d="M82 34c-6-8-24-8-30 0s0 16 12 20 20 12 14 22-28 10-38 0" fill="none" stroke="${S}" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="84" cy="36" rx="8" ry="6" fill="${S}" transform="rotate(30 84 36)"/>
    <circle cx="86" cy="34" r="1.8" fill="${P}"/>
    <path d="M90 41l5 5M90 41l1 6" stroke="${A}" stroke-width="2" stroke-linecap="round"/>`,
  tree: (S, A) => `
    <path d="M60 22 78 46H68L84 66H72L88 84H32L48 66H36L52 46H42Z" fill="${S}"/>
    <rect x="55" y="84" width="10" height="10" fill="${A}"/>`,
  pickaxes: (S, A) => {
    // one pick: handle + curved head, then mirrored and crossed
    const pick = `<rect x="57" y="36" width="6" height="58" rx="3" fill="${A}"/>
      <path d="M42 44c10-11 26-11 36 0l-3.5 4c-8-7-21-7-29 0Z" fill="${S}"/>`;
    return `
    <g transform="rotate(-36 60 72)">${pick}</g>
    <g transform="rotate(36 60 72)">${pick}</g>`;
  },
  beehive: (S, A) => `
    <g fill="${S}">
      <rect x="48" y="26" width="24" height="10" rx="5"/>
      <rect x="40" y="38" width="40" height="11" rx="5.5"/>
      <rect x="34" y="51" width="52" height="12" rx="6"/>
      <rect x="32" y="65" width="56" height="12" rx="6"/>
      <rect x="36" y="79" width="48" height="10" rx="5"/>
    </g>
    <path d="M53 89v-8a7 7 0 0 1 14 0v8Z" fill="${A}"/>`,
  hat: (S, A) => `
    <path d="M44 66c0-18 4-30 16-30s16 12 16 30Z" fill="${S}"/>
    <rect x="44" y="58" width="32" height="6" fill="${A}"/>
    <ellipse cx="60" cy="70" rx="38" ry="9" fill="${S}"/>
    <path d="M26 70c10 8 58 8 68 0" fill="none" stroke="${A}" stroke-width="2.5"/>
    <path d="M56 86h8l-4 8Z" fill="${A}"/>`,
  bridge: (S, A) => `
    <g fill="${S}">
      <rect x="42" y="26" width="6" height="58"/><rect x="72" y="26" width="6" height="58"/>
      <rect x="42" y="36" width="36" height="4"/><rect x="42" y="52" width="36" height="4"/>
      <rect x="24" y="70" width="72" height="5"/>
    </g>
    <path d="M24 46c8 14 16 22 21 22M96 46c-8 14-16 22-21 22M45 30c5 20 12 34 15 38M75 30c-5 20-12 34-15 38" fill="none" stroke="${A}" stroke-width="2.5"/>
    <g stroke="${A}" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M30 84h22"/><path d="M62 84h28"/><path d="M38 91h44"/></g>`,

  /* --- expansion franchises --- */
  horns: (S, A, P) => `
    <path d="M60 46c-10 0-16 6-16 16 0 12 7 24 16 28 9-4 16-16 16-28 0-10-6-16-16-16Z" fill="${S}"/>
    <path d="M44 54C34 54 26 46 24 32c6 8 12 10 20 10Z M76 54c10 0 18-8 20-22-6 8-12 10-20 10Z" fill="${A}"/>
    <circle cx="53" cy="62" r="3" fill="${P}"/><circle cx="67" cy="62" r="3" fill="${P}"/>
    <path d="M54 80h12" stroke="${P}" stroke-width="3" stroke-linecap="round"/>`,
  incline: (S, A) => `
    <g transform="rotate(-30 60 60)">
      <path d="M18 76h84M18 84h84" stroke="${A}" stroke-width="4" stroke-linecap="round"/>
      <path d="M34 40h52l-4 32H38Z" fill="${S}"/>
      <g fill="${A}"><rect x="41" y="46" width="10" height="10" rx="1"/><rect x="55" y="46" width="10" height="10" rx="1"/><rect x="69" y="46" width="10" height="10" rx="1"/></g>
      <circle cx="46" cy="76" r="4" fill="${S}"/><circle cx="74" cy="76" r="4" fill="${S}"/>
    </g>`,
  raindrop: (S, A) => `
    <path d="M60 22C50 40 40 52 40 66a20 20 0 0 0 40 0c0-14-10-26-20-44Z" fill="${S}"/>
    <path d="M52 64a8 8 0 0 0 8 10" fill="none" stroke="${A}" stroke-width="4" stroke-linecap="round"/>
    <g stroke="${A}" stroke-width="3" stroke-linecap="round"><path d="M28 34l-4 8"/><path d="M90 30l-4 8"/><path d="M92 54l-4 8"/></g>`,
  gem: (S, A) => `
    <path d="M36 44h48l12 14-36 36-36-36Z" fill="${S}"/>
    <path d="M36 44l10 14h28l10-14M24 58h72M46 58l14 36 14-36M60 44v14" fill="none" stroke="${A}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M60 24v8M44 28l4 6M76 28l-4 6" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`,
  arch: (S, A) => `
    <path d="M28 92C30 52 42 26 60 26s30 26 32 66h-9C81 58 72 36 60 36S39 58 37 92Z" fill="${S}"/>
    <path d="M58 70 74 54M74 54h-8M74 54v8" stroke="${A}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M42 84 58 70" stroke="${A}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M24 92h72" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`,
  axe: (S, A) => `
    <rect x="57" y="26" width="7" height="66" rx="3.5" fill="${A}" transform="rotate(20 60 60)"/>
    <path d="M58 30c-16-4-28 4-30 22 10-6 20-6 30-2Z" fill="${S}" transform="rotate(20 60 60)"/>
    <path d="M62 30c14-2 22 4 22 12-8-4-14-4-22-2Z" fill="${S}" transform="rotate(20 60 60)"/>`,
  crab: (S, A, P) => `
    <ellipse cx="60" cy="66" rx="22" ry="15" fill="${S}"/>
    <path d="M38 52c-10-2-14-10-12-20 4 4 8 4 12 2-2 6 0 12 6 14Z M82 52c10-2 14-10 12-20-4 4-8 4-12 2 2 6 0 12-6 14Z" fill="${A}"/>
    <g stroke="${S}" stroke-width="3.5" stroke-linecap="round"><path d="M40 72l-12 6M40 78l-10 10M80 72l12 6M80 78l10 10"/></g>
    <circle cx="54" cy="58" r="2.6" fill="${P}"/><circle cx="66" cy="58" r="2.6" fill="${P}"/>`,
  trophy: (S, A) => `
    <path d="M42 28h36v14c0 14-8 24-18 24S42 56 42 42Z" fill="${S}"/>
    <path d="M42 34H32c0 12 6 18 12 18M78 34h10c0 12-6 18-12 18" fill="none" stroke="${S}" stroke-width="4"/>
    <rect x="56" y="66" width="8" height="12" fill="${A}"/>
    <path d="M44 78h32v8H44Z" fill="${S}"/>
    <path d="M60 34l3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1Z" fill="${A}"/>
    <path d="M38 92h44" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`,
  sun: (S, A) => {
    let rays = '';
    for (let i = 0; i < 12; i++) rays += `<path d="M60 20 64 34H56Z" transform="rotate(${i * 30} 60 60)"/>`;
    return `
    <g fill="${A}">${rays}</g>
    <circle cx="60" cy="60" r="21" fill="${S}"/>
    <circle cx="60" cy="60" r="13" fill="none" stroke="${A}" stroke-width="3"/>`;
  },
  surfboard: (S, A) => `
    <g transform="rotate(30 60 60)">
      <path d="M60 20c10 14 12 30 12 40s-2 26-12 40c-10-14-12-30-12-40s2-26 12-40Z" fill="${S}"/>
      <path d="M60 26v68" stroke="${A}" stroke-width="3"/>
      <path d="M55 84h10l-5 10Z" fill="${A}"/>
    </g>
    <path d="M22 88c6-5 11-5 17 0s11 5 17 0" fill="none" stroke="${A}" stroke-width="4" stroke-linecap="round"/>`,
  falls: (S, A) => `
    <path d="M28 34h64v8H28Z" fill="${A}"/>
    <g fill="${S}"><rect x="34" y="42" width="10" height="40" rx="2"/><rect x="49" y="42" width="10" height="44" rx="2"/><rect x="64" y="42" width="10" height="40" rx="2"/><rect x="79" y="42" width="8" height="36" rx="2"/></g>
    <path d="M26 92c6-5 10-5 16 0s10 5 16 0 10-5 16 0 10 5 16 0" fill="none" stroke="${A}" stroke-width="4" stroke-linecap="round"/>`,
  lantern: (S, A) => `
    <path d="M52 24h16M60 24v6" stroke="${A}" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 34h28l-4 6H50Z" fill="${S}"/>
    <path d="M50 40h20l4 36H46Z" fill="${S}"/>
    <path d="M60 50c-5 6-6 10-3 15 2 3 6 3 8 0 3-5 2-9-5-15Z" fill="${A}"/>
    <path d="M44 76h32l-4 8H48Z" fill="${S}"/>
    <path d="M52 92h16" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`,
  fountain: (S, A) => `
    <path d="M60 30v34" stroke="${S}" stroke-width="5" stroke-linecap="round"/>
    <path d="M60 36c-8 0-16 6-20 16M60 36c8 0 16 6 20 16M60 46c-6 0-11 4-13 10M60 46c6 0 11 4 13 10" fill="none" stroke="${A}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M38 66h44l-6 10H44Z" fill="${S}"/>
    <path d="M30 82h60v8H30Z" fill="${S}"/>
    <circle cx="60" cy="26" r="4" fill="${A}"/>`,

  /* --- generic mark for fully custom teams (assets/logos/custom.svg) --- */
  ball: (S, A) => `
    <circle cx="60" cy="60" r="28" fill="${S}"/>
    <g fill="none" stroke="${A}" stroke-width="3"><path d="M32 60h56M60 32v56"/><path d="M40 40c8 8 8 32 0 40M80 40c-8 8-8 32 0 40"/></g>`
};

function buildLogo(team) {
  const { primary: P, secondary: S, tertiary: T } = team.colors;
  const badge = BADGES[team.logo.badge];
  const emblem = EMBLEMS[team.logo.emblem];
  if (!badge) throw new Error(`${team.id}: unknown badge "${team.logo.badge}"`);
  if (!emblem) throw new Error(`${team.id}: unknown emblem "${team.logo.emblem}"`);
  const b = badge(P, T, S);
  const dy = b.cy - 60;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${team.fullName} (${team.abbreviation}) — generated by tools/build-logos.js; edit data/franchises.js instead -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${team.fullName} logo">
  ${b.shape}
  ${b.trim}
  <g transform="translate(60 ${60 + dy}) scale(0.82) translate(-60 -60)">${emblem(S, T, P)}
  </g>
</svg>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const usedEmblems = new Set();
const ALL = FRANCHISES.concat(EXPANSION);
for (const team of ALL) {
  if (usedEmblems.has(team.logo.emblem)) throw new Error(`Emblem "${team.logo.emblem}" is used twice`);
  usedEmblems.add(team.logo.emblem);
  fs.writeFileSync(path.join(OUT_DIR, `${team.id}.svg`), buildLogo(team));
}
// Neutral placeholder for teams created from scratch in Customize
fs.writeFileSync(path.join(OUT_DIR, 'custom.svg'), buildLogo({
  fullName: 'Custom team', abbreviation: 'NEW',
  colors: { primary: '#3A3D44', secondary: '#E8E8EA', tertiary: '#9A9DA5' },
  logo: { badge: 'roundel', emblem: 'ball' }
}));
console.log(`Wrote ${ALL.length + 1} logos to ${path.relative(process.cwd(), OUT_DIR)}`);

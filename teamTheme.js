'use strict';

/**
 * teamTheme.js — a team's colours, made safe to put on the interface.
 *
 * A team's palette is user data. It can be near-black (a #1a1a1a secondary),
 * near-white, or a neon that vibrates against a dark card. Painting any of
 * those straight onto the UI produces accents nobody can see or text nobody
 * can read, so every colour goes through uiSafe() first: the hue is kept —
 * that is the team's identity — while lightness and saturation are moved
 * until the result actually reads against the surface it sits on.
 *
 * The theme is published as CSS custom properties on one element, so the whole
 * screen re-tints from a single call and changing teams is one more call.
 *
 * WHAT TEAM COLOUR IS NEVER USED FOR
 * Rating colours and financial colours carry meaning — green is good, gold is
 * average, red is poor or over the cap. Those come from theme.css and are not
 * touched here. Team colour is for borders, underlines, indicators, rings and
 * hover states only: decoration, never information.
 */

/* --------------------------------- colour ---------------------------------- */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function hexToRgb(hex) {
  const h = String(hex || '').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const toHex = (n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
export const rgbToHex = ({ r, g, b }) => `#${toHex(r / 255)}${toHex(g / 255)}${toHex(b / 255)}`;

/** WCAG relative luminance. Channels are linearised first, not averaged raw. */
export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black/white). */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbToHsl(hex) {
  const c = hexToRgb(hex);
  if (!c) return null;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }) {
  const hue = (p, q, t) => {
    let u = t; if (u < 0) u += 1; if (u > 1) u -= 1;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  if (s === 0) return `#${toHex(l)}${toHex(l)}${toHex(l)}`;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return `#${toHex(hue(p, q, h + 1 / 3))}${toHex(hue(p, q, h))}${toHex(hue(p, q, h - 1 / 3))}`;
}

/**
 * A version of `hex` that reads against `bg`, keeping the hue.
 *
 * Walks lightness toward whichever end gains contrast, in small steps, and
 * stops as soon as the target is met — so a colour that already works is
 * returned untouched and Miami's turquoise stays turquoise. Saturation is
 * capped so a neon input lands as a strong colour rather than a vibrating one.
 *
 * @param {string} hex     the team's colour
 * @param {string} bg      the surface it will sit on
 * @param {number} target  minimum contrast ratio (3 is the WCAG floor for
 *                         non-text UI, which is what these accents are)
 */
export function uiSafe(hex, bg = '#16181b', target = 3) {
  const hsl = rgbToHsl(hex);
  if (!hsl) return '#cf6127';                 // unparseable — fall back to the brand
  const s = Math.min(hsl.s, 0.82);            // no neon
  const bgLum = luminance(bg);
  // On a dark surface, lighten; on a light one, darken.
  const dir = bgLum < 0.5 ? +1 : -1;
  const lo = 0.30, hi = 0.80;

  let l = Math.max(lo, Math.min(hi, hsl.l));
  let out = hslToHex({ h: hsl.h, s, l });
  for (let i = 0; i < 60 && contrast(out, bg) < target; i++) {
    l = Math.max(lo, Math.min(hi, l + dir * 0.01));
    out = hslToHex({ h: hsl.h, s, l });
    if (l <= lo || l >= hi) break;            // as far as it can honestly go
  }
  return out;
}

/** White or near-black, whichever is legible ON this colour. */
export function readableOn(hex) {
  const dark = '#0b0c0e';
  return contrast(hex, '#ffffff') >= contrast(hex, dark) ? '#ffffff' : dark;
}

/** `hex` at `alpha`, for tints and glows. */
export function withAlpha(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return `rgba(207, 97, 39, ${alpha})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/* ------------------------------- the theme -------------------------------- */

/**
 * Build the custom properties for a team.
 * @param {object} team  needs `colors` ({primary, secondary, tertiary}) or the
 *                       legacy single `color`
 * @param {string} surface  the card colour the accents sit on
 */
export function teamThemeVars(team, surface = '#16181b') {
  const c = (team && team.colors) || {};
  const legacy = (team && team.color) || '#cf6127';
  const rawPrimary = c.primary || legacy;
  const rawSecondary = c.secondary || '#ffffff';
  const rawTertiary = c.tertiary || '#0d1e34';

  const primary = uiSafe(rawPrimary, surface, 3.2);
  const secondary = uiSafe(rawSecondary, surface, 3);
  const tertiary = uiSafe(rawTertiary, surface, 2.4);

  return {
    // The raw palette, for the crest — a logo should show the team's actual
    // colours, not a legibility-adjusted version of them.
    '--team-raw-primary': rawPrimary,
    '--team-raw-secondary': rawSecondary,
    '--team-raw-tertiary': rawTertiary,
    // The adjusted palette, for interface accents.
    '--team-primary': primary,
    '--team-secondary': secondary,
    '--team-tertiary': tertiary,
    '--team-on-primary': readableOn(primary),
    // Tints, for glows, tracks and hover states.
    '--team-soft': withAlpha(primary, 0.16),
    '--team-softer': withAlpha(primary, 0.08),
    '--team-glow': withAlpha(primary, 0.28),
    '--team-line': withAlpha(primary, 0.45),
  };
}

/**
 * Apply a team's theme to an element (the app shell by default). Calling it
 * again with a different team re-tints everything, which is how switching
 * teams updates the screen.
 */
export function applyTeamTheme(team, el) {
  const node = el || document.querySelector('.app') || document.body;
  if (!node) return;
  const vars = teamThemeVars(team);
  for (const [k, v] of Object.entries(vars)) node.style.setProperty(k, v);
  node.classList.add('has-team-theme');
}

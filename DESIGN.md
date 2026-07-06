# Design System

All tokens below are the **actual** CSS custom properties defined in
[`src/index.css`](./src/index.css) — that file is the single source of truth.
(Earlier versions of this document contained artefacts from an automated
source-site extraction, including placeholder font names and broken component
specs; those have been removed.)

## 1. Visual Theme

Friendly, approachable design with rounded shapes and generous whitespace.

- **Inter** (`'Inter', system-ui, -apple-system, sans-serif`) for both headings and body text
- Heading weight **500**
- Light/white background as the primary canvas; a full dark theme via `[data-theme="dark"]`
- Primary accent `#db001b` used for CTAs and brand highlights
- Rounded corners (6px default) on all interactive elements

## 2. Color Tokens

### Light theme (`:root`)

| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#db001b` | Brand color, CTA backgrounds, interactive highlights |
| `--color-secondary` | `#bc002c` | Secondary brand, hover states, Educational-Leave accents |
| `--color-bg` | `#ffffff` | Page background |
| `--color-text` | `#151f27` | Headings and body text |
| `--color-text-secondary` | `#586674` | Muted text, captions, placeholders |
| `--color-border` | `#f4f8fc` | Dividers, outlines, input borders |
| `--color-surface` | `#f4f8fc` | Cards, subtle raised surfaces |
| `--color-success` | `#16a34a` | Positive states (e.g. remaining-days progress) |

### Dark theme (`[data-theme="dark"]` overrides)

| Token | Value |
|---|---|
| `--color-bg` | `#151f27` |
| `--color-text` | `#f4f8fc` |
| `--color-text-secondary` | `#8d99a5` |
| `--color-border` | `#2a3a4a` |
| `--color-surface` | `#1e2d3d` |

## 3. Typography

| Token | Value |
|---|---|
| `--font-heading` | `'Inter', system-ui, -apple-system, sans-serif` |
| `--font-body` | `'Inter', system-ui, -apple-system, sans-serif` |

| Element | Size | Weight | Line height |
|---|---|---|---|
| `h1` | 42px | 500 | 1.15 |
| `h2` | 28px | 500 | 1.2 |
| `h3` | 24px | 500 | 1.25 |
| `h4` | 20px | 500 | 1.3 |
| body | 15px | 400 | 1.5 |

Base font size: `html { font-size: 16px }` with antialiased smoothing.

## 4. Spacing

Base unit `--spacing-unit: 20px`; use the derived scale:

| Token | Value |
|---|---|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `12px` |
| `--space-lg` | `20px` |
| `--space-xl` | `40px` |
| `--space-2xl` | `60px` |
| `--space-3xl` | `80px` |

## 5. Radius & Elevation

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Subtle (inputs, badges) |
| `--radius` | `6px` | Default (buttons, cards) |
| `--radius-lg` | `10px` | Large cards, modals |
| `--radius-xl` | `50px` | Pills |

| Token | Value (light) | Usage |
|---|---|---|
| `--shadow-mid` | `rgb(153,153,153) 0 2px 10px -3px` | Dropdowns, popovers |
| `--shadow-high` | `rgba(0,0,0,0.2) 0 0 18px 0` | Modals, floating elements |
| `--shadow-deep` | `rgba(0,0,0,0.1) 0 16px 32px 0` | Hero/deep layers |

`--shadow-mid` / `--shadow-high` have stronger dark-theme variants.

## 6. Do's and Don'ts

### Do
- Use the CSS custom properties — never hardcode colors or spacing in component CSS
- Use **Inter** (with the system-ui fallback) for all text
- Keep `#db001b` the single dominant accent/CTA color
- Stick to the `--space-*` scale for gaps and padding
- Use rounded corners (`--radius` 6px+) for all interactive elements
- Style both themes: any new color must have a `[data-theme="dark"]` story

### Don't
- Don't introduce colors outside the token palette without justification
- Don't use pure black `#000000` for text — use `--color-text` (`#151f27`)
- Don't use sharp corners — they clash with the rounded design language
- Don't add decorative elements (badges, ribbons, banners) that have no counterpart in the existing UI

## 7. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | 2-column year grid, single-column stats, stacked nav |
| Tablet | 640–1024px | 3-column year grid, 2-column stats |
| Desktop | > 1024px | 4-column year grid, 3-column stats |

- Touch targets: minimum 44×44px on mobile

## 8. Agent Prompt Guide

For AI coding assistants building new UI components (general rules live in
[AGENTS.md](./AGENTS.md)):

1. Start with layout structure (sections, grid, spacing from the `--space-*` scale)
2. Apply color tokens — background first, then text, then accents
3. Set typography — Inter, sizes from the h1–h4 scale, weight 500 for headings
4. Apply `--radius` consistently; use `--shadow-*` for elevation
5. Add the dark-theme story for every new color
6. Check responsive behavior at the three breakpoints

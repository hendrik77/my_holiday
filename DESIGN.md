# Design System Inspired by Syskoplan Reply

> Auto-extracted from `https://www.reply.com/syskoplan-reply/de` on 2026-04-23

## 1. Visual Theme & Atmosphere

Friendly, approachable design with rounded shapes and generous whitespace.

The hero section leads with "Run SAP. Better. Faster. Smarter. With Us.".

**Key Characteristics:**
- aawdfdgnxz as the heading font
- Alaska as the body font for all running text
- Heading weight 500
- Light/white background (#ffffff) as the primary canvas
- Primary accent `#db001b` used for CTAs and brand highlights
- 7 shadow level(s) detected — tinted shadows
- Rounded corners (6px+) creating a friendly, approachable feel
- Tags: light, rounded, accented, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#db001b`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#bc002c`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#ffffff`) · `--color-bg`: Page background, primary canvas.

### Text
- **Text Primary** (`#151f27`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#586674`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#f4f8fc`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#f4f8fc` | `--palette-1` | button | large | text-dark |
| 2 | `#ffffff` | `--palette-2` | block | large | text-dark |
| 3 | `#151f27` | `--palette-3` | button | large | text-light |
| 4 | `#000000` | `--palette-4` | block | large | text-light |
| 5 | `#c5ccd3` | `--palette-5` | block | medium | text-dark |
| 6 | `#db001b` | `--palette-6` | badge | small | text-light |
| 7 | `#586674` | `--palette-7` | text-accent | small | text-light |
| 8 | `#bc002c` | `--palette-8` | text-accent | small | text-light |
| 9 | `#3860be` | `--palette-9` | text-accent | small | text-light |

## 3. Typography Rules

- **Heading Font:** `aawdfdgnxz`, sans-serif
- **Body Font:** `Alaska`, sans-serif

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | aawdfdgnxz | 64px | 500 | 70.4px | normal |
| H2 | Alaska | 16px | 700 | 19.2px | normal |
| H3 | khanqyjjei | 36px | 500 | 43.2px | normal |
| H4 | Alaska | 14.08px | 600 | 21.12px | normal |
| Body | Alaska | 15px | 400 | 19.5px | normal |
| Small | Alaska | 12px | 300 | 16.8px | normal |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `64px` | headings |
| H1 | `42px` | headings |
| H2 | `36px` | headings |
| H3 | `28px` | headings |
| H4 | `24px` | headings |
| Body L | `22px` | body / supporting text |
| Body | `20px` | body / supporting text |
| Small | `18px` | body / supporting text |
| XS | `16px` | body / supporting text |
| Caption | `15px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: transparent;
  color: #151f27;
  border-radius: 0px;
  padding: 20px 0px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #151f27;
  color: #ffffff;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 2

```css
.btn-filled-2 {
  background: #ffffff;
  color: #ffffff;
  border-radius: 4px;
  padding: 20px 40px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 3

```css
.btn-filled-3 {
  background: #c5ccd3;
  color: #ffffff;
  border-radius: 4px;
  padding: 20px 40px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 4

```css
.btn-filled-4 {
  background: #ffffff;
  color: #ffffff;
  border-radius: 50px;
  padding: 1px 6px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 5

```css
.btn-filled-5 {
  background: #151f27;
  color: #ffffff;
  border-radius: 4px;
  padding: 20px 40px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #000000;
  border-radius: 6px;
  padding: 0px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `20px` — use multiples (40px, 60px, 80px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `20px` | element |
| spacing-2 | `1px` | element |
| spacing-3 | `24px` | card |
| spacing-4 | `40px` | card |
| spacing-5 | `12px` | element |
| spacing-6 | `16px` | element |
| spacing-7 | `8px` | element |
| spacing-8 | `96px` | section |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-button | `6px` | button |
| radius-card | `50px` | card |
| radius-subtle | `4px` | subtle |
| radius-button | `10px` | button |
| radius-subtle | `2px` | subtle |
| radius-subtle | `1px` | subtle |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Deep | `rgba(0, 0, 0, 0.1) 0px 16px 32px 0px` | Hero sections, deep layers |
| Deep | `rgba(0, 0, 0, 0.2) 0px 16px 32px 0px` | Hero sections, deep layers |
| Mid | `rgb(128, 128, 128) 0px 0px 5px 0px` | Dropdowns, popovers |
| High | `rgba(0, 0, 0, 0.2) 0px 0px 18px 0px` | Modals, floating elements |
| Mid | `rgb(153, 153, 153) 0px 2px 10px -3px` | Dropdowns, popovers |


## 7. Do's and Don'ts

### Do
- Use `#ffffff` as the primary background color
- Use `aawdfdgnxz` for all headings and `Alaska` for body text
- Use `#db001b` as the single dominant accent/CTA color
- Maintain `20px` as the base spacing unit — all gaps should be multiples
- Use rounded corners (`6px`+) consistently for all interactive elements
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 500 for headings to match the brand's typographic voice

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute aawdfdgnxz/Alaska with generic alternatives
- Don't use irregular spacing — stick to 20px grid
- Don't use dark/black backgrounds — this is a light-themed design
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't use pure black (#000000) for text — use `#151f27` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 20px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #ffffff
Text:        #151f27
Accent:      #db001b
Secondary:   #bc002c
Border:      #f4f8fc
```

### Example Prompts

1. "Build a hero section with a `#ffffff` background, `aawdfdgnxz` heading in `#151f27`, and a `#db001b` CTA button with 0px radius."
2. "Create a pricing card using background `#ffffff`, border `#f4f8fc`, `Alaska` for text, and 60px padding."
3. "Design a navigation bar — `#ffffff` background, `#151f27` links, `#db001b` for active state."
4. "Build a feature grid with 3 columns, 60px gap, each card using the card component style."
5. "Create a footer with `#151f27` background, `#ffffff` text, and 40px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct

## 10. CSS Custom Properties

> 7 custom properties extracted from `:root` / `html` stylesheets.

### Color Variables

| Variable | Value |
|---|---|
| `--brand-color` | `#DB001B` |
| `--primary-color-20` | `#8D99A5` |
| `--primary-color-50` | `#DB001B` |
| `--text-on-brand-color` | `#FFFFFF` |

### Spacing Variables

| Variable | Value |
|---|---|
| `--jobs-header` | `440px` |
| `--header-height` | `64px` |
| `--img-invert-value` | `0` |

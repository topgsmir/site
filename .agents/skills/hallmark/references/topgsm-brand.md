# TopGSM brand colours

Use this locked palette for every TopGSM surface:

| Role | Token | Value |
| --- | --- | --- |
| Foundation, dark canvas, primary ink | `--color-brand-navy` | `#011627` |
| Destructive action, error signal | `--color-brand-pink` | `#ff3366` |
| Success, positive state, secondary accent | `--color-brand-teal` | `#2ec4b6` |
| Light canvas, light ink | `--color-brand-off-white` | `#f6f7f8` |
| Primary brand, primary action, active state, focus, link, information signal | `--color-brand-blue` | `#20a4f3` |

Treat these five values as primitives. Define component colours with semantic tokens and derive tints, borders, elevated surfaces, and muted text with `color-mix()` between the primitives. Do not introduce a sixth unreviewed hex, RGB, HSL, or OKLCH colour.

## Composition hierarchy

- Let navy and off-white carry roughly 85–90% of every screen: page backgrounds, panels, tables, borders, and typography. Build neutral surfaces by mixing only navy with off-white; never tint large surfaces with pink, teal, or blue.
- Use blue as the primary interaction accent for primary actions, the current selection, and active navigation. Keep saturated blue to one dominant action or a few small state markers per view.
- Reserve pink for destructive actions and error signals. It is not the primary brand or ordinary interaction accent.
- Reserve teal for confirmed success, healthy/active status, and positive data. Never use it as general decoration or navigation colour.
- Also use blue for keyboard focus, links that need a distinct information cue, and informational states. Do not combine blue text or icons with a pink-tinted background.
- Avoid placing saturated pink, teal, and blue immediately beside one another. Separate them with a neutral surface or use only one chromatic family inside a component.
- Keep soft colour fills subtle: normally 5–9% colour mixed into the current paper. Stronger fills require a semantic reason and must remain small.

Use navy text on the exact pink, teal, and blue primitives. Use off-white text on navy. For primary filled controls and body-sized links, consume the theme-aware `--color-dashboard-accent` and `--color-dashboard-accent-ink` tokens: darkened blue with off-white text in light mode, and blue with navy text in dark mode. Use the existing error tokens for pink error/destructive states. Do not pair pink directly with teal or blue for text because those combinations do not meet accessible contrast.

Keep the product token source of truth in `apps/web/tokens.css`. Local components must consume those tokens rather than redefining their own palette. Theme metadata must use off-white in light mode and navy in dark mode.

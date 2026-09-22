# TopGSM brand colours

Use this locked palette for every TopGSM surface:

| Role | Token | Value |
| --- | --- | --- |
| Foundation, dark canvas, primary ink | `--color-brand-navy` | `#011627` |
| Primary action, active state, error signal | `--color-brand-pink` | `#ff3366` |
| Success, positive state, secondary accent | `--color-brand-teal` | `#2ec4b6` |
| Light canvas, light ink | `--color-brand-off-white` | `#f6f7f8` |
| Focus, link, information signal | `--color-brand-blue` | `#20a4f3` |

Treat these five values as primitives. Define component colours with semantic tokens and derive tints, borders, elevated surfaces, and muted text with `color-mix()` between the primitives. Do not introduce a sixth unreviewed hex, RGB, HSL, or OKLCH colour.

## Composition hierarchy

- Let navy and off-white carry roughly 85–90% of every screen: page backgrounds, panels, tables, borders, and typography. Build neutral surfaces by mixing only navy with off-white; never tint large surfaces with pink, teal, or blue.
- Use pink as the sole interaction accent for primary actions, the current selection, active navigation, and destructive/error signals. Keep saturated pink to one dominant action or a few small state markers per view.
- Reserve teal for confirmed success, healthy/active status, and positive data. Never use it as general decoration or navigation colour.
- Reserve blue for keyboard focus, links that need a distinct information cue, and informational states. Do not combine blue text or icons with a pink-tinted background.
- Avoid placing saturated pink, teal, and blue immediately beside one another. Separate them with a neutral surface or use only one chromatic family inside a component.
- Keep soft colour fills subtle: normally 5–9% colour mixed into the current paper. Stronger fills require a semantic reason and must remain small.

Use navy text on the exact pink, teal, and blue primitives. Use off-white text on navy. Pink on off-white is suitable for large text, borders, and decoration, but not body-sized text; darken the semantic pink with navy and use off-white text when the same token must work for body-sized links and filled controls. Do not pair pink directly with teal or blue for text because those combinations do not meet accessible contrast.

Keep the product token source of truth in `apps/web/tokens.css`. Local components must consume those tokens rather than redefining their own palette. Theme metadata must use off-white in light mode and navy in dark mode.

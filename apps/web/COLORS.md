# Shared colors

Edit `tokens.css` to change colors across admin, seller, and shared storefront components. It is imported once by `src/app/globals.css`; CSS Modules consume the same variables.

## Change the palette

The top of `tokens.css` contains the five brand primitives, plus white for surfaces and amber for warnings. Change these values to update the palette everywhere.

## Change a color's purpose

The `--color-role-*` assignments immediately below the primitives control both light and dark themes:

| Role | Default | Usage |
| --- | --- | --- |
| primary | Brand blue | Primary buttons, active navigation, selections, chart series |
| success | Brand teal | Confirmed success, paid/delivered states |
| error | Brand fuchsia | Errors, failed states, destructive actions |
| info | Brand blue | Informational messages |
| warning | Amber | Actionable warnings, low stock, approaching deadlines |

Use `--color-dashboard-neutral` and `--color-dashboard-neutral-soft` for ordinary pending states. Monetary values and headings use the ink tokens.

## Component rules

Navigation uses the `--color-navigation-*` tokens near the top of `tokens.css`. Its navy background stays dark in both themes. Change these tokens to adjust the desktop rails, mobile header, bottom dock, and menu together. `data-navigation-surface` applies the shared local aliases; selected items use `navigation-selected` with `navigation-selected-ink`.

- Reference `--color-dashboard-*` tokens in components; do not copy hex values or define a local palette.
- Pair `accent` or `accent-strong` backgrounds with `accent-ink` text.
- Pair status text with its matching `*-soft` background and a visible status label.
- Use `focus` for focus indicators. Use `accent-strong` for primary hover states.
- Light and dark colors are derived centrally. Exact bright brand colors are darkened in light mode to keep small text readable.
- After changing primitives, verify normal text contrast is at least 4.5:1 and focus indicators contrast at least 3:1 against adjacent surfaces. Derived colors do not guarantee contrast for arbitrary replacement palettes.

Blue is the primary interaction color. This supersedes the older pink-primary mapping in the local Hallmark brand reference.

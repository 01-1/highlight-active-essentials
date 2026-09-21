# Highlight Active Essentials

A Sine CSS mod for Zen Browser that shows which Essentials are loaded and which are not.

- **Loaded Essentials** get a marker: a ring around the tab (default), a glow behind the favicon, a corner dot, or ring and dot together.
- **Unloaded Essentials** are dimmed (default), dimmed and desaturated, desaturated only, left to the browser, or forced to full color.
- Every setting applies live in all windows without a restart.
- Designed to coexist with visual themes such as **Neo Zen**: it only uses properties those themes leave alone (details below).

## Install with Sine

1. Put this project's files in a GitHub repository.
2. In Zen's **Settings → Sine Mods**, enter that repository's URL in the custom GitHub repository installer.
3. Open **Highlight Active Essentials** in the mods list to change settings. Until you open it once, the defaults below are in effect.

This folder is the complete mod source; there is no build step and no JavaScript.

## Settings

### Loaded Essentials

| Setting | Options | Default |
| --- | --- | --- |
| Marker | Ring around the tab · Glow behind the favicon · Dot in the corner · Ring and dot · Off | Ring |
| Color | Zen accent color · Custom | Zen accent color |
| Custom color | Any CSS color, e.g. `#3ddc84`, `rgb(61 220 132)`, `lime`. Leave the field to save it. | `#3ddc84` |
| Strength | Subtle · Normal · Bold (ring width, glow radius, and dot size) | Normal |
| Hide the marker on the selected Essential | Checkbox. The selected tab already has its own background. | Off |

An invalid custom color makes the marker disappear rather than fall back, so fix the value if nothing shows.

### Unloaded Essentials

| Setting | Options | Default |
| --- | --- | --- |
| Appearance | Dim · Dim and grayscale · Grayscale only · Browser default (mod does nothing) · Never dim (always full color) | Dim |
| Dim amount | Light (70%) · Medium (45%) · Heavy (25%) favicon opacity | Medium |
| Which unloaded Essentials | All unloaded · Only ones unloaded with "Unload Tab" | All unloaded |

"All unloaded" covers tabs unloaded by Zen's tab unloader, tabs not yet restored after startup, and tabs you unloaded by hand. The "Unload Tab" option relies on Firefox's `discarded` attribute, which is only set for tabs unloaded from the tab context menu or `about:unloads`.

"Browser default" leaves Firefox's own behavior in place: with `browser.tabs.fadeOutExplicitlyUnloadedTabs` (on by default) hand-unloaded favicons are shown at 50% opacity, and `browser.tabs.fadeOutUnloadedTabs` extends that to every unloaded tab. "Never dim" overrides both for Essentials.

## Compatibility

Zen and themes such as Neo Zen already style Essentials heavily, often with `!important`. This mod stays out of their way by only ever setting:

| Element | Properties this mod sets |
| --- | --- |
| `.tab-background` | `outline`, `outline-offset` (the ring; drawn inset so nothing clips it) |
| `.tab-icon-image` | `opacity`, `filter`, `transition` (dimming, grayscale, glow) |
| `.tab-content::after` | the dot marker |

It never sets the tab element's own `opacity`, `visibility`, or `display` (Neo Zen animates those to collapse the Essentials grid), never sets `background`, `border`, or `box-shadow` on `.tab-background` (Neo Zen owns them), and never uses `.tab-background::before` or `::after` (Zen uses them for the selected-tab background and favicon glow). Dimming is applied to the favicon on the same element and property Firefox uses for its own unloaded-tab fade, so the two replace rather than stack.

Settings are read with Firefox's `-moz-pref()` media queries, the same mechanism Zen and Neo Zen use, so nothing depends on Sine rebuilding the DOM and the mod works before Sine has written any preference. Only the custom color uses Sine's `--mod-*` variable, which Sine refreshes whenever the field changes.

Verified against [Zen's tab styles](https://github.com/zen-browser/desktop/blob/dev/src/zen/tabs/zen-tabs/vertical-tabs.css), [Firefox's tab styles](https://github.com/mozilla-firefox/firefox/blob/main/browser/themes/shared/tabbrowser/tabs.css), [Neo Zen](https://github.com/JustVibingWhileCoding/Neo-Zen), and [Sine's loader](https://github.com/CosmoCreeper/Sine/tree/main/src). Because it relies on browser-internal markup (`[zen-essential]`, `[pending]`, `[discarded]`), future browser changes may require an update.

## Verify

Run `node --test tests/*.test.cjs`. The tests check the package, that every setting is wired to the stylesheet, that defaults work before Sine writes any preference, and that the compatibility contract above holds.

In Zen, check: an unloaded Essential is dimmed and a loaded one has a ring; clicking the unloaded one loads it and swaps the two states; each marker style, color, and strength; "Unload Tab" on an Essential; a second window; and, with Neo Zen enabled, that the collapsed Essentials grid still expands on hover and the markers appear on the correct tabs.

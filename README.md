# Tab State Highlighter

A configurable Sine CSS mod for Zen Browser that gives loaded and unloaded tabs distinct visual effects.

- Essentials and regular tabs have separate loaded, unloaded, and fading settings.
- Regular tabs can copy the corresponding Essentials effect and fading settings.
- Effects include a ring, an outside whole-tab glow, an overlay whole-tab glow, a favicon glow, a corner dot, or ring and dot together.
- Unloaded tabs can also be dimmed or desaturated independently of their marker.
- Settings apply live in every window.

## Install with Sine

1. Open Zen's **Settings → Sine Mods**.
2. Install `https://github.com/01-1/tab-state-highlighter` as a custom GitHub repository.
3. Open **Tab State Highlighter** in the mods list to configure it.

This repository is the complete mod source; there is no build step.

## Settings

### Essentials — loaded

| Setting | Options | Default |
| --- | --- | --- |
| Effect | Ring · Glow around the whole tab · Glow over the whole tab · Favicon glow · Dot · Ring and dot · Off | Ring |
| Color | Zen accent · Custom | Zen accent |
| Custom color | Any CSS color | `#3ddc84` |
| Ring width | Any whole number of pixels | `2` |
| Glow strength | Any non-negative whole number, with no configured maximum | `100` |
| Dot size | Any whole number of pixels | `5` |
| Hide the effect on the selected loaded tab | Checkbox | Off |

Glow strength changes the opacity of three fixed-radius glow layers. Larger numbers continue increasing the opacity with diminishing steps; the blur radius stays fixed at `5px`.

### Essentials — unloaded

| Setting | Options | Default |
| --- | --- | --- |
| Effect | Same as loaded tabs · Ring · Glow around the whole tab · Glow over the whole tab · Favicon glow · Dot · Ring and dot · Off | Off |
| Color | Same as loaded tabs · Zen accent · Custom | Same as loaded tabs |
| Custom color | Any CSS color | `#ff8a3d` |
| Ring width | Any whole number of pixels | `2` |
| Glow strength | Any non-negative whole number, with no configured maximum | `100` |
| Dot size | Any whole number of pixels | `5` |
| Hide the effect on the selected unloaded tab | Checkbox | Off |

**Same as loaded tabs** on Effect copies the loaded style, color, ring width, glow strength, and dot size. Selecting an explicit unloaded effect exposes its independent controls. Selecting **Same as loaded tabs** on Color copies only the loaded color.

### Essentials — unloaded fading

| Setting | Options | Default |
| --- | --- | --- |
| Appearance | Dim · Dim and grayscale · Grayscale only · Browser default · Never dim | Dim |
| Apply fading to | Favicon only · Whole tab | Favicon only |
| Dim amount | Light (70%) · Medium (45%) · Heavy (25%) | Medium |
| Which unloaded tabs | All unloaded · Only tabs unloaded with "Unload Tab" | All unloaded |

Firefox marks unloaded tabs with `[pending]` and tabs unloaded explicitly with `[discarded]`. **Browser default** leaves Firefox's own unloaded-tab styling untouched. **Never dim** restores full opacity while leaving a configured marker effect active.

### Regular tabs — loaded

Regular loaded tabs have their own Effect, Color, Custom color, Ring width, Glow strength, Dot size, and Hide on selected controls. **Same as loaded Essentials** copies the complete loaded Essentials effect. It is the default so existing highlighting continues to apply to regular tabs after updating.

### Regular tabs — unloaded

Regular unloaded tabs have the same independent controls. Effect can copy **unloaded Essentials** or the loaded regular-tab effect. Color can copy unloaded Essentials or the loaded regular-tab color. **Same as unloaded Essentials** is the default.

### Regular tabs — unloaded fading

Regular tabs have separate Appearance, target, amount, and scope controls. Appearance defaults to **Same as unloaded Essentials**, which copies the complete Essentials fading configuration. Selecting an explicit appearance exposes the regular-tab target, amount, and scope settings.

## Compatibility

The mod limits its changes to these elements and properties:

| Element | Properties |
| --- | --- |
| `.tabbrowser-tab` | `overflow` for the outside whole-tab glow |
| `.tab-background` | `outline`, `outline-offset`; `::after` for whole-tab glow layers |
| `.tab-icon-image` | `opacity`, `filter`, `transition` |
| `.tab-stack` | `opacity`, `filter`, `transition` |
| `.tab-content::after` | Corner dot properties |

It does not set the tab element's opacity, visibility, or display, or change `.tab-background` colors, borders, or box shadows. This avoids the properties Zen and themes such as Neo Zen use for layout, selected-tab backgrounds, and compact-mode animation.

Settings use Firefox `-moz-pref()` media queries. Numeric and custom-color settings use Sine's generated `--mod-*` custom properties.

### Sine versions up to v2.3.4.1c

Those versions evaluate a setting's `conditions` before adding the setting element to the dialog. Conditional settings may appear briefly on the first open and update correctly after a related setting changes. This is a Sine bug; an upstream fix is prepared for review.

## Verify

Run:

```sh
node --test tests/*.test.cjs
```

In Zen, verify every loaded and unloaded effect, both copy options, values above `100` for glow strength, explicit versus all-unloaded fading, a selected tab, a second window, pinned tabs, Essentials, and compatibility with Neo Zen compact mode.

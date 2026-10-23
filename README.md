# Effect Master · VectorCraft edition

Version **0.4.0**, tested on Windows with the official **EffectCraft 0.14.0** and **VectorCraft 0.14.0** applications.

A floating palette with persistent object links between VectorCraft artwork and editable EffectCraft layers. Includes native fill/stroke round trips, property updates, text import, gradients, group controls, and a transparent PNG fallback. Neither application's executable is modified. PhotoCraft and FigCraft integration is deferred.

## Downloads

| Platform | Package | Status |
|---|---|---|
| Windows | `Effect-Master-0.4.0-Windows.zip` | Tested with both official apps |
| Ubuntu/Debian, Intel/AMD 64-bit | `Effect-Master-0.4.0-Linux-x64-preview.tar.gz` | Preview; Linux app round trips not yet verified |

Get both packages from [Releases](https://github.com/EddyTheDesigner/Effect-Master/releases/latest). For Linux, follow the [Linux setup guide](docs/LINUX.md). The instructions below describe Windows setup; transfer controls and artwork limits are shared.

## Start here

Download **Effect-Master-0.4.0-Windows.zip** from the [latest release](https://github.com/EddyTheDesigner/Effect-Master/releases/latest) and extract it before installing. Use the Windows package, rather than GitHub's automatically generated source-code archives.

1. Open **dist/Setup Effect Master.exe** and choose **Install and open**. It installs for your Windows account, adds Desktop and Start-menu shortcuts, and backs up previous installed copies.
2. Save your work and restart VectorCraft and EffectCraft once after setup. Open them normally thereafter. If Windows has not refreshed their environment, click their names in the palette to open them after closing them.
3. In EffectCraft, enable **Settings → Scripting & Expressions → Allow Scripts to Write Files and Access Network**. The installer does not change this global preference.
4. Open **Effect Master** from its Desktop or Start-menu shortcut. The two connection indicators update automatically. Drag its heading to move it; the pin keeps it above other windows.
5. Select artwork in VectorCraft and open a composition in EffectCraft. Press the large **up arrow** to push it into EffectCraft. **Shift + up arrow** creates a matching composition. The **down arrow** pulls selected EffectCraft shape layers back into VectorCraft.

An optional dockable panel remains available at **Window → Effect Master.jsx** inside EffectCraft. Its arrows are relative to EffectCraft: down imports from VectorCraft, up exports to VectorCraft. The floating palette works without this panel being open.

Setup enables the apps' existing local automation interfaces using the supported per-user `VECTORCRAFT_CONTROL_PORT` and `EFFECTCRAFT_CONTROL_PORT` settings (defaults **7979** and **7978**, preserving existing valid settings). The palette talks directly to the apps; transfers execute through EffectCraft's scripting API. There is no separate bridge service, special app launcher, clipboard dependency, cloud account, or Node/Python runtime requirement. The palette uses Windows' .NET Framework. Official application updates can be installed normally; future API changes may require an Effect Master adapter update.

VectorCraft does not currently support custom dockable extension panels. Effect Master uses a floating palette, with a future dockable extension planned when official API support becomes available. UI-independent operations live in `src/adapter.js`; the floating UI and app transport are separate C# components, so a later host adapter can reuse the transfer engine.

## Panel controls

Hover any icon for its description. Click the status line to read the full message. The VectorCraft tab shows artboard actions; the EffectCraft tab shows group actions. The following arrows describe the floating palette.

| Row | Icon/action | Behavior |
|---|---|---|
| Header | Menu | Artboard, new-comp timing, image folder, accent, corners |
| Connection | Link | Read the active VectorCraft document and selection |
| Transfer | Up arrow | Send VC selection to EC; update linked layers, create unlinked source objects; Shift creates a matching comp |
| Transfer | Down arrow | Update original linked VC objects from EC design geometry and paints |
| Transfer | Picture | Rasterize the source selection to transparent 2× PNG; import at 50% |
| Modes | Overlapping boxes | Normal: vector groups become one shape layer |
| Modes | Four boxes | Split: individual objects plus parent group controllers |
| Modes | Box with plus | Combine selected vectors into one shape layer |
| Modes | Crosshair | Center the artboard within a differently sized composition |
| Modes | Circular arrow | Update selected EC geometry, fill, stroke or containing shape group from one VC object |
| Links / copies | Chain | Link one existing VC object to one selected matching EC layer |
| Links / copies | Broken chain | Unlink selection in the palette's active app tab |
| Links / copies | Up + | Send new copies to EC, without changing existing links |
| Links / copies | Down + | Send new copies to VC, sampling the current animated pose |
| Groups | Nested box | Precompose selected layers and all their descendants |
| Groups | Open corners | Decompose a compatible precomp, preserving stacking and parenting |
| Groups | Eye | Hide/show Effect Master controllers using timeline shy switches |
| Groups | Trash | Release selected Effect Master controllers, retaining their children |
| Artboard | Plus | New composition matching the chosen artboard |
| Artboard | Stacked pages | Pull all visible artwork in the document |
| Artboard | Color bars | Import RGB solid document swatches as a guide shape layer |
| Artboard | Guides | Import visible ruler guides for the chosen artboard |

Artboard **0** in settings means the active VectorCraft artboard. Values **1, 2, …** choose a fixed artboard. Coordinates are measured from its top-left corner. “All artwork” includes the whole document, so objects from other artboards may land outside the composition.

Coral, Lime, Blue, and Violet accents and 0–16 pixel corner rounding are available in both UIs. Each UI saves its own preferences. New compositions default to 30 fps and 10 seconds.

## Editable transfer support

- Bézier paths, compound paths, solid RGB fills and strokes, opacity, ordinary fill/stroke stacks, simple dashes, line caps and joins.
- Rectangles with compatible corners and complete ellipses stay parametric where their transforms permit it. Other live primitives use their existing path geometry.
- Linear gradients and centered circular radial gradients, including color/opacity stops. Default gradient placement uses actual curve bounds.
- Point text and rectangular area text, fonts/styles, sizes, per-run colors, tracking, leading, baseline shifts, character scaling, variable font axes, manual kerning, and paragraph spacing/indents. Fonts must be installed in both applications.
- A top-level simple clipping group becomes a native mask. Nested clipping and compound clipping boundaries require separate transfers or rasterization.
- Normal groups retain internal shape groups. Split groups become guide null controllers with child parenting. Layer stacking and source coordinates are preserved.
- Placed images transfer as rendered 2× PNGs, including their current transformations. They are not linked back to the original source image.

Each successful import is one EffectCraft undo group. Unsupported editable artwork is checked before layer creation. If construction fails, newly created layers/project items are removed; generated PNG files may remain in the chosen image folder.

## Linked round trips and property updates

The first ordinary VC → EC transfer writes persistent random IDs into VC objects' custom data and the EC layer comments. Subsequent transfers update the same layer and original VC nodes. Names and selection order are not used as identity. Save both documents to retain links across restarts. Keep the source group structure and transfer mode consistent; incompatible structural changes are rejected instead of replacing animated layers.

For artwork created with version 0.3, select its original object/group in VC and its matching layer in EC, then click the chain icon once. This explicit action adopts the existing pair. An unlinked EC layer cannot silently overwrite a VC object or create repeated copies; use Link or Send copy. If duplicating an object also copied its link, use Unlink on the duplicate before transferring it.

Ordinary linked transfers preserve EC layer IDs, names, transforms, parenting, effects, and existing animation. Animated or expression-driven shape properties are skipped, with a status message. Linked return edits native VC geometry, fill, stroke, width, caps, joins, dashes and supported gradients. EC layer and parent movement is not baked into VC design geometry, avoiding doubled transforms on the next send. Shape-group transforms are included. Select a split group controller to return its linked children.

For an intentional animation pose, select a Path, Mask Path, Rectangle, Ellipse, Fill, Stroke, individual property, or containing shape group in EC; select one source object in VC; click the circular-arrow **Update properties** button. Existing animated properties receive a key at the playhead; earlier keys remain. This action updates existing compatible properties rather than creating new paint operators. Shape paths are copied in artboard-relative coordinates; transformed target groups may need adjustment. Expressions remain protected.

**Send copy to VectorCraft** samples the current layer/parent pose and uses SVG placement with an enclosing crop group. Its filled and stroked geometry remains a single editable shape. Copies are intentionally unlinked. Animation is not exported as animation.

Linked return currently supports native paths, compatible live rectangles/ellipses, and groups of these. Text, images, clipping/masks, compound-container returns, structural changes, stacked paints, modifiers and nonuniformly scaled strokes are rejected with a message; use an explicit copy where supported or rasterize. Rotated live rectangles need conversion to paths before establishing the pair. Forward text import remains available; image updates require copies. These limits are checked to avoid silently changing the meaning of artwork.

## Image storage

Set a permanent image folder in the menu, or leave it blank to use **Effect Master Assets** beside the saved EffectCraft project. For an unsaved project, the floating palette uses **Documents/Effect Master Assets**; the optional dockable panel prompts for a folder. Keep these PNGs with your project; EffectCraft footage references them. Asset filenames are unique. Raster and image transfers preserve the VectorCraft selection.

## Current limits

This first public release focuses on editable VectorCraft transfers through a compact floating Windows palette. Compatibility was verified with EffectCraft 0.14.0 and VectorCraft 0.14.0; newer application versions may require adapter updates.

Use Rasterize for patterns, meshes, freeform/elliptical/off-center gradients, custom gradient midpoints, effects, blend modes, opacity masks, variable/brush strokes, arrows, advanced type, or nested clipping. Editable colors must be RGB. Complex appearances can differ between engines even when the basic geometry transfers correctly.

Push currently excludes text, images, effects, masks, track mattes, 3D, skew, repeaters, trim/merge operators and other unsupported shape modifiers. A parent-level mixture of paths and child groups needs separate transfers. Independent gradient opacity-stop positions and multiple dash pairs are not supported.

Precompose uses native full-comp dimensions; it does not trim to artwork bounds or move controller keys onto the precomp layer. Decompose requires a static, unparented, untrimmed 2D precomp at time zero with identity transforms, normal opacity/blending, and no effects/masks/time remapping. It keeps the source composition in the project. Release requires static, unlocked 2D controller and child transforms, with positive uniform controller scale.

The eye button affects timeline shy visibility, not composition overlays. Swatches imports all eligible document colors rather than the source panel's selected swatches. There is no VectorCraft-side dockable extension, auto-updater, native VectorCraft-file import, or PhotoCraft/FigCraft adapter yet. One palette connects to one running instance of each application; instances started with conflicting ports cannot share the same connection.

## Troubleshooting

- **Offline:** after setup, save and restart both apps once. Click the app names in the palette to open them if Windows has not refreshed its environment. The palette never force-closes a running app. A local port already used by another process must be resolved before the app can listen.
- **File/network permission:** enable the EffectCraft setting in step 3. A sandboxed script cannot grant itself access.
- **No composition:** open one, press the new-comp icon, or Shift+Push in the palette (Shift+Pull in the EffectCraft panel).
- **Part of the panel is cut off:** enlarge its dock area or float the tab; it needs approximately 280 × 320 UI pixels.
- **Unsupported artwork:** read the status message and use Rasterize, or simplify the source before pulling.
- **Timeout:** check VectorCraft before retrying. A timed-out command may still finish, so an immediate retry could duplicate the operation.
- **Updated panel still looks old:** close its tab and reopen Window → Effect Master.jsx. Reinstall after rebuilding.

## Development and validation

Run from this folder:

```powershell
./tools/Build-Palette.ps1
node tests/run.mjs
node tests/linked-live.mjs
node tests/palette-live.mjs
node --test tests/linux-bridge.cjs
```

Building requires Node.js and the Windows .NET Framework C# compiler. Tests additionally require both official applications installed in their default Program Files locations. End users do not need Node.js.

The Linux desktop host is in `linux/`. Build its bundled x64 runtime with `node build.mjs` followed by `python tools/package-linux.py`. Python is required only on the packaging machine. See the Linux guide for platform requirements and preview status.

The engine suite covers editable shapes, colors, tangents, text boxes, gradients, masks, normal/split/combine, stacking, grouping, path animation, failure preflight and undo. The palette live test uses **isolated profiles** on ports 17983/19881, with a test-only palette controller on 19882. It clicks the real WinForms controls and exercises both installed desktop apps, launched with no command-line arguments. Do not point these tests at working sessions. Screenshots and results are generated in `tests/palette-live/`. See [validation](docs/VALIDATION.md) for the release check results.

Source modules: `transport.js` (VectorCraft protocol), `vector.js` (geometry/paint), `host.js` (imports), `export.js` (SVG copies/group release), `records.js` (native return geometry), `links.js` (persistent identity and in-place updates), `adapter.js` (UI-independent actions), and `panel.js` (EffectCraft UI). `palette/Bridge.cs` hosts the protocol adapter, `Palette.cs` the Windows UI, and `Installer.cs` per-user installation. `build.mjs` creates the standalone JSX and a core library embedded in the EXE. The Windows C# compiler builds the palette without downloading a runtime.

Installed files: `%LOCALAPPDATA%\EffectMaster`, `%APPDATA%\EffectMaster` (settings, installation receipt, backups), and `%APPDATA%\EffectCraft\Scripts\ScriptUI Panels\Effect Master.jsx`. Use `Uninstall.ps1` to restore connection settings and the prior panel from the receipt. Existing project artwork and image files remain usable.

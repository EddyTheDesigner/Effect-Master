# Effect Master for Linux · 0.4.0 preview

Target: **Ubuntu/Debian desktop, Intel/AMD 64-bit (x86_64)**. This package includes Electron and the same transfer engine used by the Windows release. Node.js, Python, and a separate bridge service are not required to use it. ARM systems are not supported by this download.

**Preview status:** the Linux host has automated protocol tests, but transfers between Linux installations of VectorCraft and EffectCraft have not yet been verified. The 90 Windows checks do not establish Linux compatibility. Use copies of projects when evaluating this preview.

## Install and connect

1. Install the Linux versions of VectorCraft and EffectCraft. The transfer engine was developed against their 0.14.0 APIs.
2. Download **Effect-Master-0.4.0-Linux-x64-preview.tar.gz** from the release and extract it into a permanent folder in your home directory. Keep the entire extracted folder together.
3. Open **effect-master** in the extracted folder. Its executable permission is included in the archive. In file managers that require it, open Properties → Permissions and allow execution.
4. Open the palette's **Settings** menu and choose **Add to applications menu**. This creates a shortcut pointing to the extracted folder; moving that folder later requires adding the shortcut again.
5. In Settings, use **Choose VectorCraft…** and **Choose EffectCraft…** to select the applications' executables or AppImages. This is optional when `vectorcraft` and `effectcraft` are already on PATH.
6. Save and close both apps, then click their names in the palette to open them with their local automation connections enabled. Launch the apps this way for each session. Effect Master does not change your system-wide environment or installed app files.
7. In EffectCraft, enable **Settings → Scripting & Expressions → Allow Scripts to Write Files and Access Network**. Wait for both connection indicators to show a document/composition or “No document”/“No composition.”

An app already running without its connection enabled cannot be reconfigured by opening a second instance. Save and close it first. Ports default to 7979 for VectorCraft and 7978 for EffectCraft and can be changed in Settings.

## Use

- Select VectorCraft artwork and press **↑** to send it to EffectCraft. **Shift+↑** creates a matching composition.
- Subsequent **↑** transfers update linked layers while preserving existing layer animation. Select those layers and press **↓** to update the original VectorCraft shapes and paints.
- The circular arrow updates selected compatible EffectCraft properties; animated properties receive a key at the current playhead.
- The chain links an existing matching object/layer pair. The broken chain unlinks selection in the active app tab. **↑+ / ↓+** explicitly create copies.
- VectorCraft and EffectCraft tabs expose their respective artboard/group controls. Hover icons for descriptions. Settings include accent, button roundness, image folder, and composition defaults.

The editable transfer limits in the main user guide also apply here. Linux does not install the optional EffectCraft dockable panel. Pinning/always-on-top behavior depends on the desktop compositor.

## Desktop requirements and troubleshooting

This is a desktop application, requiring a graphical Ubuntu/Debian session with the standard Chromium/Electron runtime libraries (including GTK 3, NSS, and ALSA). Minimal/server distributions may lack these libraries. Flatpak confinement can prevent launching or connecting to other apps; native packages or AppImages are the intended initial target.

The Chromium sandbox remains enabled. Systems that prohibit unprivileged user namespaces may block startup. This preview does not disable the sandbox or alter system security settings; use a distribution-approved Electron configuration if your desktop blocks it.

If an AppImage cannot launch, confirm it works independently in your file manager and has execution permission. If an operation times out, inspect the destination app before retrying: it may still finish.

## Uninstall

Remove `~/.local/share/applications/effect-master.desktop` (or the corresponding `applications` entry under `XDG_DATA_HOME`) and the extracted package folder. Preferences are stored in Electron's user-config directory under `Effect Master`; remove that folder only if you also want to reset preferences. Your project artwork and generated image assets remain separate.

## Build

Run `node build.mjs`, then `python tools/package-linux.py`. The packager downloads Electron 45.0.0 from the official Electron GitHub release, verifies its published SHA-256 checksum, and preserves Unix executable permissions in the tar archive. Electron's license and Chromium third-party notices are included in the package.

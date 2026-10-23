# Release validation · 0.4.0

The Windows build was tested with official EffectCraft 0.14.0 and VectorCraft 0.14.0 on October 21, 2026 (October 22 UTC).

| Suite | Result |
|---|---|
| Engine regression suite (`node tests/run.mjs`) | 42 assertions passed |
| Persistent-link live suite (`node tests/linked-live.mjs`) | 20 checks passed |
| Windows palette live suite (`node tests/palette-live.mjs`) | 28 checks passed |
| Linux host protocol tests (`node --test tests/linux-bridge.cjs`) | 7 tests passed on Windows |

Windows checks cover editable geometry and paint, linked updates without duplicates, preservation of layer identity and animation, intentional property keyframes, save/reopen persistence, multiple objects, duplicate-link rejection, groups, gradients, undo, real palette button handlers, settings, reconnection, and explicit copies. Native screenshots were visually inspected. The installed executable was compared with the release build using SHA-256.

The Linux preview uses the same transfer engine and a separate Electron desktop host. Its tests cover settings, socket framing and Unicode, request identity, timeout behavior without mutation retries, script construction, application errors, and connection checks. Linux application round trips have not been verified on this Windows development machine. See [Linux installation](LINUX.md).

Generated profiles, artwork, screenshots, and outputs are not committed. Live suites use isolated profiles and ports; do not redirect them to working sessions.

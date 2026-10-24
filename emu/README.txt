Skull-64: the Nintendo 64 television in Deepdelve's Grand Arcade

This folder holds the emulator the TV runs:
  - EmulatorJS 4.2.3 (data/), GPL-3.0, https://github.com/EmulatorJS/EmulatorJS
    (npm: @emulatorjs/emulatorjs@4.2.3). One change: EmulatorJS.checkForUpdates() returns at once,
    so the TV never calls out to the EmulatorJS CDN.
  - the mupen64plus_next libretro core (data/cores/, saved as mupen64plus_next-core.wasm and -legacy-core.wasm: 7z archives, renamed so any static host serves them), GPL-2.0+, https://github.com/EmulatorJS/mupen64plus-libretro-nx
    (npm: @emulatorjs/core-mupen64plus_next@4.2.3), shipped unmodified.
  - tv.html: the small page the game loads in a hidden frame to host the emulator.

The full licence text is in LICENSE-EmulatorJS.txt; the sources are at the links above.

No games are included. Players load ROM files they own from their own computer; the file is read
in the browser and never uploaded. Only the picture, the sound and controller presses are sent
between party members.

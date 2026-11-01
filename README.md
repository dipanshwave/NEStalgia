# NEStalgia

**Play NES games in your browser, living-room style.**

**Live site: <https://dipanshwave.github.io/NEStalgia/>**

Pick a cartridge from the shelf, watch it slide into the console, and the CRT TV tunes in from static to your game. Play with the keyboard, a gamepad, or touch controls on your phone. Bring your own ROMs.

NEStalgia is a static website. Games run on the [jsnes](https://github.com/bfirsh/jsnes) core. There is no build step and no backend. It ships with no games: you load your own ROMs and they stay in your browser, never uploaded.

## Features

- **Cartridge shelf.** Each ROM becomes a coloured cartridge with a pixel icon and a label made from its file name. The shelf is remembered in your browser.
- **Animated cartridge system.** Click a cartridge and it lifts off the shelf, hovers over the console and drops into the bay. Click it again, or press Eject, and it pops out and flies back.
- **3D console and CRT TV.** A chunky graphite console with a power light, Reset and Eject buttons, and a retro TV that shows rolling static until a game is inserted, then tunes in with a power-on flicker.
- **Four screen filters.** Normal, VHS, Sharp and Smooth, cycled with one button.
- **Phone friendly.** The on-screen controller slides up from the bottom when a cartridge goes in (beside the TV when the phone is sideways). Buttons are multi-touch, the D-pad follows your thumb including diagonals, and the phone buzzes on press where supported.
- **Customizable keys.** Click a controller button, press the key you want. Conflicting keys swap. Choices are saved.
- **Gamepad support.** Plug in a pad and press a button.
- **Save states.** One slot per game, plus pause, reset, fullscreen, volume and mute.
- **Drag and drop.** Drop a `.nes` file anywhere on the page.
- **Private by design.** ROMs are stored in your browser's IndexedDB. Nothing is sent to a server.
- **Light and dark themes**, following your system setting, with reduced-motion support.

## How it works

1. **Add a cartridge.** Click the dashed **Load ROM** cartridge on the shelf, or drop a `.nes` file on the page.
2. **Insert it.** Click a cartridge. The power light comes on, the TV tunes and the game starts.
3. **Swap games.** Click the inserted cartridge or press **Eject**. The TV returns to static. Clicking a different cartridge ejects the current one first.
4. **Play on a phone.** The controller appears automatically. The **Eject** button under the TV swaps games.
5. **Play on a computer.** Use the keyboard, a gamepad, or the on-screen controller (mouse or touch).
6. **Remap the keys.** Under the controller, click **Customize keys**, click a button, then press the key you want. Esc cancels, **Reset to defaults** restores the original keys. P and M stay reserved for pause and mute.

The cross under a cartridge removes it from the shelf.

### Screen filters

The **Filter** button under the TV cycles **Normal**, **VHS** (colour fringing, soft picture, a rolling tracking band and the odd wobble), **Sharp** (crisp pixels, light scanlines) and **Smooth** (soft, blended pixels). Your choice is remembered.

## Controls

Default keys (all remappable except pause and mute).

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| D-pad | Arrow keys | D-pad or left stick |
| A | X | Bottom or right button |
| B | Z | Left or top button |
| Start | Enter | Start |
| Select | Shift | Select / Back |
| Pause | P | |
| Mute | M | |

The console has **Reset** and **Eject** buttons. Under the TV you can pause, save and load a state (one slot per game, stored in `localStorage`), change the filter, go fullscreen, and set the volume.

## Run it locally

Open `index.html` in a browser. If your browser is strict about `file://` pages, use a local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

An internet connection is needed the first time for the emulator library and fonts (see "Offline use").

## Project layout

```
index.html        Page markup: logo, TV, shelf, console, controller
css/style.css     Design tokens, light and dark themes, layout, mobile layout
js/main.js        Emulator wiring, TV static, cartridge animation, input, audio
vendor/           Optional local copy of jsnes (see below)
```

## Offline use

`index.html` loads jsnes 1.2.1 from the jsDelivr CDN. If that fails, it falls back to `vendor/jsnes.min.js`. To run with no internet at all, download that file once:

```bash
curl -L -o vendor/jsnes.min.js https://cdn.jsdelivr.net/npm/jsnes@1.2.1/dist/jsnes.min.js
```

Fonts come from Google Fonts. Offline, the page falls back to system fonts.

## Deploying and updating

The site is hosted with GitHub Pages at <https://dipanshwave.github.io/NEStalgia/>. Every push to `main` updates it after a minute or so.

```bash
git add .
git commit -m "Describe what you changed"
git push
```

To host your own copy: fork or clone the repository, open **Settings > Pages**, set **Source** to **Deploy from a branch**, pick `main` and `/ (root)`, and save. Visitors load their own ROMs, which stay in their own browser.

## ROMs and legality

Emulators are legal. Distributing copyrighted games is not. NEStalgia ships with no games, and `.gitignore` blocks `*.nes` so ROMs are not committed by accident. Use homebrew and test ROMs, for example from [nesdev.org](https://www.nesdev.org/wiki/Emulator_tests), or dumps of cartridges you own.

## Known limits

- jsnes does not support every cartridge mapper, so some NES games will not start. The cartridge ejects itself and the page says why.
- Audio uses a script processor node, which browsers have deprecated but still support.
- The cartridge, console, controller and TV artwork is original to this project.

## Support and contact

Made with love by Dipansh. Questions, bugs or ideas: <dipanshshahare557@gmail.com>. If you enjoy it, you can buy me a coffee using the button on the site.

## Credits

- NES core: [jsnes](https://github.com/bfirsh/jsnes). Check its license before redistributing a copy in `vendor/`.
- Fonts: Barlow, Barlow Condensed, IBM Plex Mono and Press Start 2P through Google Fonts.

## License

Add a `LICENSE` file for your own code before you publish. [choosealicense.com](https://choosealicense.com) can help you pick one.

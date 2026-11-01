# NEStalgia

Play NES games in your browser, living-room style. Pick a cartridge from the shelf, watch it slide into the console, and the CRT TV tunes in from static to your game.

NEStalgia is a static website. Games run on the [jsnes](https://github.com/bfirsh/jsnes) core. There is no build step and no backend. It ships with no games: you load your own ROMs and they stay in your browser.

## How it works

1. **Add a cartridge.** Click the dashed **Load ROM** cartridge on the shelf, or drop a ROM anywhere on the page. Each `.nes` file becomes a cartridge with a colour and a label made from its file name.
2. **Insert it.** Click a cartridge. It lifts off the shelf, hovers over the console and drops into the bay. The power light comes on, the TV tunes and the game starts.
3. **Swap games.** Click the inserted cartridge or press **Eject**. It pops up, flies back to the shelf, and the TV returns to static. Clicking a different cartridge ejects the current one first.
4. **Play on a phone.** When a cartridge goes in, the on-screen controller slides up from the bottom (beside the TV when the phone is sideways) and slides away on eject. The buttons multi-touch and buzz on press where the device supports it. The **Eject** button under the TV swaps games.
5. **Play on a computer.** Use the keyboard, a gamepad, or the on-screen controller (mouse or touch). The D-pad follows your thumb, including diagonals.

6. **Remap the keys.** Under the controller, click **Customize keys**. Click a button on the controller (or in the list), then press the key you want. If that key is already used, the two buttons swap. Esc cancels, **Reset to defaults** restores the original keys, and your choices are saved in the browser. P and M stay reserved for pause and mute.

The shelf is remembered in your browser (IndexedDB), so you load each ROM once. The cross under a cartridge removes it.

### Screen filters

The **Filter** button under the TV cycles **Normal**, **VHS** (colour fringing, soft picture, a rolling tracking band and the odd wobble), **Sharp** (crisp pixels, light scanlines) and **Smooth** (soft, blended pixels). Your choice is remembered.

## Run it locally

Open `index.html` in a browser. If your browser is strict about `file://` pages, use a local server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

An internet connection is needed the first time for the emulator library and fonts (see "Offline use").

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

The console has **Reset** and **Eject** buttons. Under the TV you can pause, save and load a state (one slot per game, stored in `localStorage`), go fullscreen, and set the volume.

## Project layout

```
index.html        Page markup: TV, shelf, console, controller
css/style.css     Design tokens, light and dark themes, layout
js/main.js        Emulator wiring, TV static, cartridge animation, input, audio
vendor/           Optional local copy of jsnes (see below)
```

## Offline use

`index.html` loads jsnes 1.2.1 from the jsDelivr CDN. If that fails, it falls back to `vendor/jsnes.min.js`. To run with no internet at all, download that file once:

```bash
curl -L -o vendor/jsnes.min.js https://cdn.jsdelivr.net/npm/jsnes@1.2.1/dist/jsnes.min.js
```

Fonts come from Google Fonts. Offline, the page falls back to system fonts.

## Put it on GitHub and keep updating it

First upload:

```bash
cd nestalgia
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/nestalgia.git
git push -u origin main
```

Create the empty `nestalgia` repository on github.com first. Every later change:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

## Publish it as a website (GitHub Pages)

1. In the repository, open **Settings > Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Pick the `main` branch and the `/ (root)` folder, then save.
4. After a minute the site is live at `https://<your-username>.github.io/nestalgia/`.

Each `git push` to `main` updates the live site. Visitors load their own ROMs, which stay in their own browser.

## ROMs and legality

Emulators are legal. Distributing copyrighted games is not. Do not commit ROMs to this repository (`.gitignore` blocks `*.nes`). Use homebrew and test ROMs, for example from [nesdev.org](https://www.nesdev.org/wiki/Emulator_tests), or dumps of cartridges you own.

## Known limits

- jsnes does not support every cartridge mapper, so some NES games will not start. The cartridge ejects itself and the page says why.
- Audio uses a script processor node, which browsers have deprecated but still support.
- The cartridge, console, controller and TV artwork is original to this project.

## Credits

- NES core: [jsnes](https://github.com/bfirsh/jsnes). Check its license before redistributing a copy in `vendor/`.
- Fonts: Barlow, Barlow Condensed, IBM Plex Mono and Press Start 2P through Google Fonts.

## License

Add a `LICENSE` file for your own code before you publish. [choosealicense.com](https://choosealicense.com) can help you pick one.

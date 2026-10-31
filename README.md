# Ctrl + Wheel Zoom

Hold **Ctrl** (or **⌘** on macOS) and scroll the mouse wheel to zoom the whole
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI.
A small chip at the frame's bottom-right corner reports the current level and
returns to 100% in one click.

![Ctrl + Wheel Zoom icon](icon.svg)

## Features

| Gesture | Result |
|---|---|
| `Ctrl` / `⌘` + wheel | Zoom in/out in 10% steps, 50%–200% |
| `Ctrl` / `⌘` + `+` / `-` | Same from the keyboard |
| `Ctrl` / `⌘` + `0` | Reset to 100% |
| Bottom-right chip | `−` / `+` step the level; clicking the percentage resets |

The level is remembered in the browser (`localStorage`) and restored on the next
page load. The chip appears only while the level is not 100%, so the frame stays
untouched in the default state.

## Install

This is an ordinary DSH **profile bundle**: plain ESM, no build step, no runtime
dependencies. No npm publication is required — install it straight from GitHub.

### From the DSH Plugins page (recommended)

1. Open **Plugins** in the DSH sidebar.
2. Choose **Add plugin**, paste the repository address, and install:

   ```
   https://github.com/jinmuxi1/dsh-ctrl-zoom
   ```

   If the field asks for a Git spec, use
   `git+https://github.com/jinmuxi1/dsh-ctrl-zoom.git`.
3. If the Web UI was already open, refresh the page once (`Ctrl`/`⌘` + `R`).

### From a local checkout

```bash
git clone https://github.com/jinmuxi1/dsh-ctrl-zoom.git
```

Then ask the Harness agent:

```
plugin_manager  action: install_bundle
                target: <absolute path to the cloned directory>
```

### From a tarball

```bash
npm pack
```

```
plugin_manager  action: install_bundle
                target: <absolute path to dsh-ctrl-zoom-1.0.0.tgz>
```

## Uninstall

```
plugin_manager  action: remove_bundle
                target: dsh-ctrl-zoom
```

## Compatibility

- Tested with DeepSeek Harness **0.2.1-rc.2** Web GUI (Electron 44).
- The client half needs a Chromium-based Harness shell. In a non-browser Host it
  is inert.
- No Node dependencies and no install scripts.

## How it works

Zoom is CSS `zoom` on `<html>`. It scales layout, text and fixed overlay layers
together like browser page zoom, while the app's own scroll containers keep
working. A `transform: scale()` wrapper cannot scroll its oversized content, and
a font-size change would only touch text.

The wheel listener runs in the capture phase on `window` and calls
`preventDefault()`, so it sees the gesture before app scroll containers and the
browser's native page zoom does not apply a second, independent level. A gesture
another component has already handled (`event.defaultPrevented`, for example an
embedded editor or map with its own `Ctrl`+wheel zoom) is never stolen.

Everything is registered through `ctx.effect`: unloading the plugin removes the
chip entry, both listeners, the stylesheet and the applied `zoom` property.

## Privacy

The plugin makes no network requests. It reads and writes one `localStorage`
key for the zoom level and applies a CSS `zoom` value to the document element.

## Development

Requires Node.js 22 or newer.

```bash
npm run check
```

`check` runs `node --check` on both halves and validates the manifest, locale
metadata, patch reference and the client module id. GitHub Actions runs the same
command on every push and pull request.

## Files

| File | Role |
|---|---|
| `index.js` | Host half: empty `apply()`; the row lets the plugin manager install/toggle the bundle |
| `client.js` | Browser half: gestures, zoom state, chip registration and stylesheet |
| `cordis.patch.yml` | Loader patch inserting the `dsh-ctrl-zoom` row |
| `locale/{zh,en}.json` | Plugin-card title/description |
| `icon.svg` | Plugin-manager card artwork |
| `scripts/check.mjs` | Local and CI validation |

## License

MIT — see [LICENSE](LICENSE).

## 中文说明

按住 **Ctrl**（macOS 也可用 **⌘**）滚动鼠标滚轮，即可缩放整个 Harness Web
界面：范围 50%–200%，每格 10%。`Ctrl` + `+` / `-` 也能缩放，`Ctrl` + `0`
恢复 100%；右下角比例胶囊支持 `−` / 点击百分比重置 / `+`。比例保存在浏览器
`localStorage`，下次打开页面会自动恢复。

安装：让 Harness 的 Agent 执行
`plugin_manager action: install_bundle target: <本目录绝对路径>`；
如果页面已经打开，刷新一次即可。卸载：
`plugin_manager action: remove_bundle target: dsh-ctrl-zoom`。

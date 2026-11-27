<div align="center">

# Steam Guide Exporter

[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md)
[![Русский](https://img.shields.io/badge/lang-Русский-grey.svg)](README.ru.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Export any Steam Community Guide to Markdown (`.md`) or standalone offline HTML (`.html`) — with or without images.**

[![Install Userscript](https://img.shields.io/badge/Install-Tampermonkey%20%2F%20Violentmonkey-brightgreen?style=for-the-badge)](https://raw.githubusercontent.com/IffyChan/steam-guide-exporter/main/steam-guide-exporter.user.js)

</div>

---

## Features

- **Native Steam UI Integration**: Adds an **Export ▾** button right inside the guide action bar (`#ItemControls`), only on actual Steam Guide pages.
- **Two Image Modes**:
  - **With Images**: Exports the guide cover and all inline images at full resolution (automatically stripping Steam UGC thumbnail resize parameters such as `imw`, `imh`, `letterbox`).
  - **Without Images**: Strips the cover, all `<img>` tags, and `.modalContentLink` image wrappers cleanly with zero broken links.
- **Multiple Formats**:
  - **Markdown (`.md`)** — with full-res image URLs or pure text.
  - **Standalone Offline HTML (`.html`)** — Steam dark-themed single-file HTML; in *With Images* mode, fetches images via `GM_xmlhttpRequest` and embeds them as Base64 `data:` URIs.
  - **Copy to Clipboard** — one-click copy of Markdown with or without images.
- **Full Steam BBCode Support**: Headings (`.bb_h1`–`.bb_h3`), unordered/ordered lists, tables (`.bb_table`, including orphan `.bb_table_th` cells), blockquotes, code blocks, spoilers, video embeds, and safe unwrapping of Steam `linkfilter` URLs.
- **Auto Language Detection**: Switches UI labels automatically between English and Russian based on the Steam page language.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click the **Install Userscript** button above (or open [steam-guide-exporter.user.js](https://raw.githubusercontent.com/IffyChan/steam-guide-exporter/main/steam-guide-exporter.user.js) directly).
3. Open any Steam Community Guide (for example, [Fern's Guide to Robust Botany](https://steamcommunity.com/sharedfiles/filedetails/?id=3443098725)).
4. Click **Export ▾** next to *Favorite* / *Share* and choose your format.

## Development & Testing

Zero external runtime dependencies. Requires Node.js 18+.

```bash
node --check steam-guide-exporter.user.js
node --test test/exporter.test.js
```

## License

[MIT](LICENSE)

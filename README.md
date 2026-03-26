# ggtag UI

Modern web UI for the [ggtag](https://github.com/rgerganov/ggtag) programmable e-paper tag.

![360×240 1-bit e-paper display](https://ggtag.io/ggtag-512x512.png)

## Features

- **Visual canvas editor** — 360×240 pixel preview with WASM rendering
- **Drag & drop images** — drop files directly onto the canvas, auto-converted to 1-bit bitmap
- **Layer management** — reorder, show/hide, delete with drag-and-drop layer list
- **Property editor** — clean form fields for every element type (no raw CSV editing)
- **Canvas dragging** — click and drag to reposition elements directly
- **Program via Sound or Serial** — same ggwave/WebSerial support as original
- **Share URLs** — backward compatible `?i=` parameter format
- **Dark theme** — fits the black & white e-paper aesthetic

## Drawing Primitives

| Type | Parameters |
|------|------------|
| Text | X, Y, size(1-5), text |
| Rect | X, Y, width, height |
| FillRect | X, Y, width, height |
| Circle | X, Y, radius |
| FillCircle | X, Y, radius |
| Line | X1, Y1, X2, Y2 |
| QR code | X, Y, pointWidth, text |
| Image | X, Y, width, height, dither(0\|1), url |
| Icon | X, Y, height, [FA5 name](https://fontawesome.com/v5/search?o=r&m=free&s=solid) |
| RFID | em, mfc_id_hex, uid_hex |

## Setup

1. Copy WASM files from the original repo into `js/`:
   ```
   ggtag.js
   ggtag.wasm
   ggwave.js
   serial.js
   ```

2. Serve with any static file server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

3. Open `http://localhost:8000`

## Deployment

GitHub Pages ready — just push to a `gh-pages` branch or configure GitHub Pages to serve from the root.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete/Backspace | Delete selected element |
| Escape | Deselect / close modal |

## Compatibility

Share URLs use the same `?i=` escape code format as [ggtag.io](https://ggtag.io), so links are fully interchangeable.

## License

MIT

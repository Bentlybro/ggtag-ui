// ── Image processing (WASM bitmap conversion) ──

export function arrToBase64(arr) {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
}

export const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
});

export function loadPNGImage(base64png) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = 'data:image/png;base64,' + base64png;
    });
}

export function imgToBase64Bitmap(img, w, h, dither, canvasWidth, canvasHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    // Fill with white so transparent pixels become white (e-paper background)
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(img, 0, 0, w, h);
    const imgData = tempCtx.getImageData(0, 0, w, h);
    const rgbaArr = imgData.data;
    const rgbaBuf = Module._malloc(rgbaArr.length * rgbaArr.BYTES_PER_ELEMENT);
    if (rgbaBuf === 0) return null;
    Module.HEAPU8.set(rgbaArr, rgbaBuf);
    const bmpPtr = Module.ccall('monoimage', 'number',
        ['number', 'number', 'number', 'number'],
        [rgbaBuf, imgData.width, imgData.height, dither]);
    if (bmpPtr === 0) { Module._free(rgbaBuf); return null; }
    Module._free(rgbaBuf);
    const bmpLength = Math.ceil(w * h / 8);
    const bmp = new Uint8Array(Module.HEAP8.buffer, bmpPtr, bmpLength);
    const b64 = arrToBase64(bmp);
    Module._free(bmpPtr);
    return b64;
}

export async function processImages(input, canvasWidth, canvasHeight) {
    // Process PNGImage (\P)
    while (true) {
        const regex = /\\P(\d+),(\d+),(\d+),(\d+),(\d),([^\\]+)/g;
        const match = regex.exec(input);
        if (!match) break;
        const [full, x, y, w, h, dither, b64] = match;
        const img = await loadPNGImage(b64);
        const fw = w == 0 ? img.width : parseInt(w);
        const fh = h == 0 ? img.height : parseInt(h);
        const bmpB64 = imgToBase64Bitmap(img, fw, fh, parseInt(dither), canvasWidth, canvasHeight);
        input = input.replace(full, `\\i${x},${y},${fw},${fh},${bmpB64}`);
    }
    // Process Image URLs (\I)
    const regex = /\\I(\d+),(\d+),(\d+),(\d+),(\d),([^\\]+)/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
        try {
            const [full, x, y, w, h, dither, url] = match;
            const img = await loadImage(url);
            const fw = w == 0 ? img.width : parseInt(w);
            const fh = h == 0 ? img.height : parseInt(h);
            const bmpB64 = imgToBase64Bitmap(img, fw, fh, parseInt(dither), canvasWidth, canvasHeight);
            input = input.replace(full, `\\i${x},${y},${fw},${fh},${bmpB64}`);
        } catch (e) {
            console.warn('Failed to load image:', match[6]);
        }
    }
    return input;
}

export function getScaledWidthHeight(width, height, maxW, maxH) {
    let nw = width, nh = height;
    if (nw > maxW) { nh = Math.round(nh * maxW / nw); nw = maxW; }
    if (nh > maxH) { nw = Math.round(nw * maxH / nh); nh = maxH; }
    return [nw, nh];
}

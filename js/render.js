import { getInput } from './elements.js';
import { processImages } from './images.js';
import { state } from './state.js';
import { drawOverlay } from './overlay.js';

// ── DOM refs ──
const canvas = document.getElementById('ggCanvas');
const ctx = canvas.getContext('2d');
const errorBanner = document.getElementById('errorBanner');
const errorMsg = document.getElementById('errorMsg');

// ── Non-reentrant repaint ──
let repaintRunning = false;
let repaintQueued = false;

export async function repaint() {
    if (repaintRunning) {
        repaintQueued = true;
        return;
    }
    repaintRunning = true;
    try {
        let inp = getInput(state.elements);
        inp = await processImages(inp, canvas.width, canvas.height);
        render(inp);
        drawOverlay();
        // Update data size
        const data = encodeInput(inp);
        const sizeEl = document.getElementById('dataSize');
        if (data && data.length > 0) {
            sizeEl.textContent = `${data.length} bytes`;
            if (data.length > 256) {
                const dur = Math.ceil(data.length / 33);
                document.getElementById('soundDuration').textContent = `~${dur}s via audio`;
            } else {
                document.getElementById('soundDuration').textContent = 'Transmit via audio';
            }
        } else {
            sizeEl.textContent = '';
        }
    } catch (e) {
        console.warn('Repaint error:', e);
    }
    repaintRunning = false;
    if (repaintQueued) {
        repaintQueued = false;
        repaint();
    }
}

function render(input) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!input || typeof Module === 'undefined' || !Module.ccall) return;

    let ptr;
    try {
        ptr = Module.ccall('render', 'number', ['string', 'number', 'number'], [input, canvas.width, canvas.height]);
    } catch (e) {
        console.warn('WASM render error:', e);
        return;
    }
    const errPtr = Module.ccall('getLastError', 'number', [], []);
    const errStr = Module.UTF8ToString(errPtr);
    if (errStr !== 'OK') {
        errorMsg.textContent = errStr;
        errorBanner.style.display = 'flex';
    } else {
        errorBanner.style.display = 'none';
    }
    if (ptr === 0) return;

    const byteWidth = Math.ceil(canvas.width / 8);
    const totalBytes = byteWidth * canvas.height;
    const buf = new Uint8Array(Module.HEAP8.buffer, ptr, totalBytes);
    const imgData = ctx.createImageData(canvas.width, canvas.height);

    for (let row = 0; row < canvas.height; row++) {
        for (let col = 0; col < canvas.width; col++) {
            const pixel = buf[row * byteWidth + Math.floor(col / 8)] & (0x80 >> (col % 8));
            const offset = (row * canvas.width + col) * 4;
            imgData.data[offset] = imgData.data[offset + 1] = imgData.data[offset + 2] = pixel ? 255 : 0;
            imgData.data[offset + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    Module._free(ptr);
}

export function encodeInput(input) {
    if (typeof Module === 'undefined' || !Module.ccall) return null;
    const lengthPtr = Module._malloc(4);
    const ptr = Module.ccall('encode', 'number', ['string', 'number'], [input, lengthPtr]);
    if (ptr === 0) { Module._free(lengthPtr); return null; }
    const length = Module.getValue(lengthPtr, 'i32');
    Module._free(lengthPtr);
    const data = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
    const result = new Uint8Array(data);
    Module._free(ptr);
    return result;
}

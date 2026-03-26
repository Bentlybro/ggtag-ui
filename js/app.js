// ── ggtag UI — Main entry point ──
// Orchestrates modules: state, elements, rendering, overlay, UI, programming

import { state } from './state.js';
import { createElement, parseElement, splitCommands, getInput, getElementBounds, canResize } from './elements.js';
import { arrToBase64, loadPNGImage, getScaledWidthHeight } from './images.js';
import { repaint } from './render.js';
import { drawOverlay, hitTestHandle, getHandleCursor } from './overlay.js';
import { renderLayers, renderProperties, showToast } from './ui.js';
import { initProgramming } from './programming.js';

const canvas = document.getElementById('ggCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const canvasWrap = document.getElementById('canvasWrap');
const errorBanner = document.getElementById('errorBanner');

// ── Canvas interaction (move + resize) ──
function getCanvasPos(e) {
    if (e.touches && e.touches.length > 0) e = e.touches[0];
    const rect = overlayCanvas.getBoundingClientRect();
    return {
        x: Math.floor(e.clientX - rect.left),
        y: Math.floor(e.clientY - rect.top)
    };
}

function getElementXY(el) {
    if (el.type === 'Line') return { x: el.x1, y: el.y1 };
    if (el.type === 'RFID') return null;
    return { x: el.x, y: el.y };
}

function setElementXY(el, x, y) {
    if (el.type === 'Line') {
        const dx = x - el.x1;
        const dy = y - el.y1;
        el.x1 = x; el.y1 = y;
        el.x2 += dx; el.y2 += dy;
    } else if (el.type === 'RFID') {
        // can't move
    } else {
        el.x = x; el.y = y;
    }
}

function applyResize(el, handle, dx, dy) {
    const d = state.drag;
    switch (el.type) {
        case 'Rect': case 'FillRect':
        case 'Image': case 'PNGImage': case 'BMPImage': {
            let { x, y, w, h } = { x: d.origX, y: d.origY, w: d.origW, h: d.origH };
            if (handle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
            else if (handle === 'tr') { y += dy; w += dx; h -= dy; }
            else if (handle === 'bl') { x += dx; w -= dx; h += dy; }
            else if (handle === 'br') { w += dx; h += dy; }
            el.x = x; el.y = y;
            el.w = Math.max(4, w); el.h = Math.max(4, h);
            break;
        }
        case 'Circle': case 'FillCircle': {
            const dist = Math.max(4, d.origRadius + Math.max(dx, dy));
            el.radius = Math.round(dist);
            break;
        }
        case 'Icon': {
            let h = d.origH;
            if (handle === 'tl') { h -= Math.max(dx, dy); }
            else if (handle === 'br') { h += Math.max(dx, dy); }
            else if (handle === 'tr') { h += Math.max(dx, -dy); }
            else if (handle === 'bl') { h += Math.max(-dx, dy); }
            el.height = Math.max(8, Math.round(h));
            break;
        }
        case 'QR code': {
            let pw = d.origW;
            if (handle === 'br' || handle === 'tr') pw += Math.round(dx / 10);
            else pw -= Math.round(dx / 10);
            el.pointWidth = Math.max(1, Math.min(8, pw));
            break;
        }
    }
}

// ── Canvas mouse/touch handlers ──
overlayCanvas.addEventListener('mousedown', onCanvasDown);
overlayCanvas.addEventListener('touchstart', onCanvasDown, { passive: false });

function onCanvasDown(e) {
    if (e.touches) e.preventDefault();
    const pos = getCanvasPos(e);
    const d = state.drag;

    // Check if hitting a resize handle
    if (state.selectedIndex >= 0 && state.selectedIndex < state.elements.length) {
        const handle = hitTestHandle(pos.x, pos.y);
        if (handle) {
            const el = state.elements[state.selectedIndex];
            Object.assign(d, {
                dragging: true, mode: 'resize', handle,
                startX: pos.x, startY: pos.y,
                origX: el.x !== undefined ? el.x : (el.x1 || 0),
                origY: el.y !== undefined ? el.y : (el.y1 || 0),
                origW: el.type === 'QR code' ? el.pointWidth : (el.w || el.radius || el.height || 0),
                origH: el.h || el.radius || el.height || 0,
                origRadius: el.radius || 0,
            });
            return;
        }
    }

    // Move mode
    if (state.selectedIndex < 0 || state.selectedIndex >= state.elements.length) return;
    const el = state.elements[state.selectedIndex];
    const xy = getElementXY(el);
    if (!xy) return;

    Object.assign(d, {
        dragging: true, mode: 'move', handle: null,
        startX: pos.x, startY: pos.y,
        origX: xy.x, origY: xy.y,
        origW: 0, origH: 0, origRadius: 0,
    });
}

document.addEventListener('mousemove', onCanvasMove);
document.addEventListener('touchmove', onCanvasMove, { passive: false });

overlayCanvas.addEventListener('mousemove', (e) => {
    if (state.drag.dragging) return;
    const pos = getCanvasPos(e);
    overlayCanvas.style.cursor = getHandleCursor(hitTestHandle(pos.x, pos.y));
});

let lastDragRepaint = 0;
function onCanvasMove(e) {
    const d = state.drag;
    if (!d.dragging) return;
    if (e.touches) e.preventDefault();

    const now = performance.now();
    if (now - lastDragRepaint < 30) return;
    lastDragRepaint = now;

    const pos = getCanvasPos(e);
    const dx = pos.x - d.startX;
    const dy = pos.y - d.startY;

    if (d.mode === 'resize') {
        applyResize(state.elements[state.selectedIndex], d.handle, dx, dy);
        renderProperties();
        repaint();
        return;
    }

    let nx = d.origX + dx;
    let ny = d.origY + dy;
    if (nx > canvas.width) nx %= canvas.width;
    else if (nx < 0) nx = canvas.width + nx;
    if (ny > canvas.height) ny %= canvas.height;
    else if (ny < 0) ny = canvas.height + ny;

    setElementXY(state.elements[state.selectedIndex], nx, ny);
    renderProperties();
    repaint();
}

document.addEventListener('mouseup', () => {
    if (state.drag.dragging) {
        state.drag.dragging = false;
        overlayCanvas.style.cursor = 'crosshair';
    }
});
document.addEventListener('touchend', () => { state.drag.dragging = false; });

['touchstart', 'touchend', 'touchmove'].forEach(evt => {
    document.body.addEventListener(evt, (e) => {
        if (e.target === overlayCanvas) e.preventDefault();
    }, { passive: false });
});

// ── Add element buttons ──
document.getElementById('addElementBtns').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    const el = createElement(btn.dataset.type);
    state.elements.push(el);
    state.selectedIndex = state.elements.length - 1;
    renderLayers();
    renderProperties();
    repaint();
});

// ── Image upload (click) ──
document.getElementById('imageUpload').addEventListener('change', (e) => {
    handleImageFiles(e.target.files);
    e.target.value = '';
});

// ── Drag & drop images ──
canvasWrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; canvasWrap.classList.add('drag-active'); });
canvasWrap.addEventListener('dragleave', () => { canvasWrap.classList.remove('drag-active'); });
canvasWrap.addEventListener('drop', (e) => { e.preventDefault(); canvasWrap.classList.remove('drag-active'); if (e.dataTransfer.files.length > 0) handleImageFiles(e.dataTransfer.files); });

const canvasArea = document.getElementById('canvasArea');
canvasArea.addEventListener('dragover', (e) => { e.preventDefault(); canvasWrap.classList.add('drag-active'); });
canvasArea.addEventListener('dragleave', (e) => { if (!canvasArea.contains(e.relatedTarget)) canvasWrap.classList.remove('drag-active'); });
canvasArea.addEventListener('drop', (e) => { e.preventDefault(); canvasWrap.classList.remove('drag-active'); if (e.dataTransfer.files.length > 0) handleImageFiles(e.dataTransfer.files); });

function handleImageFiles(files) {
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const b64 = arrToBase64(data);
            const img = await loadPNGImage(b64);
            const [w, h] = getScaledWidthHeight(img.width, img.height, canvas.width, canvas.height);
            state.elements.push(createElement('PNGImage', { x: 0, y: 0, w, h, dither: 1, base64: b64 }));
            state.selectedIndex = state.elements.length - 1;
            renderLayers();
            renderProperties();
            repaint();
        };
        reader.readAsArrayBuffer(file);
    }
}

// ── Share ──
document.getElementById('shareBtn').addEventListener('click', async () => {
    const inp = getInput(state.elements);
    const url = window.location.origin + window.location.pathname + '?i=' + encodeURIComponent(inp);
    if (navigator.share) {
        try { await navigator.share({ title: 'ggtag', text: 'ggtag', url }); } catch (e) { /* cancelled */ }
    } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
    }
});

// ── Error banner close ──
document.getElementById('errorClose').addEventListener('click', () => { errorBanner.style.display = 'none'; });

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea, select')) {
        if (state.selectedIndex >= 0 && state.selectedIndex < state.elements.length) {
            state.elements.splice(state.selectedIndex, 1);
            if (state.selectedIndex >= state.elements.length) state.selectedIndex = state.elements.length - 1;
            renderLayers();
            renderProperties();
            repaint();
        }
    }
    if (e.key === 'Escape') {
        const programModal = document.getElementById('programModal');
        if (programModal.style.display !== 'none') { programModal.style.display = 'none'; return; }
        state.selectedIndex = -1;
        renderLayers();
        renderProperties();
        drawOverlay();
    }
});

// ── Init programming UI ──
initProgramming();

// ── WASM init + URL import ──
function onWasmReady() {
    const params = new URLSearchParams(window.location.search);
    const input = params.get('i');
    if (input) {
        splitCommands(input).forEach(cmd => {
            const el = parseElement(cmd);
            if (el) state.elements.push(el);
        });
    }
    if (params.get('d')) Module.ccall('debugEnable', null, ['number'], [1]);
    if (state.elements.length === 0) {
        state.elements.push(createElement('Text', { x: 10, y: 10, size: 3, text: 'Hello world' }));
    }
    state.selectedIndex = 0;
    renderLayers();
    renderProperties();
    repaint();
}

if (typeof Module !== 'undefined') {
    // Module might already be initialized (type="module" scripts are deferred)
    if (Module.calledRun) {
        onWasmReady();
    } else {
        Module['onRuntimeInitialized'] = onWasmReady;
    }
}

"use strict";

// ── Escape code mappings (same as original) ──
const ESC2CMD = {
    "\\t": "Text", "\\r": "Rect", "\\R": "FillRect",
    "\\c": "Circle", "\\C": "FillCircle", "\\l": "Line",
    "\\q": "QR code", "\\I": "Image", "\\P": "PNGImage",
    "\\i": "BMPImage", "\\a": "Icon", "\\f": "RFID"
};
const CMD2ESC = {
    "Text": "\\t", "Rect": "\\r", "FillRect": "\\R",
    "Circle": "\\c", "FillCircle": "\\C", "Line": "\\l",
    "QR code": "\\q", "Image": "\\I", "PNGImage": "\\P",
    "BMPImage": "\\i", "Icon": "\\a", "RFID": "\\f"
};

// Type icons for layer list
const TYPE_ICONS = {
    "Text": "fa-font", "Rect": "fa-square", "FillRect": "fa-square",
    "Circle": "fa-circle", "FillCircle": "fa-circle",
    "Line": "fa-minus", "QR code": "fa-qrcode", "Image": "fa-image",
    "PNGImage": "fa-image", "BMPImage": "fa-image",
    "Icon": "fa-icons", "RFID": "fa-wifi"
};
const TYPE_ICON_STYLE = {
    "Rect": "far", "Circle": "far"
};

// ── State ──
let elements = [];
let selectedIndex = -1;
let dragState = { dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 };
let layerDragIndex = -1;

// ── DOM refs ──
const canvas = document.getElementById('ggCanvas');
const ctx = canvas.getContext('2d');
const layerList = document.getElementById('layerList');
const propertiesContent = document.getElementById('propertiesContent');
const errorBanner = document.getElementById('errorBanner');
const errorMsg = document.getElementById('errorMsg');
const canvasWrap = document.getElementById('canvasWrap');
const toast = document.getElementById('toast');

// ── Element factory ──
function createElement(type, params) {
    const el = { type, visible: true, ...params };
    // Set defaults if not provided
    if (!params) {
        switch (type) {
            case 'Text':
                Object.assign(el, { x: 10, y: 10, size: 3, text: 'Hello' });
                break;
            case 'Rect': case 'FillRect':
                Object.assign(el, { x: 20, y: 20, w: 80, h: 50 });
                break;
            case 'Circle': case 'FillCircle':
                Object.assign(el, { x: 60, y: 60, radius: 30 });
                break;
            case 'Line':
                Object.assign(el, { x1: 10, y1: 10, x2: 100, y2: 80 });
                break;
            case 'QR code':
                Object.assign(el, { x: 10, y: 10, pointWidth: 3, text: 'ggtag' });
                break;
            case 'Image':
                Object.assign(el, { x: 0, y: 0, w: 0, h: 0, dither: 1, url: 'https://ggtag.io/mario.png' });
                break;
            case 'Icon':
                Object.assign(el, { x: 10, y: 10, height: 32, name: 'car-side' });
                break;
            case 'RFID':
                Object.assign(el, { em: 'em', mfcId: '12', uid: '3456789A' });
                break;
        }
    }
    return el;
}

// ── Serialization (element → escape code string segment) ──
function elementToEsc(el) {
    if (!el.visible) return '';
    const esc = CMD2ESC[el.type];
    if (!esc) return '';
    let val = '';
    switch (el.type) {
        case 'Text':
            val = `${el.x},${el.y},${el.size},${(el.text || '').replace(/\\/g, '\\\\')}`;
            break;
        case 'Rect': case 'FillRect':
            val = `${el.x},${el.y},${el.w},${el.h}`;
            break;
        case 'Circle': case 'FillCircle':
            val = `${el.x},${el.y},${el.radius}`;
            break;
        case 'Line':
            val = `${el.x1},${el.y1},${el.x2},${el.y2}`;
            break;
        case 'QR code':
            val = `${el.x},${el.y},${el.pointWidth},${(el.text || '').replace(/\\/g, '\\\\')}`;
            break;
        case 'Image':
            val = `${el.x},${el.y},${el.w},${el.h},${el.dither},${el.url}`;
            break;
        case 'PNGImage':
            val = `${el.x},${el.y},${el.w},${el.h},${el.dither},${el.base64}`;
            break;
        case 'BMPImage':
            val = `${el.x},${el.y},${el.w},${el.h},${el.base64}`;
            break;
        case 'Icon':
            val = `${el.x},${el.y},${el.height},${el.name}`;
            break;
        case 'RFID':
            val = `${el.em},${el.mfcId},${el.uid}`;
            break;
    }
    return esc + val;
}

function getInput() {
    return elements.map(elementToEsc).join('');
}

// ── Parse escape code string → elements ──
function splitCommands(input) {
    const cmds = [];
    let lastIdx = 0;
    for (let i = 1; i < input.length - 1; i++) {
        if (input[i] === '\\') {
            if (input[i + 1] !== '\\') {
                cmds.push(input.substring(lastIdx, i));
                lastIdx = i;
            } else {
                i++;
            }
        }
    }
    cmds.push(input.substring(lastIdx));
    return cmds;
}

function parseElement(escCmd) {
    const esc = escCmd.substring(0, 2);
    const type = ESC2CMD[esc];
    if (!type) return null;
    const raw = escCmd.substring(2);
    const val = raw.replace(/\\\\/g, '\\');
    const parts = raw.split(',');

    switch (type) {
        case 'Text':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                size: int(parts[2]), text: parts.slice(3).join(',').replace(/\\\\/g, '\\')
            });
        case 'Rect': case 'FillRect':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                w: int(parts[2]), h: int(parts[3])
            });
        case 'Circle': case 'FillCircle':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]), radius: int(parts[2])
            });
        case 'Line':
            return createElement(type, {
                x1: int(parts[0]), y1: int(parts[1]),
                x2: int(parts[2]), y2: int(parts[3])
            });
        case 'QR code':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                pointWidth: int(parts[2]), text: parts.slice(3).join(',').replace(/\\\\/g, '\\')
            });
        case 'Image':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                w: int(parts[2]), h: int(parts[3]),
                dither: int(parts[4]), url: parts.slice(5).join(',')
            });
        case 'PNGImage':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                w: int(parts[2]), h: int(parts[3]),
                dither: int(parts[4]), base64: parts.slice(5).join(',')
            });
        case 'BMPImage':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                w: int(parts[2]), h: int(parts[3]),
                base64: parts.slice(4).join(',')
            });
        case 'Icon':
            return createElement(type, {
                x: int(parts[0]), y: int(parts[1]),
                height: int(parts[2]), name: parts.slice(3).join(',')
            });
        case 'RFID':
            return createElement(type, {
                em: parts[0], mfcId: parts[1], uid: parts[2]
            });
    }
    return null;
}

function int(v) { return parseInt(v, 10) || 0; }

// ── Image processing (from original, adapted) ──
function arrToBase64(arr) {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
}

const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
});

async function loadPNGImage(base64png) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = 'data:image/png;base64,' + base64png;
    });
}

function imgToBase64Bitmap(img, w, h, dither) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, w, h);
    const imgData = tempCtx.getImageData(0, 0, w, h);
    const rgbaArr = imgData.data;
    const rgbaBuf = Module._malloc(rgbaArr.length * rgbaArr.BYTES_PER_ELEMENT);
    if (rgbaBuf === 0) return null;
    Module.HEAPU8.set(rgbaArr, rgbaBuf);
    const bmpPtr = Module.ccall('monoimage', 'number', ['number', 'number', 'number', 'number'], [rgbaBuf, imgData.width, imgData.height, dither]);
    if (bmpPtr === 0) { Module._free(rgbaBuf); return null; }
    Module._free(rgbaBuf);
    const bmpLength = Math.ceil(w * h / 8);
    const bmp = new Uint8Array(Module.HEAP8.buffer, bmpPtr, bmpLength);
    const b64 = arrToBase64(bmp);
    Module._free(bmpPtr);
    return b64;
}

async function processImages(input) {
    // Process PNGImage (\P)
    while (true) {
        const regex = /\\P(\d+),(\d+),(\d+),(\d+),(\d),([^\\]+)/g;
        const match = regex.exec(input);
        if (!match) break;
        const [full, x, y, w, h, dither, b64] = match;
        const img = await loadPNGImage(b64);
        const fw = w == 0 ? img.width : parseInt(w);
        const fh = h == 0 ? img.height : parseInt(h);
        const bmpB64 = imgToBase64Bitmap(img, fw, fh, parseInt(dither));
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
            const bmpB64 = imgToBase64Bitmap(img, fw, fh, parseInt(dither));
            input = input.replace(full, `\\i${x},${y},${fw},${fh},${bmpB64}`);
        } catch (e) {
            console.warn('Failed to load image:', match[6]);
        }
    }
    return input;
}

function getScaledWidthHeight(width, height, maxW, maxH) {
    let nw = width, nh = height;
    if (nw > maxW) { nh = Math.round(nh * maxW / nw); nw = maxW; }
    if (nh > maxH) { nw = Math.round(nw * maxH / nh); nh = maxH; }
    return [nw, nh];
}

// ── Render ──
let repaintRunning = false;
let repaintQueued = false;

async function repaint() {
    if (repaintRunning) {
        repaintQueued = true;
        return;
    }
    repaintRunning = true;
    try {
        let inp = getInput();
        inp = await processImages(inp);
        render(inp);
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

function encodeInput(input) {
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

// ── Layer list rendering ──
function renderLayers() {
    layerList.innerHTML = '';
    elements.forEach((el, i) => {
        const item = document.createElement('div');
        item.className = 'layer-item' + (i === selectedIndex ? ' selected' : '');
        item.draggable = true;
        item.dataset.index = i;

        const iconClass = TYPE_ICON_STYLE[el.type] || 'fas';
        const icon = TYPE_ICONS[el.type] || 'fa-question';
        const summary = getElementSummary(el);

        item.innerHTML = `
            <span class="layer-drag-handle"><i class="fas fa-grip-vertical"></i></span>
            <span class="layer-icon"><i class="${iconClass} ${icon}"></i></span>
            <span class="layer-name">${el.type}</span>
            <span class="layer-summary">${summary}</span>
            <span class="layer-actions">
                <button class="layer-action-btn visibility ${el.visible ? '' : 'hidden-layer'}" data-index="${i}" title="Toggle visibility">
                    <i class="fas ${el.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="layer-action-btn delete" data-index="${i}" title="Delete">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </span>
        `;

        // Click to select
        item.addEventListener('click', (e) => {
            if (e.target.closest('.layer-action-btn')) return;
            selectedIndex = i;
            renderLayers();
            renderProperties();
        });

        // Drag reorder
        item.addEventListener('dragstart', (e) => {
            layerDragIndex = i;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            layerDragIndex = -1;
            document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (layerDragIndex === -1) return;
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            if (layerDragIndex === -1 || layerDragIndex === i) return;
            const moved = elements.splice(layerDragIndex, 1)[0];
            elements.splice(i, 0, moved);
            if (selectedIndex === layerDragIndex) selectedIndex = i;
            else if (selectedIndex > layerDragIndex && selectedIndex <= i) selectedIndex--;
            else if (selectedIndex < layerDragIndex && selectedIndex >= i) selectedIndex++;
            layerDragIndex = -1;
            renderLayers();
            renderProperties();
            repaint();
        });

        layerList.appendChild(item);
    });

    // Visibility / delete button handlers
    layerList.querySelectorAll('.visibility').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            elements[idx].visible = !elements[idx].visible;
            renderLayers();
            repaint();
        });
    });
    layerList.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            elements.splice(idx, 1);
            if (selectedIndex >= elements.length) selectedIndex = elements.length - 1;
            if (selectedIndex === idx) selectedIndex = -1;
            else if (selectedIndex > idx) selectedIndex--;
            renderLayers();
            renderProperties();
            repaint();
        });
    });
}

function getElementSummary(el) {
    switch (el.type) {
        case 'Text': return el.text || '';
        case 'Rect': case 'FillRect': return `${el.w}×${el.h}`;
        case 'Circle': case 'FillCircle': return `r=${el.radius}`;
        case 'Line': return `→`;
        case 'QR code': return el.text || '';
        case 'Image': return 'URL';
        case 'PNGImage': case 'BMPImage': return 'bitmap';
        case 'Icon': return el.name || '';
        case 'RFID': return el.uid || '';
        default: return '';
    }
}

// ── Properties panel ──
function renderProperties() {
    if (selectedIndex < 0 || selectedIndex >= elements.length) {
        propertiesContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mouse-pointer"></i>
                <p>Select a layer to edit its properties</p>
            </div>`;
        return;
    }

    const el = elements[selectedIndex];
    const iconClass = TYPE_ICON_STYLE[el.type] || 'fas';
    const icon = TYPE_ICONS[el.type] || 'fa-question';

    let html = `<div class="prop-type-badge"><i class="${iconClass} ${icon}"></i> ${el.type}</div>`;

    switch (el.type) {
        case 'Text':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Text', [
                propRow('Size', `<select class="prop-select" data-prop="size">
                    ${[1,2,3,4,5].map(s => `<option value="${s}" ${el.size==s?'selected':''}>${s}</option>`).join('')}
                </select>`),
                propRow('Text', `<input class="prop-input" data-prop="text" value="${escHtml(el.text || '')}">`),
            ]);
            break;

        case 'Rect': case 'FillRect':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Size', [
                propRow('W', numInput('w', el.w)),
                propRow('H', numInput('h', el.h)),
            ]);
            break;

        case 'Circle': case 'FillCircle':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Size', [
                propRow('Radius', numInput('radius', el.radius)),
            ]);
            break;

        case 'Line':
            html += propGroup('Start Point', [
                propRow('X1', numInput('x1', el.x1)),
                propRow('Y1', numInput('y1', el.y1)),
            ]);
            html += propGroup('End Point', [
                propRow('X2', numInput('x2', el.x2)),
                propRow('Y2', numInput('y2', el.y2)),
            ]);
            break;

        case 'QR code':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('QR Code', [
                propRow('Size', numInput('pointWidth', el.pointWidth)),
                propRow('Text', `<input class="prop-input" data-prop="text" value="${escHtml(el.text || '')}">`),
            ]);
            break;

        case 'Image':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Size', [
                propRow('W', numInput('w', el.w) + ' <small style="color:var(--text-muted)">0=auto</small>'),
                propRow('H', numInput('h', el.h) + ' <small style="color:var(--text-muted)">0=auto</small>'),
            ]);
            html += propGroup('Image', [
                propRow('Dither', `<select class="prop-select" data-prop="dither">
                    <option value="0" ${el.dither==0?'selected':''}>Off</option>
                    <option value="1" ${el.dither==1?'selected':''}>On</option>
                </select>`),
                propRow('URL', `<input class="prop-input" data-prop="url" value="${escHtml(el.url || '')}" placeholder="https://...">`),
            ]);
            break;

        case 'PNGImage':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Size', [
                propRow('W', numInput('w', el.w)),
                propRow('H', numInput('h', el.h)),
            ]);
            html += propGroup('Image', [
                propRow('Dither', `<select class="prop-select" data-prop="dither">
                    <option value="0" ${el.dither==0?'selected':''}>Off</option>
                    <option value="1" ${el.dither==1?'selected':''}>On</option>
                </select>`),
                `<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Embedded PNG (${el.base64 ? Math.round(el.base64.length/1024) + 'KB' : '?'})</div>`,
            ]);
            break;

        case 'BMPImage':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Size', [
                propRow('W', numInput('w', el.w)),
                propRow('H', numInput('h', el.h)),
            ]);
            html += `<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Embedded 1-bit bitmap</div>`;
            break;

        case 'Icon':
            html += propGroup('Position', [
                propRow('X', numInput('x', el.x)),
                propRow('Y', numInput('y', el.y)),
            ]);
            html += propGroup('Icon', [
                propRow('Height', numInput('height', el.height)),
                propRow('Name', `<input class="prop-input" data-prop="name" value="${escHtml(el.name || '')}" placeholder="car-side">`),
            ]);
            html += `<div style="font-size:11px;padding:4px 0"><a href="https://fontawesome.com/v5/search?o=r&m=free&s=solid" target="_blank" style="color:var(--accent)">Browse icons ↗</a></div>`;
            break;

        case 'RFID':
            html += propGroup('RFID', [
                propRow('EM', `<input class="prop-input" data-prop="em" value="${escHtml(el.em || '')}">`),
                propRow('MFC ID', `<input class="prop-input" data-prop="mfcId" value="${escHtml(el.mfcId || '')}">`),
                propRow('UID', `<input class="prop-input" data-prop="uid" value="${escHtml(el.uid || '')}">`),
            ]);
            break;
    }

    propertiesContent.innerHTML = html;

    // Bind property change handlers
    propertiesContent.querySelectorAll('[data-prop]').forEach(input => {
        const handler = () => {
            const prop = input.dataset.prop;
            const el = elements[selectedIndex];
            if (!el) return;
            if (input.type === 'number') {
                el[prop] = parseInt(input.value, 10) || 0;
            } else if (input.tagName === 'SELECT') {
                el[prop] = isNaN(input.value) ? input.value : parseInt(input.value);
            } else {
                el[prop] = input.value;
            }
            renderLayers();
            repaint();
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
}

function propGroup(title, rows) {
    return `<div class="prop-group">
        <div class="prop-group-title">${title}</div>
        ${rows.join('')}
    </div>`;
}

function propRow(label, inputHtml) {
    return `<div class="prop-row">
        <span class="prop-label">${label}</span>
        ${inputHtml}
    </div>`;
}

function numInput(prop, value) {
    return `<input type="number" class="prop-input prop-input-sm" data-prop="${prop}" value="${value}">`;
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Canvas drag to reposition ──
function getCanvasPos(e) {
    if (e.touches && e.touches.length > 0) e = e.touches[0];
    const rect = canvas.getBoundingClientRect();
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

canvas.addEventListener('mousedown', onCanvasDown);
canvas.addEventListener('touchstart', onCanvasDown, { passive: false });

function onCanvasDown(e) {
    if (e.touches) e.preventDefault();
    if (selectedIndex < 0 || selectedIndex >= elements.length) return;
    const el = elements[selectedIndex];
    const pos = getCanvasPos(e);
    const xy = getElementXY(el);
    if (!xy) return;

    dragState = {
        dragging: true,
        startX: pos.x, startY: pos.y,
        origX: xy.x, origY: xy.y
    };
}

document.addEventListener('mousemove', onCanvasMove);
document.addEventListener('touchmove', onCanvasMove, { passive: false });

let lastDragRepaint = 0;
function onCanvasMove(e) {
    if (!dragState.dragging) return;
    if (e.touches) e.preventDefault();

    const now = performance.now();
    if (now - lastDragRepaint < 30) return; // ~33fps max during drag
    lastDragRepaint = now;

    const pos = getCanvasPos(e);
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;
    let nx = dragState.origX + dx;
    let ny = dragState.origY + dy;
    // Wrap
    if (nx > canvas.width) nx %= canvas.width;
    else if (nx < 0) nx = canvas.width + nx;
    if (ny > canvas.height) ny %= canvas.height;
    else if (ny < 0) ny = canvas.height + ny;

    setElementXY(elements[selectedIndex], nx, ny);
    renderProperties();
    repaint();
}

document.addEventListener('mouseup', onCanvasUp);
document.addEventListener('touchend', onCanvasUp);

function onCanvasUp() {
    dragState.dragging = false;
}

// Prevent scroll on canvas touch
['touchstart', 'touchend', 'touchmove'].forEach(evt => {
    document.body.addEventListener(evt, (e) => {
        if (e.target === canvas) e.preventDefault();
    }, { passive: false });
});

// ── Add element buttons ──
document.getElementById('addElementBtns').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    const type = btn.dataset.type;
    const el = createElement(type);
    elements.push(el);
    selectedIndex = elements.length - 1;
    renderLayers();
    renderProperties();
    repaint();
});

// ── Image upload (click) ──
document.getElementById('imageUpload').addEventListener('change', (e) => {
    handleImageFiles(e.target.files);
    e.target.value = '';
});

// ── Drag & drop images onto canvas ──
canvasWrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvasWrap.classList.add('drag-active');
});
canvasWrap.addEventListener('dragleave', () => {
    canvasWrap.classList.remove('drag-active');
});
canvasWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasWrap.classList.remove('drag-active');
    if (e.dataTransfer.files.length > 0) {
        handleImageFiles(e.dataTransfer.files);
    }
});

// Also allow dropping anywhere in the canvas area
const canvasArea = document.getElementById('canvasArea');
canvasArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvasWrap.classList.add('drag-active');
});
canvasArea.addEventListener('dragleave', (e) => {
    if (!canvasArea.contains(e.relatedTarget)) {
        canvasWrap.classList.remove('drag-active');
    }
});
canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasWrap.classList.remove('drag-active');
    if (e.dataTransfer.files.length > 0) {
        handleImageFiles(e.dataTransfer.files);
    }
});

function handleImageFiles(files) {
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const b64 = arrToBase64(data);
            const img = await loadPNGImage(b64);
            const [w, h] = getScaledWidthHeight(img.width, img.height, canvas.width, canvas.height);
            const el = createElement('PNGImage', {
                x: 0, y: 0, w, h, dither: 1, base64: b64
            });
            elements.push(el);
            selectedIndex = elements.length - 1;
            renderLayers();
            renderProperties();
            repaint();
        };
        reader.readAsArrayBuffer(file);
    }
}

// ── Share ──
document.getElementById('shareBtn').addEventListener('click', async () => {
    const inp = getInput();
    const url = window.location.origin + window.location.pathname + '?i=' + encodeURIComponent(inp);
    if (navigator.share) {
        try {
            await navigator.share({ title: 'ggtag', text: 'ggtag', url });
        } catch (e) { /* cancelled */ }
    } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
    }
});

// ── Program ──
const programModal = document.getElementById('programModal');
const programStatus = document.getElementById('programStatus');
const programOptions = document.querySelector('.program-options');
const programStatusText = document.getElementById('programStatusText');

document.getElementById('programBtn').addEventListener('click', () => {
    programModal.style.display = 'flex';
    programStatus.style.display = 'none';
    programOptions.style.display = 'flex';
});

document.getElementById('programModalClose').addEventListener('click', () => {
    programModal.style.display = 'none';
});

programModal.addEventListener('click', (e) => {
    if (e.target === programModal) programModal.style.display = 'none';
});

document.getElementById('progSound').addEventListener('click', () => doProgramming('sound'));
document.getElementById('progSerial').addEventListener('click', () => doProgramming('serial'));

async function doProgramming(method) {
    programOptions.style.display = 'none';
    programStatus.style.display = 'flex';
    programStatusText.textContent = 'Programming...';

    try {
        let inp = getInput();
        inp = await processImages(inp);
        if (method === 'serial') {
            await programSerial(inp);
        } else {
            await programSound(inp);
        }
        programStatusText.textContent = '✓ Done!';
        document.querySelector('.spinner').style.display = 'none';
        setTimeout(() => { programModal.style.display = 'none'; }, 1200);
    } catch (e) {
        programStatusText.textContent = 'Error: ' + e;
        document.querySelector('.spinner').style.display = 'none';
        setTimeout(() => {
            programStatus.style.display = 'none';
            programOptions.style.display = 'flex';
            document.querySelector('.spinner').style.display = '';
        }, 3000);
    }
}

// ── Serial programming (from original) ──
async function readSerialOutput(port) {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    let result = false;
    try {
        while (true) {
            const timerId = setTimeout(() => reader.cancel(), 10000);
            const { value, done } = await reader.read();
            clearTimeout(timerId);
            if (done) break;
            if (value && value.startsWith('Done.')) {
                result = true;
                reader.cancel();
                break;
            }
        }
    } catch (e) {
        // Reader cancelled on timeout — that's fine, data was already sent
    }
    reader.releaseLock();
    await readableStreamClosed.catch(() => {});
    return result;
}

async function programSerial(input) {
    const data = encodeInput(input);
    if (!data) throw 'Failed to encode input';
    let port;
    if ('serial' in navigator) {
        port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x2e8a, usbProductId: 0x000a }] });
    } else {
        port = await exports.serial.requestPort();
    }
    await port.open({ baudRate: 115200 });
    const closedPromise = readSerialOutput(port);
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    // Wait for "Done." or timeout — either way programming is complete once data is written
    await closedPromise;
    try { await port.close(); } catch(e) { /* port may already be closed */ }
}

// ── Sound programming (from original) ──
let ggwave = null;
let audioContext = null;
let ggwaveInstance = null;

if (typeof ggwave_factory !== 'undefined') {
    ggwave_factory().then(obj => { ggwave = obj; });
}

async function programSound(input) {
    const data = encodeInput(input);
    if (!data) throw 'Failed to encode input';

    if (!audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw 'Web Audio API not supported';
        audioContext = new AC({ sampleRate: 48000 });
        const params = ggwave.getDefaultParameters();
        params.payloadLength = 16;
        params.sampleRateInp = audioContext.sampleRate;
        params.sampleRateOut = audioContext.sampleRate;
        params.operatingMode = ggwave.GGWAVE_OPERATING_MODE_TX | ggwave.GGWAVE_OPERATING_MODE_USE_DSS;
        ggwaveInstance = ggwave.init(params);
    }

    return new Promise((resolve) => {
        let offset = 0;
        const tx = () => {
            if (offset < data.length) {
                const waveform = ggwave.encode(ggwaveInstance, data.slice(offset, offset + 16), ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST, 10);
                const buf = new Float32Array(waveform.buffer, waveform.byteOffset, waveform.length / Float32Array.BYTES_PER_ELEMENT);
                const buffer = audioContext.createBuffer(1, buf.length, audioContext.sampleRate);
                buffer.getChannelData(0).set(buf);
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.addEventListener('ended', tx);
                source.start(0);
                offset += 16;
            } else {
                resolve();
            }
        };
        tx();
    });
}

// ── Error banner close ──
document.getElementById('errorClose').addEventListener('click', () => {
    errorBanner.style.display = 'none';
});

// ── Toast ──
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── URL import + WASM init ──
if (typeof Module !== 'undefined') {
    Module['onRuntimeInitialized'] = () => {
        const params = new URLSearchParams(window.location.search);
        const input = params.get('i');
        if (input) {
            const cmds = splitCommands(input);
            cmds.forEach(cmd => {
                const el = parseElement(cmd);
                if (el) elements.push(el);
            });
        }
        if (params.get('d')) {
            Module.ccall('debugEnable', null, ['number'], [1]);
        }
        // If no elements from URL, add a default
        if (elements.length === 0) {
            elements.push(createElement('Text', { x: 10, y: 10, size: 3, text: 'Hello world' }));
        }
        selectedIndex = 0;
        renderLayers();
        renderProperties();
        repaint();
    };
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
    // Delete selected element
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea, select')) {
        if (selectedIndex >= 0 && selectedIndex < elements.length) {
            elements.splice(selectedIndex, 1);
            if (selectedIndex >= elements.length) selectedIndex = elements.length - 1;
            renderLayers();
            renderProperties();
            repaint();
        }
    }
    // Escape to deselect
    if (e.key === 'Escape') {
        // Close modal if open
        if (programModal.style.display !== 'none') {
            programModal.style.display = 'none';
            return;
        }
        selectedIndex = -1;
        renderLayers();
        renderProperties();
    }
});

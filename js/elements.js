import { ESC2CMD, CMD2ESC } from './constants.js';

// ── Element factory ──
export function createElement(type, params) {
    const el = { type, visible: true, ...params };
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
export function elementToEsc(el) {
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

export function getInput(elements) {
    return elements.map(elementToEsc).join('');
}

// ── Parse escape code string → elements ──
export function splitCommands(input) {
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

export function parseElement(escCmd) {
    const esc = escCmd.substring(0, 2);
    const type = ESC2CMD[esc];
    if (!type) return null;
    const raw = escCmd.substring(2);
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

// ── Bounding box helpers ──
export function getElementBounds(el) {
    switch (el.type) {
        case 'Text': {
            const charW = el.size * 6;
            const textH = el.size * 8 + 4;
            return { x: el.x, y: el.y, w: (el.text || '').length * charW, h: textH };
        }
        case 'Rect': case 'FillRect':
            return { x: el.x, y: el.y, w: el.w, h: el.h };
        case 'Circle': case 'FillCircle':
            return { x: el.x - el.radius, y: el.y - el.radius, w: el.radius * 2, h: el.radius * 2 };
        case 'Line': {
            const lx = Math.min(el.x1, el.x2), ly = Math.min(el.y1, el.y2);
            return { x: lx, y: ly, w: Math.abs(el.x2 - el.x1) || 4, h: Math.abs(el.y2 - el.y1) || 4 };
        }
        case 'QR code': {
            const qrSize = el.pointWidth * 25;
            return { x: el.x, y: el.y, w: qrSize, h: qrSize };
        }
        case 'Image':
            return { x: el.x, y: el.y, w: el.w || 80, h: el.h || 80 };
        case 'PNGImage': case 'BMPImage':
            return { x: el.x, y: el.y, w: el.w || 80, h: el.h || 80 };
        case 'Icon':
            return { x: el.x, y: el.y, w: el.height, h: el.height };
        default:
            return null;
    }
}

export function getElementSummary(el) {
    switch (el.type) {
        case 'Text': return el.text || '';
        case 'Rect': case 'FillRect': return `${el.w}×${el.h}`;
        case 'Circle': case 'FillCircle': return `r=${el.radius}`;
        case 'Line': return '→';
        case 'QR code': return el.text || '';
        case 'Image': return 'URL';
        case 'PNGImage': case 'BMPImage': return 'bitmap';
        case 'Icon': return el.name || '';
        case 'RFID': return el.uid || '';
        default: return '';
    }
}

export function canResize(el) {
    return ['Rect', 'FillRect', 'Circle', 'FillCircle', 'Image', 'PNGImage', 'BMPImage', 'Icon', 'QR code'].includes(el.type);
}

import { HANDLE_SIZE } from './constants.js';
import { getElementBounds, canResize } from './elements.js';
import { state } from './state.js';

const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

export function drawOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (state.selectedIndex < 0 || state.selectedIndex >= state.elements.length) return;
    const el = state.elements[state.selectedIndex];
    if (!el.visible) return;
    const bounds = getElementBounds(el);
    if (!bounds) return;

    const { x, y, w, h } = bounds;

    // Draw bounding box
    overlayCtx.strokeStyle = '#6c8cff';
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([4, 3]);
    overlayCtx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    overlayCtx.setLineDash([]);

    // Draw resize handles (corners)
    if (canResize(el)) {
        const handles = getHandlePositions(x, y, w, h);
        overlayCtx.fillStyle = '#6c8cff';
        overlayCtx.strokeStyle = '#1e2028';
        overlayCtx.lineWidth = 1;
        for (const pos of Object.values(handles)) {
            overlayCtx.fillRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            overlayCtx.strokeRect(pos.x - HANDLE_SIZE / 2, pos.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }
    }
}

export function getHandlePositions(x, y, w, h) {
    return {
        tl: { x: x - 1, y: y - 1 },
        tr: { x: x + w + 1, y: y - 1 },
        bl: { x: x - 1, y: y + h + 1 },
        br: { x: x + w + 1, y: y + h + 1 },
    };
}

export function hitTestHandle(mx, my) {
    if (state.selectedIndex < 0) return null;
    const el = state.elements[state.selectedIndex];
    if (!el || !canResize(el)) return null;
    const bounds = getElementBounds(el);
    if (!bounds) return null;
    const handles = getHandlePositions(bounds.x, bounds.y, bounds.w, bounds.h);
    const threshold = HANDLE_SIZE + 2;
    for (const [name, pos] of Object.entries(handles)) {
        if (Math.abs(mx - pos.x) <= threshold && Math.abs(my - pos.y) <= threshold) {
            return name;
        }
    }
    return null;
}

export function getHandleCursor(handle) {
    if (!handle) return 'crosshair';
    const map = { tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize' };
    return map[handle] || 'crosshair';
}

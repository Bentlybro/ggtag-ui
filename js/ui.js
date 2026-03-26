import { TYPE_ICONS, TYPE_ICON_STYLE } from './constants.js';
import { getElementSummary } from './elements.js';
import { state } from './state.js';
import { repaint } from './render.js';
import { drawOverlay } from './overlay.js';

const layerList = document.getElementById('layerList');
const propertiesContent = document.getElementById('propertiesContent');

// ── Layer list rendering ──
export function renderLayers() {
    layerList.innerHTML = '';
    state.elements.forEach((el, i) => {
        const item = document.createElement('div');
        item.className = 'layer-item' + (i === state.selectedIndex ? ' selected' : '');
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
            state.selectedIndex = i;
            renderLayers();
            renderProperties();
            drawOverlay();
        });

        // Drag reorder
        item.addEventListener('dragstart', (e) => {
            state.layerDragIndex = i;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            state.layerDragIndex = -1;
            document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (state.layerDragIndex === -1) return;
            e.dataTransfer.dropEffect = 'move';
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            if (state.layerDragIndex === -1 || state.layerDragIndex === i) return;
            const moved = state.elements.splice(state.layerDragIndex, 1)[0];
            state.elements.splice(i, 0, moved);
            if (state.selectedIndex === state.layerDragIndex) state.selectedIndex = i;
            else if (state.selectedIndex > state.layerDragIndex && state.selectedIndex <= i) state.selectedIndex--;
            else if (state.selectedIndex < state.layerDragIndex && state.selectedIndex >= i) state.selectedIndex++;
            state.layerDragIndex = -1;
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
            state.elements[idx].visible = !state.elements[idx].visible;
            renderLayers();
            repaint();
        });
    });
    layerList.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            state.elements.splice(idx, 1);
            if (state.selectedIndex >= state.elements.length) state.selectedIndex = state.elements.length - 1;
            if (state.selectedIndex === idx) state.selectedIndex = -1;
            else if (state.selectedIndex > idx) state.selectedIndex--;
            renderLayers();
            renderProperties();
            repaint();
        });
    });
}

// ── Properties panel ──
export function renderProperties() {
    if (state.selectedIndex < 0 || state.selectedIndex >= state.elements.length) {
        propertiesContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mouse-pointer"></i>
                <p>Select a layer to edit its properties</p>
            </div>`;
        return;
    }

    const el = state.elements[state.selectedIndex];
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
            const el = state.elements[state.selectedIndex];
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

// ── Toast ──
const toast = document.getElementById('toast');
export function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

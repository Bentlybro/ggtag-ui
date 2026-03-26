// ── Global mutable state ──
// Shared across modules. Import and mutate directly.

export const state = {
    elements: [],
    selectedIndex: -1,
    layerDragIndex: -1,
    drag: {
        dragging: false,
        mode: 'move',    // 'move' | 'resize'
        handle: null,     // 'tl' | 'tr' | 'bl' | 'br' | null
        startX: 0, startY: 0,
        origX: 0, origY: 0,
        origW: 0, origH: 0,
        origRadius: 0,
    },
};

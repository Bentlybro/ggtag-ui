// ── Escape code mappings (same as original ggtag protocol) ──
export const ESC2CMD = {
    "\\t": "Text", "\\r": "Rect", "\\R": "FillRect",
    "\\c": "Circle", "\\C": "FillCircle", "\\l": "Line",
    "\\q": "QR code", "\\I": "Image", "\\P": "PNGImage",
    "\\i": "BMPImage", "\\a": "Icon", "\\f": "RFID"
};

export const CMD2ESC = {
    "Text": "\\t", "Rect": "\\r", "FillRect": "\\R",
    "Circle": "\\c", "FillCircle": "\\C", "Line": "\\l",
    "QR code": "\\q", "Image": "\\I", "PNGImage": "\\P",
    "BMPImage": "\\i", "Icon": "\\a", "RFID": "\\f"
};

// FontAwesome icon classes per element type
export const TYPE_ICONS = {
    "Text": "fa-font", "Rect": "fa-square", "FillRect": "fa-square",
    "Circle": "fa-circle", "FillCircle": "fa-circle",
    "Line": "fa-minus", "QR code": "fa-qrcode", "Image": "fa-image",
    "PNGImage": "fa-image", "BMPImage": "fa-image",
    "Icon": "fa-icons", "RFID": "fa-wifi"
};

// Override icon style (default is "fas")
export const TYPE_ICON_STYLE = {
    "Rect": "far", "Circle": "far"
};

export const HANDLE_SIZE = 7;

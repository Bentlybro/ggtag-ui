import { getInput } from './elements.js';
import { processImages } from './images.js';
import { encodeInput } from './render.js';
import { state } from './state.js';

const canvas = document.getElementById('ggCanvas');

// ── Serial programming ──
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
    await closedPromise;
    try { await port.close(); } catch(e) { /* port may already be closed */ }
}

// ── Sound programming ──
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

// ── Programming UI ──
export function initProgramming() {
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
            let inp = getInput(state.elements);
            inp = await processImages(inp, canvas.width, canvas.height);
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
}

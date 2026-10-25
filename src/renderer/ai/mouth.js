const MAX_OPEN = 0.7;

const VOWELS = {
    a: [1.0, 0.0],
    i: [0.4, 0.8],
    u: [0.3, -0.8],
    e: [0.65, 0.4],
    o: [0.8, -0.5],
};
const LIP_CLOSE = new Set(['b', 'm', 'p']);
const PAUSE = new Set([',', '.', ';', ':', '!', '?', '\n']);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
const rand = (a, b) => a + Math.random() * (b - a);

const controllers = new WeakMap();

function framesFromText(text) {
    const frames = [];
    let lastForm = 0;
    for (const ch of text.toLowerCase()) {
        if (VOWELS[ch]) {
            const [open, form] = VOWELS[ch];
            lastForm = form;
            frames.push({ open: open * rand(0.85, 1), form, dur: 1.15 });
        } else if (PAUSE.has(ch)) {
            frames.push({ open: 0, form: 0, dur: 3 });
        } else if (ch === ' ') {
            frames.push({ open: 0.05, form: lastForm * 0.3, dur: 0.6 });
        } else if (LIP_CLOSE.has(ch)) {
            frames.push({ open: 0, form: 0, dur: 0.7 });
        } else if (/\p{L}/u.test(ch)) {
            frames.push({ open: 0.22, form: lastForm * 0.5, dur: 0.7 });
        }
    }
    return frames;
}

function framesFromDuration(seconds) {
    const frames = [];
    let t = 0;
    let untilGap = Math.floor(rand(2, 5));
    while (t < seconds) {
        const dur = rand(0.12, 0.2);
        frames.push({ open: rand(0.35, 0.95), form: rand(-0.5, 0.5), dur });
        t += dur;
        if (--untilGap <= 0) {
            const gap = rand(0.06, 0.14);
            frames.push({ open: 0.03, form: 0, dur: gap });
            t += gap;
            untilGap = Math.floor(rand(2, 5));
        }
    }
    return frames;
}

function getController(model) {
    let c = controllers.get(model);
    if (c) return c;

    const internal = model.internalModel;
    const core = internal.coreModel;

    c = {
        frames: [],
        idx: 0,
        frameT: 0,
        playing: false,
        open: 0,
        form: 0,
        energy: 0,
        lastNow: performance.now(),
    };

    c.update = () => {
        const now = performance.now();
        const dt = Math.min((now - c.lastNow) / 1000, 0.05);
        c.lastNow = now;
        if (dt <= 0) return;

        let tOpen = 0;
        let tForm = 0;

        if (c.playing) {
            c.frameT += dt;
            while (c.idx < c.frames.length && c.frameT >= c.frames[c.idx].dur) {
                c.frameT -= c.frames[c.idx].dur;
                c.idx++;
            }
            if (c.idx >= c.frames.length) {
                c.playing = false;
            } else {
                tOpen = c.frames[c.idx].open * MAX_OPEN;
                tForm = c.frames[c.idx].form;
            }
        }

        c.open = damp(c.open, tOpen, tOpen > c.open ? 32 : 20, dt);
        c.form = damp(c.form, tForm, 14, dt);
        c.energy = damp(c.energy, c.playing ? 1 : 0, 6, dt);

        if (c.playing || c.open > 0.002) {
            core.setParameterValueById('ParamMouthOpenY', clamp(c.open, 0, 1));
            core.setParameterValueById('ParamMouthForm', clamp(c.form, -1, 1));
        }
    };

    internal.on('beforeModelUpdate', c.update);
    controllers.set(model, c);
    return c;
}

export function animateMouth(model, duration, text) {
    if (!model) return;
    const c = getController(model);
    const seconds = Math.max(duration / 1000, 0.3);

    let frames = text ? framesFromText(text) : [];
    if (!frames.length) frames = framesFromDuration(seconds);

    const total = frames.reduce((s, f) => s + f.dur, 0) || 1;
    const k = seconds / total;
    c.frames = frames.map((f) => ({ ...f, dur: f.dur * k }));
    c.idx = 0;
    c.frameT = 0;
    c.playing = true;
}

export function stopMouth(model) {
    const c = model && controllers.get(model);
    if (c) c.playing = false;
}

export function getTalkLevel(model) {
    const c = model && controllers.get(model);
    return c ? c.energy : 0;
}
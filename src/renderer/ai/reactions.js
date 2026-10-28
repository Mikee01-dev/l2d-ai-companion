const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (t) => t * t * (3 - 2 * t);

const MOUTH_PARAMS = new Set(['ParamMouthOpenY', 'ParamMouthForm']);

const REACTIONS = {
    pat: {
        attack: 0.18, hold: 1.4, release: 0.7,
        params: {
            ParamEyeLOpen: 0.05,
            ParamEyeROpen: 0.05,
            ParamEyeLSmile: 1,
            ParamEyeRSmile: 1,
            ParamMouthForm: 1,
            ParamCheek: 1,
            ParamBrowLY: 0.3,
            ParamBrowRY: 0.3,
            ParamAngleY: -7,
            ParamAngleZ: (t) => 5 + Math.sin(t * 5) * 1.5,
        },
    },

    poke: {
        attack: 0.06, hold: 0.45, release: 0.55,
        params: {
            ParamEyeLOpen: 1,
            ParamEyeROpen: 1,
            ParamBrowLY: 0.9,
            ParamBrowRY: 0.9,
            ParamMouthOpenY: 0.55,
            ParamMouthForm: -0.4,
            ParamAngleX: (t, c) => -c.dir * (8 + Math.sin(t * 28) * 2 * Math.exp(-t * 5)),
            ParamBodyAngleX: (t, c) => c.dir * (8 + Math.sin(t * 28) * 2 * Math.exp(-t * 5)),
            ParamEyeBallX: (t, c) => -c.dir * 0.8,
        },
    },

    stroke: {
        attack: 0.6, hold: Infinity, release: 0.8,
        params: {
            ParamEyeLOpen: 0.4,
            ParamEyeROpen: 0.4,
            ParamEyeLSmile: 0.7,
            ParamEyeRSmile: 0.7,
            ParamMouthForm: 0.7,
            ParamCheek: 0.6,
            ParamAngleY: -4,
            ParamAngleX: (t, c) => c.s * 8,
            ParamBodyAngleX: (t, c) => c.s * 3,
            ParamAngleZ: (t, c) => 3 + Math.sin(t * 1.5) * 3 - c.s * 4,
            ParamEyeBallX: (t, c) => c.s * 0.5,
        },
    },
};

export function createReactions(model, { getTalk = () => 0 } = {}) {
    const internal = model.internalModel;
    const core = internal.coreModel;
    const canRead = typeof core.getParameterValueById === 'function';

    let active = null;
    let lastNow = performance.now();

    function apply(id, target, w) {
        if (canRead) {
            const cur = core.getParameterValueById(id);
            core.setParameterValueById(id, cur + (target - cur) * w);
        } else {
            core.setParameterValueById(id, target, w);
        }
    }

    function startRelease(a) {
        a.phase = 'release';
        a.t = 0;
        a.from = a.w;
        a.ctx.lean = 0;
    }

    function update() {
        const now = performance.now();
        const dt = Math.min((now - lastNow) / 1000, 0.05);
        lastNow = now;
        if (!active || dt <= 0) return;

        const a = active;
        const d = a.def;
        a.t += dt;
        a.time += dt;

        a.ctx.s += (a.ctx.lean - a.ctx.s) * (1 - Math.exp(-dt * 8));

        if (a.phase === 'attack') {
            const p = Math.min(a.t / d.attack, 1);
            a.w = a.from + (1 - a.from) * easeOut(p);
            if (p >= 1) { a.phase = 'hold'; a.t = 0; }
        } else if (a.phase === 'hold') {
            a.w = 1;
            if (a.t >= d.hold) startRelease(a);
        } else {
            const p = Math.min(a.t / d.release, 1);
            a.w = a.from * (1 - smooth(p));
            if (p >= 1) { active = null; return; }
        }

        const talking = clamp(getTalk(), 0, 1) > 0.25;
        for (const [id, value] of Object.entries(d.params)) {
            if (talking && MOUTH_PARAMS.has(id)) continue;
            const target = typeof value === 'function' ? value(a.time, a.ctx) : value;
            apply(id, target, a.w);
        }
    }

    internal.on('beforeModelUpdate', update);

    return {
        play(name, ctx = {}) {
            const def = REACTIONS[name];
            if (!def) return null;
            const c = { dir: 1, lean: 0, s: 0, ...ctx };
            active = {
                name, def,
                ctx: c,
                phase: 'attack',
                t: 0,
                time: 0,
                w: 0,
                from: active ? active.w : 0,
            };
            return c;
        },
        release(name) {
            if (active && (!name || active.name === name) && active.phase !== 'release') startRelease(active);
        },
        isActive(name) {
            return Boolean(active && (!name || active.name === name));
        },
        dispose() {
            internal.off('beforeModelUpdate', update);
            active = null;
        },
    };
}

const LINES = {
    pat: {
        id: ['Hehe...', 'Enak banget dielus.', 'Jangan berhenti dong.', 'Hmm... nyaman.'],
        en: ['Hehe...', 'That feels nice.', "Don't stop.", 'Mmm... cozy.'],
    },
    poke: {
        id: ['Eh?! Kaget tau!', 'Hei, jangan colek-colek.', 'Iya iya, ada apa?', 'Ih!'],
        en: ['Eh?! You startled me!', "Hey, don't poke me.", 'Yes? What is it?', 'Hey!'],
    },
    stroke: {
        id: ['Hmm...', 'Nyaman...'],
        en: ['Hmm...', 'Feels nice...'],
    },
};

let lastLineAt = 0;

export function getReactionLine(type, language = 'id', { cooldownMs = 4000, chance = 0.6 } = {}) {
    const pool = LINES[type]?.[language] ?? LINES[type]?.en;
    if (!pool) return null;

    const now = Date.now();
    if (now - lastLineAt < cooldownMs || Math.random() > chance) return null;

    lastLineAt = now;
    return pool[Math.floor(Math.random() * pool.length)];
}
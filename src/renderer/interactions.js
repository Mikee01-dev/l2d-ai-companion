const MOOD = {
    baseline: 0.55,
    floor: 0.15,
    lonelyAfterMin: 20,
    lonelyDropPerMin: 0.012,
    calmDropPerMin: 0.02,
    recoverPerMin: 0.01,
    irritationDecayPerMin: 0.4,
    annoyedAt: 0.6,
    annoyedRearmAt: 0.3,
    maxAwayMin: 360,
    hysteresis: 0.03,
    delta: { chat: 0.08, pat: 0.06, stroke: 0.1, poke: -0.02 },
};

const MOOD_LEVELS = ['sad', 'low', 'ok', 'happy', 'joyful'];
const MOOD_BOUNDS = [0.2, 0.4, 0.7, 0.88];

const MOOD_TEXT = {
    id: {
        sad: 'sedih dan merasa sepi', low: 'agak murung', ok: 'biasa saja dan tenang',
        happy: 'senang', joyful: 'sangat ceria dan bersemangat',
    },
    en: {
        sad: 'sad and lonely', low: 'a bit down', ok: 'calm and neutral',
        happy: 'happy', joyful: 'very cheerful and energetic',
    },
};

function spanText(min, en) {
    if (min >= 120) return en ? `${Math.round(min / 60)} hours` : `${Math.round(min / 60)} jam`;
    return en ? `${Math.round(min)} minutes` : `${Math.round(min)} menit`;
}

export function setupInteraction(model, options = {}) {
    if (!model) return null;

    const getTalk = typeof options.getTalk === 'function' ? options.getTalk : () => 0;
    const internal = model.internalModel;
    const core = internal.coreModel;

    const RANGE_X = window.screen.width / 2;
    const RANGE_Y = window.screen.height / 2;

    const SPEED = {
        FOCUS:   { eyes: 15, head: 8, body: 3 },
        IDLE:    { eyes: 5,  head: 4, body: 2 },
        CURIOUS: { eyes: 8,  head: 5, body: 2 },
        SLEEPY:  { eyes: 3,  head: 2, body: 1 },
    };
    const FOCUS_HOLD = 3.0;
    const TILT_SIGN = 1;

    model.autoInteract = false;
    internal.eyeBlink = undefined;
    internal.breath = undefined;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
    const rand = (a, b) => a + Math.random() * (b - a);
    const smooth = (t) => t * t * (3 - 2 * t);
    const set = (id, v) => core.setParameterValueById(id, v);

    // Cek parameter
    const hasEyeSmile = core.getParameterIndex('ParamEyeLSmile') !== -1;
    const hasCheek = core.getParameterIndex('ParamCheek') !== -1;

    const storageKey = options.storageKey ?? null;
    const mood = {
        value: MOOD.baseline,
        since: 0,
        irritation: 0,
        armed: true,
        level: 0,
        lastWall: Date.now(),
        lastSave: Date.now(),
    };
    const moodListeners = { level: [], annoyed: [] };

    function moodEmit(name, payload) {
        for (const fn of [...moodListeners[name]]) {
            try { fn(payload); } catch (err) { console.warn(`[mood] listener ${name}:`, err); }
        }
    }

    function moodResolveLevel(value, prev) {
        let idx = prev;
        while (idx > 0 && value < MOOD_BOUNDS[idx - 1]) idx--;
        while (idx < MOOD_BOUNDS.length && value >= MOOD_BOUNDS[idx] + MOOD.hysteresis) idx++;
        return idx;
    }

    function moodAdvance(min) {
        if (!(min > 0)) return;
        const start = mood.since;
        const end = start + min;
        const neglect = Math.max(0, end - Math.max(start, MOOD.lonelyAfterMin));
        const calm = min - neglect;

        if (calm > 0) {
            if (mood.value > MOOD.baseline) mood.value = Math.max(MOOD.baseline, mood.value - calm * MOOD.calmDropPerMin);
            else if (mood.value < MOOD.baseline) mood.value = Math.min(MOOD.baseline, mood.value + calm * MOOD.recoverPerMin);
        }
        if (neglect > 0) {
            mood.value = Math.min(mood.value, Math.max(MOOD.floor, mood.value - neglect * MOOD.lonelyDropPerMin));
        }
        mood.since = end;
        mood.irritation = Math.max(0, mood.irritation - min * MOOD.irritationDecayPerMin);
    }

    function moodCommit(source) {
        mood.value = clamp(mood.value, 0, 1);
        if (mood.irritation < MOOD.annoyedRearmAt) mood.armed = true;

        const prev = mood.level;
        mood.level = moodResolveLevel(mood.value, prev);
        if (mood.level !== prev) {
            moodEmit('level', {
                prev: MOOD_LEVELS[prev],
                next: MOOD_LEVELS[mood.level],
                direction: mood.level > prev ? 'up' : 'down',
                happiness: mood.value,
                source,
            });
        }
    }

    function moodSave() {
        mood.lastSave = Date.now();
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify({
                value: mood.value, since: mood.since, irritation: mood.irritation, saved: Date.now(),
            }));
        } catch { }
    }

    function moodEvent(type) {
        let delta = MOOD.delta[type];
        if (delta === undefined) return;

        if (delta > 0 && mood.since > MOOD.lonelyAfterMin) delta *= 2;

        if (type === 'poke') {
            mood.irritation = clamp(mood.irritation + 0.25, 0, 1);
            if (mood.irritation >= MOOD.annoyedAt) delta -= 0.05;
        } else {
            mood.irritation = Math.max(0, mood.irritation - 0.15);
        }

        mood.value += delta;
        mood.since = 0;
        moodCommit(type);

        if (type === 'poke' && mood.armed && mood.irritation >= MOOD.annoyedAt) {
            mood.armed = false;
            moodEmit('annoyed', { irritation: mood.irritation, happiness: mood.value });
        }
        moodSave();
    }

    if (storageKey) {
        try {
            const raw = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
            if (raw && Number.isFinite(raw.value)) {
                mood.value = clamp(raw.value, 0, 1);
                mood.since = Number.isFinite(raw.since) ? Math.max(0, raw.since) : 0;
                mood.irritation = Number.isFinite(raw.irritation) ? clamp(raw.irritation, 0, 1) : 0;
                const away = Number.isFinite(raw.saved) ? (Date.now() - raw.saved) / 60000 : 0;
                moodAdvance(clamp(away, 0, MOOD.maxAwayMin));
            }
        } catch { }
    }
    mood.value = clamp(mood.value, 0, 1);
    mood.level = moodResolveLevel(mood.value, 0);

    function moodSnapshot() {
        return {
            happiness: Math.round(mood.value * 100) / 100,
            level: MOOD_LEVELS[mood.level],
            irritation: Math.round(mood.irritation * 100) / 100,
            minutesSinceInteraction: Math.round(mood.since),
            lonely: mood.since > MOOD.lonelyAfterMin,
            annoyed: mood.irritation >= MOOD.annoyedAt,
        };
    }

    function moodDescribe(lang = 'id') {
        const en = lang === 'en';
        let text = (MOOD_TEXT[lang] ?? MOOD_TEXT.id)[MOOD_LEVELS[mood.level]];
        if (mood.since > MOOD.lonelyAfterMin) {
            text += en
                ? `; the user has not interacted with you for ${spanText(mood.since, true)}`
                : `; sudah ${spanText(mood.since, false)} pengguna tidak berinteraksi denganmu`;
        }
        if (mood.irritation >= MOOD.annoyedAt) {
            text += en ? '; annoyed from being poked too much' : '; kesal karena terlalu sering dicolek';
        }
        return text;
    }

    const state = {
        mood: 'IDLE',
        moodTimer: 0,
        moodDuration: rand(4, 6),

        time: 0,
        lastNow: performance.now(),
        lastMouseX: -1,
        lastMouseY: -1,
        idleTotal: 0,
        wasTalking: false,

        happiness: mood.value,
        droop: 0,
        joy: 0,
        energy: 1,

        glancesLeft: 0,
        glanceHold: 0,
        lastGlance: { x: 0, y: 0 },

        target: { x: 0, y: 0 },
        headTarget: { x: 0, y: 0 },
        headPending: null,
        headDelay: 0,
        eyes: { x: 0, y: 0 },
        head: { x: 0, y: 0 },
        body: { x: 0, y: 0 },
        speed: { ...SPEED.IDLE },
        jitter: { x: 0, y: 0, timer: rand(0.4, 1.2) },
        tilt: 0,
        tiltTarget: 0,

        blinkWait: rand(2.5, 5),
        blinkProgress: -1,
        blinkDur: 0.16,
        blinkChain: false,
        blinkIsSecond: false,
        lid: 1,

        yawn: { active: false, t: 0, delay: -1, level: 0 },

        brow: 0,
        mouthForm: 0,

        breathPhase: 0,
        breathPeriod: 3.5,
    };

    const YAWN = { up: 0.5, hold: 0.7, down: 0.8 };
    const YAWN_TOTAL = YAWN.up + YAWN.hold + YAWN.down;

    const restY = () => state.droop * 0.35;

    function enter(moodName, duration = 0) {
        state.mood = moodName;
        state.moodTimer = 0;
        state.moodDuration = duration;
    }

    function lookAt(x, y, { speed, headDelay = 0, headFollow = 1 } = {}) {
        state.target.x = x;
        state.target.y = y;
        if (speed) state.speed = { ...speed };

        if (headDelay > 0) {
            state.headPending = { x: x * headFollow, y: y * headFollow };
            state.headDelay = headDelay;
        } else {
            state.headTarget.x = x * headFollow;
            state.headTarget.y = y * headFollow;
            state.headPending = null;
        }
    }

    function blinkSoon(chance) {
        if (state.blinkProgress < 0 && Math.random() < chance) {
            state.blinkWait = Math.min(state.blinkWait, rand(0.05, 0.2));
        }
    }

    const off = window.electronAPI?.onGlobalMouse?.((data) => {
        if (Math.abs(data.mouseX - state.lastMouseX) <= 2 && Math.abs(data.mouseY - state.lastMouseY) <= 2) return;

        const centerX = data.winX + window.innerWidth / 2;
        const centerY = data.winY + window.innerHeight / 2;

        enter('FOCUS');
        state.idleTotal = 0;
        state.glancesLeft = 0;
        state.tiltTarget = 0;
        state.yawn.active = false;
        state.yawn.delay = -1;

        lookAt(
            clamp((data.mouseX - centerX) / RANGE_X, -1, 1),
            clamp((data.mouseY - centerY) / RANGE_Y, -1, 1),
            { speed: SPEED.FOCUS }
        );

        state.lastMouseX = data.mouseX;
        state.lastMouseY = data.mouseY;
    });

    function startCurious() {
        enter('CURIOUS');
        state.glancesLeft = 2 + Math.floor(Math.random() * 3);
        nextGlance();
    }

    function nextGlance() {
        let gx, gy, tries = 0;
        do {
            gx = rand(-0.8, 0.8);
            gy = rand(-0.45, 0.3);
            tries++;
        } while (tries < 6 && Math.hypot(gx - state.lastGlance.x, gy - state.lastGlance.y) < 0.6);

        state.lastGlance = { x: gx, y: gy };
        state.glancesLeft--;
        state.moodTimer = 0;

        const quick = Math.random() < 0.4;
        state.glanceHold = quick ? rand(0.6, 1.0) : rand(1.5, 2.8);
        state.tiltTarget = (!quick && Math.random() < 0.5) ? TILT_SIGN * Math.sign(gx) * rand(5, 10) : 0;

        const calm = 1 - 0.5 * state.droop;
        lookAt(gx * calm, gy * calm + restY(), {
            speed: SPEED.CURIOUS,
            headDelay: rand(0.1, 0.28),
            headFollow: rand(0.6, 1.0),
        });
        blinkSoon(0.5);
    }

    function finishCurious() {
        enter('IDLE', rand(4, 6));
        state.tiltTarget = 0;
        if (Math.random() < 0.5 || state.droop > 0.3) lookAt(0, restY(), { speed: SPEED.IDLE, headDelay: 0.15 });
    }

    function startSleepy() {
        enter('SLEEPY', rand(5, 6.5));
        state.yawn.delay = Math.random() < 0.7 ? rand(1.2, 2.5) : -1;
        lookAt(rand(-0.2, 0.2), 0.5, { speed: SPEED.SLEEPY });
    }

    function wakeUp() {
        enter('IDLE', rand(4, 6));
        lookAt(0, restY(), { speed: SPEED.IDLE });
        blinkSoon(1);
    }

    function updateBehavior(dt, talking) {
        state.moodTimer += dt;
        if (state.mood !== 'FOCUS') state.idleTotal += dt;

        if (state.headPending) {
            state.headDelay -= dt;
            if (state.headDelay <= 0) {
                state.headTarget.x = state.headPending.x;
                state.headTarget.y = state.headPending.y;
                state.headPending = null;
            }
        }

        state.happiness = damp(state.happiness, mood.value, 1.5, dt);
        state.droop = clamp((0.4 - state.happiness) / 0.4, 0, 1);
        state.joy = clamp((state.happiness - 0.7) / 0.3, 0, 1);
        state.energy = 0.8 + 0.4 * state.happiness;

        if (talking) {
            state.yawn.active = false;
            state.yawn.delay = -1;
            state.tiltTarget = 0;
            if (state.mood === 'CURIOUS' || state.mood === 'SLEEPY') {
                enter('IDLE', rand(4, 6));
                lookAt(0, -0.05, { speed: SPEED.IDLE });
            } else if (state.mood === 'IDLE') {
                if (!state.wasTalking) lookAt(0, -0.05, { speed: SPEED.IDLE });
                state.moodTimer = 0;
            }
        }
        state.wasTalking = talking;

        const hour = new Date().getHours();
        const isNightTime = (hour >= 23 || hour < 4);
        const sleepyThreshold = isNightTime ? 10 : 20;

        switch (state.mood) {
            case 'FOCUS':
                if (state.moodTimer > FOCUS_HOLD) enter('IDLE', rand(4, 6));
                break;

            case 'IDLE':
                if (state.moodTimer > state.moodDuration) {
                    const roll = Math.random();
                    const canSleep = state.idleTotal > sleepyThreshold;

                    const pCurious = clamp((canSleep ? 0.4 : 0.6) * (0.55 + 0.6 * state.happiness), 0.15, 0.75);
                    const pSleepy = isNightTime ? 0.3 : 0.2;

                    if (roll < pCurious) {
                        startCurious();
                    } else if (canSleep && roll < pCurious + pSleepy) {
                        startSleepy();
                    } else {
                        lookAt(0, restY(), { speed: SPEED.IDLE });
                        enter('IDLE', rand(4, 6));
                    }
                }
                break;

            case 'CURIOUS':
                if (state.moodTimer > state.glanceHold) {
                    if (state.glancesLeft > 0) nextGlance();
                    else finishCurious();
                }
                break;

            case 'SLEEPY':
                if (state.yawn.delay > 0) {
                    state.yawn.delay -= dt;
                    if (state.yawn.delay <= 0) {
                        state.yawn.active = true;
                        state.yawn.t = 0;
                    }
                }
                if (state.moodTimer > state.moodDuration) wakeUp();
                break;
        }
    }

    function updateYawn(dt) {
        const y = state.yawn;
        let goal = 0;
        if (y.active) {
            y.t += dt;
            if (y.t >= YAWN_TOTAL) {
                y.active = false;
            } else if (y.t < YAWN.up) {
                goal = smooth(y.t / YAWN.up);
            } else if (y.t < YAWN.up + YAWN.hold) {
                goal = 1;
            } else {
                goal = smooth(1 - (y.t - YAWN.up - YAWN.hold) / YAWN.down);
            }
        }
        y.level = damp(y.level, goal, 14, dt);
    }

    function updateMicroExpressions(dt, talking) {
        let browGoal = 0;
        if (state.mood === 'CURIOUS') browGoal = 0.5;
        else if (state.mood === 'SLEEPY') browGoal = -0.4;
        browGoal += 0.4 * state.yawn.level;
        browGoal += (state.happiness - 0.5) * 0.8;

        state.brow = damp(state.brow, browGoal, 5, dt);
        set('ParamBrowLY', state.brow);
        set('ParamBrowRY', state.brow);

        let mouthGoal = (state.happiness * 2) - 1;
        if (state.mood === 'FOCUS') mouthGoal += 0.2;
        else if (state.mood === 'SLEEPY') mouthGoal = -0.2;

        mouthGoal = clamp(mouthGoal, -1, 1);
        state.mouthForm = damp(state.mouthForm, mouthGoal, 3, dt);

        if (!talking) {
            set('ParamMouthForm', clamp(state.mouthForm - 0.6 * state.yawn.level, -1, 1));
            if (state.yawn.level > 0.001) set('ParamMouthOpenY', state.yawn.level * 0.9);
        }

        if (hasCheek) {
            set('ParamCheek', clamp(state.joy * 0.7, 0, 1));
        }
    }

    function updateBlink(dt, talking) {
        const sleepy = state.mood === 'SLEEPY' && !talking;

        if (state.blinkProgress >= 0) {
            state.blinkProgress += dt / state.blinkDur;
            if (state.blinkProgress >= 1) {
                state.blinkProgress = -1;
                if (state.blinkChain) {
                    state.blinkChain = false;
                    state.blinkIsSecond = true;
                    state.blinkWait = 0.08;
                } else {
                    state.blinkIsSecond = false;
                    state.blinkWait = sleepy ? rand(1.5, 3.5) : rand(2.5, 6.5);
                }
            }
        } else {
            state.blinkWait -= dt;
            if (state.blinkWait <= 0) {
                const slow = sleepy && Math.random() < 0.4;
                const chain = !slow && !state.blinkIsSecond && Math.random() < 0.2;
                state.blinkProgress = 0;
                state.blinkDur = slow ? 0.65 : chain ? 0.1 : 0.16;
                state.blinkChain = chain;
            }
        }

        let lidGoal = sleepy ? 0.35 : 1;
        if (state.happiness < 0.4) lidGoal = 0.7;

        state.lid = damp(state.lid, lidGoal, lidGoal > state.lid ? 6 : 2.5, dt);

        const blinkFactor = state.blinkProgress >= 0 ? 1 - Math.sin(state.blinkProgress * Math.PI) : 1;
        const squeeze = 1 - 0.85 * state.yawn.level;
        const eyeOpen = clamp(state.lid * blinkFactor * squeeze, 0, 1);

        set('ParamEyeLOpen', eyeOpen);
        set('ParamEyeROpen', eyeOpen);

        if (hasEyeSmile) {
            const eyeSmile = clamp((state.happiness - 0.6) * 2, 0, 1);
            set('ParamEyeLSmile', eyeSmile);
            set('ParamEyeRSmile', eyeSmile);
        }
    }

    function update() {
        const wall = Date.now();
        moodAdvance(clamp((wall - mood.lastWall) / 60000, 0, MOOD.maxAwayMin));
        mood.lastWall = wall;
        moodCommit('time');
        if (wall - mood.lastSave > 30000) moodSave();

        const now = performance.now();
        const dt = Math.min((now - state.lastNow) / 1000, 0.05);
        state.lastNow = now;
        if (dt <= 0) return;
        state.time += dt;

        const talking = clamp(getTalk(), 0, 1) > 0.25;

        updateBehavior(dt, talking);
        updateYawn(dt);
        updateMicroExpressions(dt, talking);
        updateBlink(dt, talking);

        state.jitter.timer -= dt;
        if (state.jitter.timer <= 0) {
            const amp = state.mood === 'FOCUS' ? 0.02 : 0.05;
            state.jitter.x = rand(-amp, amp);
            state.jitter.y = rand(-amp, amp);
            state.jitter.timer = rand(0.4, 1.2);
        }

        const e = state.energy;
        state.eyes.x = damp(state.eyes.x, state.target.x + state.jitter.x, state.speed.eyes * e, dt);
        state.eyes.y = damp(state.eyes.y, state.target.y + state.jitter.y, state.speed.eyes * e, dt);
        state.head.x = damp(state.head.x, state.headTarget.x, state.speed.head * e, dt);
        state.head.y = damp(state.head.y, state.headTarget.y, state.speed.head * e, dt);
        state.body.x = damp(state.body.x, state.headTarget.x, state.speed.body * e, dt);
        state.body.y = damp(state.body.y, state.headTarget.y, state.speed.body * e, dt);
        state.tilt = damp(state.tilt, state.tiltTarget, 3, dt);

        const sway = Math.sin(state.time * 0.6) * 1.5 * (1 + 0.8 * state.joy);
        const nod = Math.sin(state.time * 1.2) * 1.0;
        const yawnBack = 5 * state.yawn.level;
        const slump = 6 * state.droop;

        set('ParamAngleX', clamp(state.head.x * 30, -30, 30));
        set('ParamAngleY', clamp(-state.head.y * 30 + yawnBack - slump, -30, 30));
        set('ParamAngleZ', clamp(-state.head.x * state.head.y * 10 + sway + nod + state.tilt, -30, 30));

        set('ParamEyeBallX', clamp(state.eyes.x, -1, 1));
        set('ParamEyeBallY', clamp(-state.eyes.y, -1, 1));

        set('ParamBodyAngleX', clamp(state.body.x * 10, -10, 10));
        set('ParamBodyAngleY', clamp(-state.body.y * 5, -5, 5));
        set('ParamBodyAngleZ', clamp(-state.body.x * 4 + sway * 0.5 + state.tilt * 0.3, -10, 10));

        const periodGoal = (state.mood === 'SLEEPY' ? 5.0 : 3.5) + 0.8 * state.droop;
        state.breathPeriod = damp(state.breathPeriod, periodGoal, 1, dt);
        state.breathPhase += dt / state.breathPeriod;
        set('ParamBreath', Math.sin(state.breathPhase * Math.PI * 2) * 0.5 + 0.5);
    }

    internal.on('beforeModelUpdate', update);

    let disposed = false;
    return {
        event: moodEvent,
        getMood: () => mood.value,
        snapshot: moodSnapshot,
        describe: moodDescribe,
        onLevel(fn) {
            moodListeners.level.push(fn);
            return () => { moodListeners.level = moodListeners.level.filter((f) => f !== fn); };
        },
        onAnnoyed(fn) {
            moodListeners.annoyed.push(fn);
            return () => { moodListeners.annoyed = moodListeners.annoyed.filter((f) => f !== fn); };
        },
        setMood(value) { mood.value = clamp(value, 0, 1); moodCommit('debug'); moodSave(); },
        simulate(minutes) { moodAdvance(minutes); moodCommit('time'); moodSave(); },
        reset() {
            mood.value = MOOD.baseline; mood.since = 0; mood.irritation = 0; mood.armed = true;
            moodCommit('reset'); moodSave();
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            moodSave();
            moodListeners.level = [];
            moodListeners.annoyed = [];
            try { internal.off('beforeModelUpdate', update); } catch { }
            if (typeof off === 'function') off();
        },
    };
}
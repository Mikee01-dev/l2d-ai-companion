export function setupInteraction(model, options = {}) {
    if (!model) return () => {};

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
    const SLEEPY_AFTER = 20;
    const TILT_SIGN = 1;
    
    model.autoInteract = false;
    internal.eyeBlink = undefined;
    internal.breath = undefined;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
    const rand = (a, b) => a + Math.random() * (b - a);
    const smooth = (t) => t * t * (3 - 2 * t);
    const set = (id, v) => core.setParameterValueById(id, v);
    
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

    function enter(mood, duration = 0) {
        state.mood = mood;
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

    const off = window.electronAPI.onGlobalMouse((data) => {
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

        lookAt(gx, gy, { speed: SPEED.CURIOUS, headDelay: rand(0.1, 0.28), headFollow: rand(0.6, 1.0) });
        blinkSoon(0.5);
    }

    function finishCurious() {
        enter('IDLE', rand(4, 6));
        state.tiltTarget = 0;
        if (Math.random() < 0.5) lookAt(0, 0, { speed: SPEED.IDLE, headDelay: 0.15 });
    }

    function startSleepy() {
        enter('SLEEPY', rand(5, 6.5));
        state.yawn.delay = Math.random() < 0.7 ? rand(1.2, 2.5) : -1;
        lookAt(rand(-0.2, 0.2), 0.5, { speed: SPEED.SLEEPY });
    }

    function wakeUp() {
        enter('IDLE', rand(4, 6));
        lookAt(0, 0, { speed: SPEED.IDLE });
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

        switch (state.mood) {
            case 'FOCUS':
                if (state.moodTimer > FOCUS_HOLD) enter('IDLE', rand(4, 6));
                break;

            case 'IDLE':
                if (state.moodTimer > state.moodDuration) {
                    const roll = Math.random();
                    const canSleep = state.idleTotal > SLEEPY_AFTER;
                    if (roll < (canSleep ? 0.4 : 0.6)) {
                        startCurious();
                    } else if (canSleep && roll < 0.7) {
                        startSleepy();
                    } else {
                        lookAt(0, 0, { speed: SPEED.IDLE });
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

        state.brow = damp(state.brow, browGoal, 5, dt);
        set('ParamBrowLY', state.brow);
        set('ParamBrowRY', state.brow);

        let mouthGoal = 0.1;
        if (state.mood === 'FOCUS') mouthGoal = 0.2;
        else if (state.mood === 'SLEEPY') mouthGoal = 0.4;
        state.mouthForm = damp(state.mouthForm, mouthGoal, 3, dt);

        if (!talking) {
            set('ParamMouthForm', clamp(state.mouthForm - 0.6 * state.yawn.level, -1, 1));
            if (state.yawn.level > 0.001) set('ParamMouthOpenY', state.yawn.level * 0.9);
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

        const lidGoal = sleepy ? 0.35 : 1;
        state.lid = damp(state.lid, lidGoal, lidGoal > state.lid ? 6 : 2.5, dt);

        const blinkFactor = state.blinkProgress >= 0 ? 1 - Math.sin(state.blinkProgress * Math.PI) : 1;
        const squeeze = 1 - 0.85 * state.yawn.level;
        const eyeOpen = clamp(state.lid * blinkFactor * squeeze, 0, 1);

        set('ParamEyeLOpen', eyeOpen);
        set('ParamEyeROpen', eyeOpen);
    }

    function update() {
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

        state.eyes.x = damp(state.eyes.x, state.target.x + state.jitter.x, state.speed.eyes, dt);
        state.eyes.y = damp(state.eyes.y, state.target.y + state.jitter.y, state.speed.eyes, dt);
        state.head.x = damp(state.head.x, state.headTarget.x, state.speed.head, dt);
        state.head.y = damp(state.head.y, state.headTarget.y, state.speed.head, dt);
        state.body.x = damp(state.body.x, state.headTarget.x, state.speed.body, dt);
        state.body.y = damp(state.body.y, state.headTarget.y, state.speed.body, dt);
        state.tilt = damp(state.tilt, state.tiltTarget, 3, dt);

        const sway = Math.sin(state.time * 0.6) * 1.5;
        const nod = Math.sin(state.time * 1.2) * 1.0;
        const yawnBack = 5 * state.yawn.level;

        set('ParamAngleX', clamp(state.head.x * 30, -30, 30));
        set('ParamAngleY', clamp(-state.head.y * 30 + yawnBack, -30, 30));
        set('ParamAngleZ', clamp(-state.head.x * state.head.y * 10 + sway + nod + state.tilt, -30, 30));

        set('ParamEyeBallX', clamp(state.eyes.x, -1, 1));
        set('ParamEyeBallY', clamp(-state.eyes.y, -1, 1));

        set('ParamBodyAngleX', clamp(state.body.x * 10, -10, 10));
        set('ParamBodyAngleY', clamp(-state.body.y * 5, -5, 5));
        set('ParamBodyAngleZ', clamp(-state.body.x * 4 + sway * 0.5 + state.tilt * 0.3, -10, 10));

        const periodGoal = state.mood === 'SLEEPY' ? 5.0 : 3.5;
        state.breathPeriod = damp(state.breathPeriod, periodGoal, 1, dt);
        state.breathPhase += dt / state.breathPeriod;
        set('ParamBreath', Math.sin(state.breathPhase * Math.PI * 2) * 0.5 + 0.5);
    }

    internal.on('beforeModelUpdate', update);

    return function cleanup() {
        internal.off('beforeModelUpdate', update);
        if (typeof off === 'function') off();
    };
}
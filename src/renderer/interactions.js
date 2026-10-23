export function setupInteraction(model, app) {
    if (!model) return () => {};

    const internal = model.internalModel;
    const core = internal.coreModel;

    const SPEED = { eyes: 14, head: 7, body: 3 };
    const RANGE_X = window.screen.width / 2; 
    const RANGE_Y = window.screen.height / 2;
    const BLINK_MIN = 2.5, BLINK_MAX = 5.5;
    const BLINK_DURATION = 0.16;
    const BREATH_CYCLE = 3.5;

    model.autoInteract = false;
    internal.eyeBlink = undefined;
    internal.breath = undefined;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const damp = (cur, target, speed, dt) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
    const rand = (a, b) => a + Math.random() * (b - a);
    const set = (id, v) => core.setParameterValueById(id, v);

    const target = { x: 0, y: 0 };
    const eyes = { x: 0, y: 0 };
    const head = { x: 0, y: 0 };
    const body = { x: 0, y: 0 };

    let time = 0;
    let lastNow = performance.now();

    const blink = { wait: rand(BLINK_MIN, BLINK_MAX), progress: -1, doubleBlink: false };

    const off = window.electronAPI.onGlobalMouse((data) => {
        const centerX = data.winX + window.innerWidth / 2;
        const centerY = data.winY + window.innerHeight / 2;

        target.x = clamp((data.mouseX - centerX) / RANGE_X, -1, 1);
        target.y = clamp((data.mouseY - centerY) / RANGE_Y, -1, 1);
    });

    function update() {
        const now = performance.now();
        const dt = Math.min((now - lastNow) / 1000, 0.05);
        lastNow = now;
        time += dt;

        eyes.x = damp(eyes.x, target.x, SPEED.eyes, dt);
        eyes.y = damp(eyes.y, target.y, SPEED.eyes, dt);
        head.x = damp(head.x, target.x, SPEED.head, dt);
        head.y = damp(head.y, target.y, SPEED.head, dt);
        body.x = damp(body.x, target.x, SPEED.body, dt);
        body.y = damp(body.y, target.y, SPEED.body, dt);

        const sway = Math.sin(time * 0.6) * 1.5;

        set('ParamAngleX', clamp(head.x * 30, -30, 30));
        set('ParamAngleY', clamp(-head.y * 30, -30, 30));
        set('ParamAngleZ', clamp(-head.x * head.y * 10 + sway, -30, 30));

        set('ParamEyeBallX', clamp(eyes.x, -1, 1));
        set('ParamEyeBallY', clamp(-eyes.y, -1, 1));

        set('ParamBodyAngleX', clamp(body.x * 10, -10, 10));
        set('ParamBodyAngleY', clamp(-body.y * 5, -5, 5));
        set('ParamBodyAngleZ', clamp(-body.x * 4 + sway * 0.5, -10, 10));

        let eyeOpen = 1;
        if (blink.progress >= 0) {
            blink.progress += dt / BLINK_DURATION;
            if (blink.progress >= 1) {
                blink.progress = -1;
                blink.wait = blink.doubleBlink ? 0.12 : rand(BLINK_MIN, BLINK_MAX);
                blink.doubleBlink = false;
            } else {
                eyeOpen = 1 - Math.sin(blink.progress * Math.PI);
            }
        } else {
            blink.wait -= dt;
            if (blink.wait <= 0) {
                blink.progress = 0;
                blink.doubleBlink = Math.random() < 0.15;
            }
        }
        set('ParamEyeLOpen', eyeOpen);
        set('ParamEyeROpen', eyeOpen);

        const breath = Math.sin((time / BREATH_CYCLE) * Math.PI * 2) * 0.5 + 0.5;
        set('ParamBreath', breath);
    }

    internal.on('beforeModelUpdate', update);

    return function cleanup() {
        internal.off('beforeModelUpdate', update);
        if (typeof off === 'function') off();
    };
}
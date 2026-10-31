import * as PIXI from 'pixi.js';
import { Live2DModel } from '@jannchie/pixi-live2d-display/cubism4';
import { setupInteraction } from './interactions.js';
import { setupChatUI } from './ui/chat.js';
import { animateMouth, getTalkLevel } from './ai/mouth.js';
import { createConversation, getGreeting, pickSpontaneousKind } from './ai/brain.js';
import { createReactions, getReactionLine } from './ai/reactions.js';

import './style.css';
window.PIXI = PIXI;

let model = null;
let reactions = null;
let loadToken = 0;
let interactionController = null;
let chatBusy = false; 

const modelSettings = {
    scale: 1.0,
    offsetY: 0
};

const container = document.getElementById('canvas-container');
const canvasContainer = container;
const app = new PIXI.Application();

await app.init({
    background: 0x2b2d31,
    resolution: 1,
    autoDensity: false,
    antialias: true,
    resizeTo: container,
    textureGCActive: false,
});

container.appendChild(app.canvas);

const MODEL_PATHS = {
    male: '/assets/live2d/mikee/mikee.model3.json',
    female: '/assets/live2d/kei_vowels_pro/runtime/kei_vowels_pro.model3.json'
};

const appState = {
    gender: 'male',
    language: 'id',
    userName: ''
};

function positionModel() {
    if (!model) return;
    const w = app.screen.width;
    const h = app.screen.height;

    model.scale.set(1);
    const baseScale = Math.min(w / model.width, h / model.height);

    model.scale.set(baseScale * 1.4 * modelSettings.scale);
    model.anchor.set(0.5, 0.5);
    model.position.set(w / 2, (h / 2) + modelSettings.offsetY);
}

async function loadCharacter(gender) {
    const token = ++loadToken;
    try {
        cancelPress();
        interactionController?.dispose();
        interactionController = null;
        reactions?.dispose();
        reactions = null;
        if (model) {
            app.stage.removeChild(model);
            model.destroy();
            model = null;
        }

        const modelPath = MODEL_PATHS[gender];
        if (!modelPath) throw new Error(`Path model untuk ${gender} tidak ditemukan`);

        const newModel = await Live2DModel.from(modelPath);

        if (token !== loadToken) {
            newModel.destroy();
            return;
        }

        model = newModel;
        app.stage.addChild(model);
        positionModel();

        model.eventMode = 'none';

        interactionController = setupInteraction(model, {
            getTalk: () => getTalkLevel(model),
            storageKey: gender === 'male' ? 'mike_mood' : 'kei_mood',
        });
        bindMoodReactions(interactionController);

        reactions = createReactions(model, {
            getTalk: () => getTalkLevel(model)
        });

        console.log(`Model ${gender} berhasil di-load!`);
    } catch (error) {
        console.error(`Gagal load model ${gender}:`, error);
    }
}

app.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost');
});

app.canvas.addEventListener('webglcontextrestored', async () => {
    console.warn('WebGL context restored, reload model');
    await loadCharacter(appState.gender);
});

const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');
btnClose.addEventListener('click', () => window.electronAPI.closeWindow());
btnMinimize.addEventListener('click', () => window.electronAPI.minimizeWindow());

const conversation = createConversation({
    userName: appState.userName,
    getSettings: () => ({
        gender: appState.gender,
        language: appState.language,
        moodText: interactionController?.describe(appState.language) ?? '',
    })
});

const chatUI = setupChatUI(async (userText) => {
    chatBusy = true;
    try {
        chatUI.showBubble("...", 2000);

        interactionController?.event('chat');

        const aiReply = await conversation.send(userText);

        chatUI.showBubble(aiReply, 6000);

        const duration = aiReply.length * 70;
        if (model) animateMouth(model, duration, aiReply);
    } finally {
        chatBusy = false;
    }
});

const SPONT = {
    firstDelaySec: 90,
    minDelaySec: 180,
    maxDelaySec: 480,
    retrySec: [15, 40],
    minGapSec: 60,
    eventGapSec: 45,
    pendingTries: 4,
};

let spontEnabled = true;
let spontTimer = null;
let spontInflight = false;
let lastSpokeAt = 0;
let pendingKind = null;
let flushing = false;

const randBetween = (a, b) => a + Math.random() * (b - a);

function isBusy() {
    if (chatBusy || press) return true;
    const input = document.getElementById('chat-input');
    if (input && input.value.trim()) return true;
    try { if (model && getTalkLevel(model) > 0.25) return true; } catch {}
    return false;
}

function speakLine(text) {
    const ms = Math.min(9000, Math.max(3500, text.length * 90));
    chatUI.showBubble(text, ms);
    if (model) animateMouth(model, text.length * 70, text);
}

async function trySpeak(kind, { force = false, gapSec = SPONT.minGapSec } = {}) {
    if (spontInflight) return 'blocked';
    if (!force) {
        if (!spontEnabled) return 'blocked';
        if (Date.now() - lastSpokeAt < gapSec * 1000) return 'blocked';
        if (isBusy() || document.hidden) return 'blocked';
    }

    const gender = appState.gender;
    spontInflight = true;
    try {
        const text = await conversation.nudge(kind, {
            accept: () => gender === appState.gender && (force || !isBusy()),
        });
        if (!text) return 'failed';
        lastSpokeAt = Date.now();
        speakLine(text);
        return 'done';
    } catch (err) {
        console.warn('[spontan] gagal:', err);
        return 'failed';
    } finally {
        spontInflight = false;
    }
}

function scheduleSpontaneous(delaySec) {
    clearTimeout(spontTimer);
    if (!spontEnabled) return;

    const mood = interactionController?.getMood() ?? 0.55;
    const sec = delaySec ?? randBetween(SPONT.minDelaySec, SPONT.maxDelaySec) * (1.35 - 0.7 * mood);

    spontTimer = setTimeout(async () => {
        const snap = interactionController?.snapshot();
        const result = snap
            ? await trySpeak(pickSpontaneousKind({ level: snap.level, lonely: snap.lonely }))
            : 'blocked';
        scheduleSpontaneous(result === 'blocked' ? randBetween(...SPONT.retrySec) : undefined);
    }, sec * 1000);
}

async function queueSpontaneous(kind) {
    pendingKind = kind;
    if (flushing) return;
    flushing = true;
    try {
        for (let tries = SPONT.pendingTries; pendingKind && tries > 0; tries--) {
            const result = await trySpeak(pendingKind, { gapSec: SPONT.eventGapSec });
            if (result !== 'blocked') break;
            await new Promise((r) => setTimeout(r, 5000));
        }
    } finally {
        pendingKind = null;
        flushing = false;
    }
}

function bindMoodReactions(ctl) {
    ctl.onLevel(({ next, direction }) => {
        if (direction === 'down' && (next === 'low' || next === 'sad')) queueSpontaneous('mood_drop');
        else if (direction === 'up' && (next === 'happy' || next === 'joyful') && Math.random() < 0.5) queueSpontaneous('mood_up');
    });
    ctl.onAnnoyed(() => queueSpontaneous('annoyed'));
}

window.__companion = {
    get mood() { return interactionController; },
    say: (kind = 'thought') => trySpeak(kind, { force: true }),
    setSpontaneous(on) {
        spontEnabled = Boolean(on);
        if (spontEnabled) scheduleSpontaneous(); else clearTimeout(spontTimer);
    },
};

setTimeout(async () => {
    const storageKey = appState.gender === 'male' ? 'mike_chat_history' : 'kei_chat_history';
    const savedHistory = localStorage.getItem(storageKey);
    let hasHistory = false;
    try { hasHistory = JSON.parse(savedHistory)?.length > 0; } catch {}

    if (hasHistory) {
        const aiReply = await conversation.send("(Sistem: Kamu baru saja menyala kembali. Sapa pengguna dengan hangat dan tanyakan kelanjutan obrolan terakhir.)");
        chatUI.showBubble(aiReply, 6000);
        if (model) animateMouth(model, aiReply.length * 70, aiReply);
    } else {
        const aiGreeting = await conversation.send("(Sistem: Berikan sapaan pembuka yang singkat dan natural, sesuai dengan waktu saat ini.)");
        chatUI.showBubble(aiGreeting, 5000);
        if (model) animateMouth(model, aiGreeting.length * 70, aiGreeting);
    }
}, 2000);

const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const btnCloseSettings = document.getElementById('btn-close-settings');
const sliderScale = document.getElementById('slider-scale');
const sliderY = document.getElementById('slider-y');
const valScale = document.getElementById('val-scale');
const valY = document.getElementById('val-y');

btnSettings.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
btnCloseSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

sliderScale.addEventListener('input', (e) => {
    modelSettings.scale = parseFloat(e.target.value);
    valScale.textContent = modelSettings.scale.toFixed(1);
    positionModel();
});

sliderY.addEventListener('input', (e) => {
    modelSettings.offsetY = parseFloat(e.target.value);
    valY.textContent = modelSettings.offsetY;
    positionModel();
});

const btnMale = document.getElementById('btn-male');
const btnFemale = document.getElementById('btn-female');

async function switchPersona(gender) {
    if (appState.gender === gender) return;
    appState.gender = gender;
    btnMale.classList.toggle('active', gender === 'male');
    btnFemale.classList.toggle('active', gender === 'female');

    pendingKind = null;
    await loadCharacter(gender);

    const greeting = getGreeting({ gender, language: appState.language });
    chatUI.showBubble(greeting, 3000);
}

btnMale.addEventListener('click', () => switchPersona('male'));
btnFemale.addEventListener('click', () => switchPersona('female'));

const btnLangId = document.getElementById('btn-lang-id');
const btnLangEn = document.getElementById('btn-lang-en');

function switchLanguage(lang) {
    if (appState.language === lang) return;
    appState.language = lang;
    btnLangId.classList.toggle('active', lang === 'id');
    btnLangEn.classList.toggle('active', lang === 'en');

    const greeting = getGreeting({ gender: appState.gender, language: lang });
    chatUI.showBubble(greeting, 3000);
}

btnLangId.addEventListener('click', () => switchLanguage('id'));
btnLangEn.addEventListener('click', () => switchLanguage('en'));

const HEAD_RATIO = 0.35;
const INSET_X = 0.15;
const STROKE_DIST = 25;
const STROKE_HOLD_MS = 500; 
const TAP_MS = 400;
const LEAN_RANGE = 60;
const STROKE_MOOD_MS = 800;

let press = null;
let suppressNextClick = false;

function react(type) {
    const line = getReactionLine(type, appState.language);
    if (line) chatUI.showBubble(line, 2000);
}

function toCanvasPoint(e) {
    const rect = app.canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (app.screen.width / rect.width),
        y: (e.clientY - rect.top) * (app.screen.height / rect.height),
    };
}

function hitModel(e) {
    if (!model || !reactions) return null;
    const { x, y } = toCanvasPoint(e);
    const b0 = model.getBounds();
    const b = b0.rectangle ?? b0;
    const dir = x < b.x + b.width / 2 ? 1 : -1;

    try {
        const areas = model.hitTest?.(x, y) ?? [];
        if (areas.length) {
            const isHead = areas.some((n) => /head|face|kepala/i.test(n));
            return { zone: isHead ? 'head' : 'body', dir };
        }
    } catch {}

    const left = b.x + b.width * INSET_X;
    const right = b.x + b.width * (1 - INSET_X);
    if (x < left || x > right || y < b.y || y > b.y + b.height) return null;

    const zone = (y - b.y) / b.height < HEAD_RATIO ? 'head' : 'body';
    return { zone, dir };
}

function startStroke(p) {
    if (!p || p.stroking || !reactions) return;
    p.stroking = true;
    p.strokeStart = performance.now();
    p.ctx = reactions.play('stroke');
    react('stroke');
}

function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.stroking) reactions?.release('stroke');
    press = null;
}

function endPress() {
    if (!press) return;
    const p = press;
    press = null;
    clearTimeout(p.timer);
    if (p.zone !== 'head' || !reactions) return;

    if (p.stroking) {
        reactions.release('stroke');
        if (performance.now() - p.strokeStart > STROKE_MOOD_MS) interactionController?.event('stroke');
    } else if (performance.now() - p.time < TAP_MS) {
        reactions.play('pat');
        interactionController?.event('pat');
        react('pat');
    }
}

canvasContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const hit = hitModel(e);
    suppressNextClick = Boolean(hit);
    if (!hit) { cancelPress(); return; }

    cancelPress();
    press = {
        ...hit,
        startX: e.clientX, lastX: e.clientX, lastY: e.clientY,
        time: performance.now(), dist: 0,
        stroking: false, strokeStart: 0, ctx: null, timer: null,
    };

    if (hit.zone === 'body') {
        reactions.play('poke', { dir: hit.dir });
        interactionController?.event('poke');
        react('poke');
    } else {
        const p = press;
        p.timer = setTimeout(() => startStroke(p), STROKE_HOLD_MS);
    }
});

window.addEventListener('pointermove', (e) => {
    if (press && press.zone === 'head') {
        press.dist += Math.hypot(e.clientX - press.lastX, e.clientY - press.lastY);
        press.lastX = e.clientX;
        press.lastY = e.clientY;
        if (!press.stroking && press.dist > STROKE_DIST) startStroke(press);
        if (press.ctx) {
            press.ctx.lean = Math.max(-1, Math.min(1, (e.clientX - press.startX) / LEAN_RANGE));
        }
        return;
    }
    if (!press && e.target === app.canvas) {
        canvasContainer.style.cursor = hitModel(e) ? 'pointer' : 'default';
    }
});

window.addEventListener('pointerup', endPress);
window.addEventListener('pointercancel', cancelPress);
window.addEventListener('blur', cancelPress);

canvasContainer.addEventListener('click', () => {
    if (suppressNextClick) {
        suppressNextClick = false;
        return;
    }
    chatUI.toggleInput(!chatUI.getIsInputOpen());
});

const btnReset = document.getElementById('btn-reset-memory');
if (btnReset) {
    btnReset.addEventListener('click', () => {
        conversation.reset();
        interactionController?.reset();
        const charName = appState.gender === 'male' ? 'Mike' : 'Kei';
        const resetText = appState.language === 'en'
            ? `${charName}'s memory cleared. Let's start over!`
            : `Memori ${charName} dihapus. Kita mulai dari awal ya!`;
        chatUI.showBubble(resetText, 3000);
    });
}

app.renderer.on('resize', positionModel);

await loadCharacter(appState.gender);
scheduleSpontaneous(SPONT.firstDelaySec);
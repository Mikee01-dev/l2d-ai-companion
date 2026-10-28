import * as PIXI from 'pixi.js';
import { Live2DModel } from '@jannchie/pixi-live2d-display/cubism4';
import { setupInteraction } from './interactions.js';
import { setupChatUI } from './ui/chat.js';
import { animateMouth, getTalkLevel } from './ai/mouth.js';
import { createConversation, getGreeting } from './ai/brain.js';
import { createReactions, getReactionLine } from './ai/reactions.js';

import './style.css';
window.PIXI = PIXI;

let model = null;
let reactions = null;
let loadToken = 0;

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
    const scale = Math.min(w / model.width, h / model.height);
    model.scale.set(scale * 1.4);
    model.anchor.set(0.5, 0.5);
    model.position.set(w / 2, h / 2);
}

async function loadCharacter(gender) {
    const token = ++loadToken;
    try {
        cancelPress();
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

        setupInteraction(model, {
            getTalk: () => getTalkLevel(model)
        });

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
        language: appState.language
    })
});

const chatUI = setupChatUI(async (userText) => {
    chatUI.showBubble("...", 2000);

    const aiReply = await conversation.send(userText);

    chatUI.showBubble(aiReply, 6000);

    const duration = aiReply.length * 70;
    animateMouth(model, duration, aiReply);
});

setTimeout(async () => {
    const storageKey = appState.gender === 'male' ? 'mike_chat_history' : 'kei_chat_history';
    const savedHistory = localStorage.getItem(storageKey);

    let hasHistory = false;
    try { hasHistory = JSON.parse(savedHistory)?.length > 0; } catch {}

    if (hasHistory) {
        const aiReply = await conversation.send("(Sistem: Kamu baru saja menyala kembali. Sapa pengguna dengan hangat dan tanyakan kelanjutan obrolan terakhir.)");
        chatUI.showBubble(aiReply, 6000);
        animateMouth(model, aiReply.length * 70, aiReply);
    } else {
        const aiGreeting = await conversation.send("(Sistem: Berikan sapaan pembuka yang singkat dan natural, sesuai dengan waktu saat ini.)");
        chatUI.showBubble(aiGreeting, 5000);
        animateMouth(model, aiGreeting.length * 70, aiGreeting);
    }
}, 2000);

const btnMale = document.getElementById('btn-male');
const btnFemale = document.getElementById('btn-female');

btnMale.addEventListener('click', async () => {
    if (appState.gender === 'male') return;
    appState.gender = 'male';
    btnMale.classList.add('active');
    btnFemale.classList.remove('active');

    await loadCharacter('male');

    const greeting = getGreeting({ gender: 'male', language: appState.language });
    chatUI.showBubble(greeting, 3000);
});

btnFemale.addEventListener('click', async () => {
    if (appState.gender === 'female') return;
    appState.gender = 'female';
    btnFemale.classList.add('active');
    btnMale.classList.remove('active');

    await loadCharacter('female');

    const greeting = getGreeting({ gender: 'female', language: appState.language });
    chatUI.showBubble(greeting, 3000);
});

const btnLangId = document.getElementById('btn-lang-id');
const btnLangEn = document.getElementById('btn-lang-en');

btnLangId.addEventListener('click', () => {
    if (appState.language === 'id') return;
    appState.language = 'id';
    btnLangId.classList.add('active');
    btnLangEn.classList.remove('active');

    const greeting = getGreeting({ gender: appState.gender, language: 'id' });
    chatUI.showBubble(greeting, 3000);
});

btnLangEn.addEventListener('click', () => {
    if (appState.language === 'en') return;
    appState.language = 'en';
    btnLangEn.classList.add('active');
    btnLangId.classList.remove('active');

    const greeting = getGreeting({ gender: appState.gender, language: 'en' });
    chatUI.showBubble(greeting, 3000);
});

const HEAD_RATIO = 0.35;
const INSET_X = 0.15;
const STROKE_DIST = 25;
const STROKE_HOLD_MS = 500;
const TAP_MS = 400;
const LEAN_RANGE = 60;

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
    } else if (performance.now() - p.time < TAP_MS) {
        reactions.play('pat');
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
        stroking: false, ctx: null, timer: null,
    };

    if (hit.zone === 'body') {
        reactions.play('poke', { dir: hit.dir });
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

        const charName = appState.gender === 'male' ? 'Mike' : 'Kei';
        const resetText = appState.language === 'en'
            ? `${charName}'s memory cleared. Let's start over!`
            : `Memori ${charName} dihapus. Kita mulai dari awal ya!`;

        chatUI.showBubble(resetText, 3000);
    });
}

app.renderer.on('resize', positionModel);

await loadCharacter('male');
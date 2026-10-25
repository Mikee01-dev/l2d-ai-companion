import * as PIXI from 'pixi.js';
import { Live2DModel } from '@jannchie/pixi-live2d-display/cubism4';
import { setupInteraction } from './interactions.js'; 
import { setupChatUI } from './ui/chat.js';       
import { animateMouth, getTalkLevel } from './ai/mouth.js';
import { createConversation, getGreeting } from './ai/brain.js';

import './style.css';
window.PIXI = PIXI;

let model = null;
const container = document.getElementById('canvas-container');
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

app.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('WebGL context lost');
});

app.canvas.addEventListener('webglcontextrestored', async () => {
    console.warn('WebGL context restored, reload model');
    if (model) {
        app.stage.removeChild(model);
        model.destroy();
        model = null;
    }
    await loadModel();
});

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

const btnClose = document.getElementById('btn-close');
const btnMinimize = document.getElementById('btn-minimize');

btnClose.addEventListener('click', () => {
    window.electronAPI.closeWindow();
});

btnMinimize.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
});

async function loadModel() {
    try {
        model = await Live2DModel.from(
            '/assets/live2d/kei_vowels_pro/runtime/kei_vowels_pro.model3.json'
        );
        app.stage.addChild(model);
        positionModel(); 

        setupInteraction(model, {
            getTalk: () => getTalkLevel(model)
        });
        console.log('Model berhasil di-load!');
    } catch (error) {
        console.error('Gagal load model:', error);
    }
}

const appState = {
    gender: 'male',
    language: 'id',
    userName: ''
};

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

setTimeout(() => {
    const greeting = getGreeting({ gender: appState.gender, language: appState.language });
    chatUI.showBubble(greeting, 5000);
}, 2000);

const btnMale = document.getElementById('btn-male');
const btnFemale = document.getElementById('btn-female');

btnMale.addEventListener('click', () => {
    if (appState.gender === 'male') return;
    appState.gender = 'male';
    conversation.reset();
    btnMale.classList.add('active');
    btnFemale.classList.remove('active');
    
    const greeting = getGreeting({ gender: 'male', language: appState.language });
    chatUI.showBubble(greeting, 3000);
});

btnFemale.addEventListener('click', () => {
    if (appState.gender === 'female') return;
    appState.gender = 'female';
    conversation.reset();
    btnFemale.classList.add('active');
    btnMale.classList.remove('active');
    
    const greeting = getGreeting({ gender: 'female', language: appState.language });
    chatUI.showBubble(greeting, 3000);
});

const btnLangId = document.getElementById('btn-lang-id');
const btnLangEn = document.getElementById('btn-lang-en');

btnLangId.addEventListener('click', () => {
    if (appState.language === 'id') return;
    appState.language = 'id';
    conversation.reset();
    btnLangId.classList.add('active');
    btnLangEn.classList.remove('active');
    
    const greeting = getGreeting({ gender: appState.gender, language: 'id' });
    chatUI.showBubble(greeting, 3000);
});

btnLangEn.addEventListener('click', () => {
    if (appState.language === 'en') return;
    appState.language = 'en';
    conversation.reset();
    btnLangEn.classList.add('active');
    btnLangId.classList.remove('active');
    
    const greeting = getGreeting({ gender: appState.gender, language: 'en' });
    chatUI.showBubble(greeting, 3000);
});

const clickOverlay = document.getElementById('click-overlay');
clickOverlay.addEventListener('click', () => {
    if (chatUI.getIsInputOpen()) {
        chatUI.toggleInput(false);
    } else {
        chatUI.toggleInput(true);
    }
});

app.renderer.on('resize', positionModel);

await loadModel();
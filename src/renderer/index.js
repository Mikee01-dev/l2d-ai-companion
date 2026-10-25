import * as PIXI from 'pixi.js';
import { Live2DModel } from '@jannchie/pixi-live2d-display/cubism4';
import { setupInteraction } from './interactions.js'; 
import { setupChatUI } from './ui/chat.js';       
import { animateMouth, getTalkLevel } from './ai/mouth.js';     
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

const chatUI = setupChatUI((userText) => {
    
    setTimeout(() => {
        const dummyReply = `Hey there! I'm not yet integrated with LLM, maybe next time?`;
        
        chatUI.showBubble(dummyReply, 5000);
        
        const duration = dummyReply.length * 50; 
        animateMouth(model, duration);

        animateMouth(model, duration, dummyReply);
        
    }, 1000);
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
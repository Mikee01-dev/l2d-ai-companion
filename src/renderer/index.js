import * as PIXI from 'pixi.js';
import { Live2DModel } from '@jannchie/pixi-live2d-display/cubism4';
import { setupInteraction } from './interactions';
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

async function loadModel() {
    try {
        model = await Live2DModel.from(
            '/assets/live2d/kei_vowels_pro/runtime/kei_vowels_pro.model3.json'
        );
        app.stage.addChild(model);
        positionModel(); 

        setupInteraction(model, app);
        console.log('Model berhasil di-load!');
    } catch (error) {
        console.error('Gagal load model:', error);
    }
}

app.renderer.on('resize', positionModel);

await loadModel();
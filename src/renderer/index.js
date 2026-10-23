import * as PIXI from 'pixi.js';

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,
  backgroundAlpha: 0,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.getElementById('canvas-container').appendChild(app.view);

const box = new PIXI.Graphics();
box.beginFill(0x0000ff);
box.drawRect(0, 0, 100, 100);
box.endFill();
box.x = window.innerWidth / 2 - 50;
box.y = window.innerHeight / 2 - 50;

app.stage.addChild(box);

app.ticker.add(() => {
  box.rotation += 0.02;
});
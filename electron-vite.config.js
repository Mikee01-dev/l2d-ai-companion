import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@pixi/core': 'pixi.js',
        '@pixi/display': 'pixi.js',
        '@pixi/utils': 'pixi.js',
        '@pixi/math': 'pixi.js',
        '@pixi/ticker': 'pixi.js',
        '@pixi/app': 'pixi.js',
        '@pixi/settings': 'pixi.js',
        '@pixi/constants': 'pixi.js',
      }
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'src/renderer/live2dcubismcore.min.js', 
            dest: '.'
          }
        ]
      })
    ],
    optimizeDeps: {
      include: ['pixi-live2d-display-lipsyncpatch/cubism4'],
      exclude: ['pixi.js']
    }
  }
})
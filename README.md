# Mike - L2D AI Companion

A lightweight, transparent desktop companion powered by **Live2D** and **LLM**. 
Unlike typical "AI waifu" projects, this companion features a custom-designed male character (chibi style) with a calm, attentive personality.

## Features (Work in Progress)
- [x] Transparent Electron window (always on top).
- [x] Project setup with `electron-vite` (dev server & build).
- [x] Basic renderer with "Hello World" placeholder.
- [ ] Custom rigged male chibi model (Half-body).
- [ ] Mouse tracking (eyes & head follow cursor).
- [ ] Auto-blink & breathing animation.
- [ ] LLM integration for dynamic conversation.
- [ ] TTS with lip-sync (`ParamMouthOpenY`).
- [ ] Long-term memory.

## Tech Stack
- **Desktop Shell:** Electron + electron-vite
- **Rendering:** PixiJS v7 + pixi-live2d-display (coming soon)
- **Model:** Custom Live2D Cubism (Male Chibi)
- **AI Brain:** [TBD - OpenAI / DeepSeek / Groq]

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/username-kamu/l2d-ai-companion.git
   cd l2d-ai-companion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development**
   ```bash
   npm run dev
   ```
   *Note: Currently, the app opens a transparent window with a "Hello World!" placeholder. Live2D rendering will be added in Week 1.*

## About the Character
**Mike** is a chibi male companion. He is calm, observant, and occasionally teasing. 
*(Rigging notes: Half-body, focusing on eye tracking, mouth sync, and subtle breathing.)*

## Roadmap
- **Week 1:** Foundation & Visual (Electron setup, Live2D rendering, mouse tracking).
- **Week 2:** Brain & Voice (LLM API, TTS, Chat UI).
- **Week 3:** Polish & Sync (Lip-sync, Emotion mapping, Memory).

## License
The code is MIT licensed. 
**Note:** The Live2D model assets are **NOT** included in this repository. Please use your own model or ensure you have the proper license for any third-party models.

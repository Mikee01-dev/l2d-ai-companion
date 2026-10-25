# L2D AI Companion

A lightweight, transparent desktop companion powered by **Live2D** and **LLM**. 
Unlike typical "AI waifu" projects, this companion is designed to be **universal**—featuring a custom-rigged character, multi-language support, and dynamic personality switching.

## Features
- [x] Transparent Electron window (always on top).
- [x] Custom rigged Live2D model (Half-body).
- [x] Advanced behavior system (Idle, Curious, Sleepy, Yawn).
- [x] Mouse tracking & real-time lip-sync.
- [x] LLM integration (Groq API) with context-aware conversation.
- [x] Multi-persona (Male / Female) & Multi-language (ID / EN).
- [x] Chat UI with speech bubbles.
- [ ] TTS (Text-to-Speech) integration (In Progress).
- [ ] Long-term memory (Coming soon).

## Tech Stack
- **Desktop Shell:** Electron + electron-vite
- **Rendering:** PixiJS v8 + `@jannchie/pixi-live2d-display`
- **AI Brain:** Groq API (Llama 3)
- **Model:** Live2D Cubism (Custom / Sample)
- **Language:** JavaScript (ES Modules)

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Mikee01-dev/l2d-ai-companion.git
cd l2d-ai-companion
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory and add your Groq API Key:
```env
VITE_GROQ_API_KEY=your_api_key_here
```

### 3. Add Your Live2D Model
- Place your model folder in `src/renderer/public/assets/live2d/your-model/`.
- Open `src/renderer/index.js` and update the `MODEL_PATHS`:
```javascript
const MODEL_PATHS = {
    male: '/assets/live2d/your-model/your-model.model3.json',
    female: '/assets/live2d/hiyori/hiyori_pro_t11.model3.json' 
};
```

### 4. Run in Development
```bash
npm run dev
```

## About the Characters
This project supports multiple personas:
- **Mike:** A calm, attentive, and slightly teasing male companion.
- **Kei:** A warm, gentle, and playful female companion.

*(Note: You can easily add new personas by editing `src/renderer/ai/brain.js`)*

## Roadmap
- **Week 1:** Foundation & Visual (Electron, PixiJS, Live2D, Behaviors).
- **Week 2:** Brain & Voice (LLM, Chat UI, TTS, Lip-sync).
- **Week 3:** Memory & Polish (Long-term memory, UI Settings, System Tray).

## License
The code is MIT licensed. 
**Note:** The Live2D model assets are **NOT** included in this repository. Please use your own model or ensure you have the proper license for any third-party models.

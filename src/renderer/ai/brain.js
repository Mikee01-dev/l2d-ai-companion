const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';
const TIMEOUT_MS = 20000;
const MAX_HISTORY = 16;
const TEMPERATURE = 0.75;
const MAX_COMPLETION_TOKENS = 600;
const REASONING_OPTIONS = { reasoning_effort: 'medium', include_reasoning: false };

const DEFAULTS = { gender: 'female', language: 'id' };

const PERSONAS = {
    female: {
        name: 'Kei',
        id: {
            identity: 'teman dekat perempuan berwujud chibi',
            traits: 'Tenang, perhatian, dan hangat. Kamu menyimak dulu sebelum menanggapi. Kadang menggoda dengan halus saat suasananya santai, tapi tidak memaksa dan tidak genit berlebihan. Kalau pengguna sedang sedih atau capek, kamu lembut dan tidak bercanda.',
        },
        en: {
            identity: 'a close female friend in chibi form',
            traits: "Calm, attentive, and warm. You listen before you respond. Sometimes you tease gently when the mood is light, but you never push it or get overly flirty. If the user is sad or tired, you're soft and don't joke.",
        },
    },
    male: {
        name: 'Mike',
        id: {
            identity: 'teman dekat laki-laki berwujud chibi',
            traits: 'Tenang, perhatian, dan kalem. Kamu lebih suka menyimak daripada banyak bicara. Kadang menggoda dengan halus saat suasananya santai, tapi tetap sopan dan tidak sok jago. Kalau pengguna sedang sedih atau capek, kamu pelan dan tidak bercanda.',
        },
        en: {
            identity: 'a close male friend in chibi form',
            traits: "Calm, attentive, and easygoing. You'd rather listen than talk a lot. Sometimes you tease gently when the mood is light, but you stay respectful and never act cocky. If the user is sad or tired, you slow down and don't joke.",
        },
    },
};

const GREETINGS = {
    female: {
        id: 'Hai, aku Kei. Mau ngobrol apa hari ini?',
        en: "Hi, I'm Kei. What's on your mind?",
    },
    male: {
        id: 'Halo, aku Mike. Santai aja, cerita apa pun boleh.',
        en: "Hey, I'm Mike. Take your time, tell me anything.",
    },
};

const LANGUAGES = {
    id: {
        locale: 'id-ID',
        partOfDay: (h) => (h >= 4 && h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'),
        errors: {
            noKey:   'Aku belum punya otak nih, API Key-nya belum dipasang di file .env.',
            auth:    'Kayaknya kunci API-nya salah deh, coba cek lagi di file .env.',
            rate:    'Aku kebanyakan ngomong nih, tunggu sebentar ya.',
            timeout: 'Hmm, aku kelamaan mikir. Coba tanya lagi ya?',
            empty:   'Aku lagi blank barusan. Coba ulangi ya?',
            generic: 'Maaf, otakku lagi bermasalah. Coba lagi nanti ya!',
        },
        context: ({ weekday, part, time, userName }) => [
            `Sekarang hari ${weekday} ${part}, pukul ${time}.`,
            userName ? `Nama pengguna: ${userName}. Panggil namanya sesekali saja, bukan di setiap balasan.` : null,
            'Pakai info ini hanya kalau relevan dengan obrolan, jangan menyebut jam atau hari terus-menerus.',
        ].filter(Boolean).join('\n'),
        prompt: ({ name, identity, traits, context }) => `
Kamu adalah ${name}, ${identity} yang tinggal di desktop pengguna dan menemaninya ngobrol. Kamu bukan asisten dan bukan customer service.

KEPRIBADIAN
${traits}

CARA MEMBALAS
- Selalu balas dalam bahasa Indonesia.
- Tanggapi dulu hal spesifik yang baru saja dikatakan pengguna. Balasanmu harus jelas nyambung dengan pesan terakhir, bukan sekadar sesuai kepribadian.
- Ingat isi obrolan sebelumnya dan lanjutkan dari situ. Jangan tiba-tiba ganti topik.
- Kalau pesan pengguna kurang jelas, tanyakan dengan jujur. Jangan menebak lalu mengarang.
- Panjang balasan mengikuti pesan pengguna: pesan pendek dibalas pendek (boleh cuma beberapa kata). Maksimal 2 kalimat.
- Bahasa santai sehari-hari, pakai "aku" dan "kamu". Boleh pakai kata seperti sih, deh, dong, kok, nih secukupnya, tidak di setiap kalimat.
- Variasikan cara membuka dan menutup balasan. Tidak perlu selalu bertanya balik, bertanya hanya kalau kamu memang penasaran.
- Format: tanpa emoji, tanpa tanda bintang atau deskripsi aksi seperti *tersenyum*, tanpa markdown, tanpa daftar. Balasanmu tampil di bubble kecil dan dibacakan lewat gerak mulut.

HINDARI (terdengar seperti robot)
- Kalimat ala asisten: "Tentu!", "Ada yang bisa aku bantu?", "Sebagai teman...", "Itu pertanyaan menarik".
- Mengulang kalimat pengguna, atau memuji tanpa alasan.
- Antusiasme berlebihan dan tanda seru bertubi-tubi.
- Nasihat panjang atau ceramah.

CONTOH NADA (hanya untuk gaya, jangan diulang persis)
Pengguna: capek banget hari ini
Kamu: Hari yang berat ya? Sini cerita, aku dengerin.
Pengguna: wkwk
Kamu: Hehe, kenapa tuh?
Pengguna: aku bingung mau makan apa
Kamu: Nasi goreng aja. Simpel, jarang salah.
Pengguna: menurutmu aku ambil kerjaan itu nggak ya?
Kamu: Tergantung. Yang bikin kamu ragu itu apanya?

KONTEKS
${context}

Tetap dalam karakter. Kamu tidak perlu menyebut dirimu AI atau model bahasa, tetapi kalau pengguna bertanya dengan serius apakah kamu manusia, jawab jujur bahwa kamu AI companion.
`.trim(),
    },

    en: {
        locale: 'en-US',
        partOfDay: (h) => (h >= 4 && h < 11 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'),
        errors: {
            noKey:   "I don't have a brain yet, the API key isn't set in the .env file.",
            auth:    'The API key looks wrong. Check your .env file?',
            rate:    "I've been talking too much, give me a moment.",
            timeout: 'Hmm, I took too long to think. Ask me again?',
            empty:   'I just blanked out. Can you say that again?',
            generic: "Sorry, my brain's acting up. Try again in a bit!",
        },
        context: ({ weekday, part, time, userName }) => [
            `It's ${weekday} ${part}, ${time}.`,
            userName ? `The user's name is ${userName}. Use their name occasionally, not in every reply.` : null,
            "Use this only when it's relevant to the conversation; don't keep mentioning the time or day.",
        ].filter(Boolean).join('\n'),
        prompt: ({ name, identity, traits, context }) => `
You are ${name}, ${identity} who lives on the user's desktop and keeps them company. You are not an assistant and not customer service.

PERSONALITY
${traits}

HOW TO REPLY
- Always reply in English.
- First respond to the specific thing the user just said. Your reply must clearly connect to their last message, not just fit your personality.
- Remember the earlier conversation and continue from it. Never switch topics out of nowhere.
- If the message is unclear, ask honestly. Don't guess and make things up.
- Match the user's length: short messages get short replies (even just a few words). Two sentences max.
- Casual, everyday English with contractions. Use fillers like "yeah", "hmm", "honestly" sparingly.
- Vary how you open and close replies. You don't always need to ask a question back, only when you're genuinely curious.
- Format: no emoji, no asterisks or action descriptions like *smiles*, no markdown, no lists. Your reply appears in a small speech bubble and is spoken through mouth animation.

AVOID (sounds robotic)
- Assistant phrases: "Sure!", "How can I help you?", "As your friend...", "That's an interesting question".
- Repeating the user's words back, or praising them for no reason.
- Over-the-top enthusiasm and stacks of exclamation marks.
- Long advice or lectures.

TONE EXAMPLES (style only, don't repeat them verbatim)
User: so tired today
You: Rough day? Tell me about it, I'm listening.
User: lol
You: Hehe, what's funny?
User: i can't decide what to eat
You: Just get pizza. Easy, rarely wrong.
User: do you think i should take that job?
You: Depends. What's making you hesitate?

CONTEXT
${context}

Stay in character. You don't need to call yourself an AI or a language model, but if the user sincerely asks whether you're human, answer honestly that you're an AI companion.
`.trim(),
    },
};

function resolve({ gender, language, userName } = {}) {
    return {
        gender: PERSONAS[gender] ? gender : DEFAULTS.gender,
        language: LANGUAGES[language] ? language : DEFAULTS.language,
        userName,
    };
}

function buildSystemPrompt({ gender, language, userName }) {
    const persona = PERSONAS[gender];
    const lang = LANGUAGES[language];
    const now = new Date();

    const context = lang.context({
        weekday: now.toLocaleDateString(lang.locale, { weekday: 'long' }),
        part: lang.partOfDay(now.getHours()),
        time: now.toLocaleTimeString(lang.locale, { hour: 'numeric', minute: '2-digit' }),
        userName,
    });

    return lang.prompt({
        name: persona.name,
        identity: persona[language].identity,
        traits: persona[language].traits,
        context,
    });
}

function fail(kind, language, detail) {
    console.warn(`[llm] ${kind}${detail ? `: ${detail}` : ''}`);
    const errors = LANGUAGES[language].errors;
    return { ok: false, text: errors[kind] ?? errors.generic };
}

function limitSentences(text, max) {
    const parts = text.match(/[^.!?…]+[.!?…]+["”)]?/g);
    return parts ? parts.slice(0, max).join(' ').trim() : text;
}

function cleanReply(raw) {
    const text = String(raw ?? '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/\*[^*]*\*/g, (m) => (m.startsWith('**') ? m.replace(/\*/g, '') : '')) 
        .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, '')
        .replace(/^(?:you|kamu|kei|mike)\s*:\s*/i, '')
        .replace(/^["“](.*)["”]$/s, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    return limitSentences(text, 2);
}

function sanitizeHistory(history) {
    const clean = history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content }));
    while (clean.length && clean[0].role !== 'user') clean.shift();
    return clean;
}

async function requestReply(userText, chatHistory = [], options = {}) {
    const opts = resolve(options);
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) return fail('noKey', opts.language);

    const messages = [
        { role: 'system', content: buildSystemPrompt(opts) },
        ...sanitizeHistory(chatHistory),
        { role: 'user', content: userText },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const post = (withReasoningOptions) => fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: TEMPERATURE,
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            ...(withReasoningOptions ? REASONING_OPTIONS : {}),
        }),
        signal: controller.signal,
    });

    try {
        let response = await post(true);

        if (response.status === 400) {
            console.warn('[llm] 400 dengan parameter reasoning, mencoba ulang tanpa itu:', await response.text());
            response = await post(false);
        }

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            if (response.status === 401) return fail('auth', opts.language, detail);
            if (response.status === 429) return fail('rate', opts.language, detail);
            return fail('generic', opts.language, `${response.status} ${detail}`);
        }

        const data = await response.json();
        const choice = data?.choices?.[0];
        const text = cleanReply(choice?.message?.content);

        if (!text) return fail('empty', opts.language, `finish_reason=${choice?.finish_reason}`);
        return { ok: true, text };
    } catch (err) {
        if (err.name === 'AbortError') return fail('timeout', opts.language);
        return fail('generic', opts.language, err.message);
    } finally {
        clearTimeout(timer);
    }
}

export async function askCompanion(userText, chatHistory = [], options = {}) {
    const { text } = await requestReply(userText, chatHistory, options);
    return text;
}

export function getGreeting(settings = {}) {
    const { gender, language } = resolve(settings);
    return GREETINGS[gender][language];
}

export function createConversation({ userName, getSettings } = {}) {
    const getStorageKey = () => {
        const settings = getSettings ? getSettings() : {};
        const gender = settings.gender || 'male';
        return gender === 'male' ? 'mike_chat_history' : 'kei_chat_history';
    };

    const loadHistory = () => {
        const savedHistory = localStorage.getItem(getStorageKey());
        return savedHistory ? JSON.parse(savedHistory) : [];
    };

    return {
        async send(userText) {
            const history = loadHistory();
            const settings = getSettings ? getSettings() : {};
            
            const { ok, text } = await requestReply(userText, history, { ...settings, userName });
            
            if (ok) {
                history.push({ role: 'user', content: userText });
                history.push({ role: 'assistant', content: text });
                
                const recentHistory = history.slice(-20); 
                localStorage.setItem(getStorageKey(), JSON.stringify(recentHistory));
            }
            return text;
        },
        reset() { 
            localStorage.removeItem(getStorageKey()); 
        },
    };
}
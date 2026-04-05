/**
 * Optional LLM layer for the civic chatbot.
 *
 * Env:
 *   CHAT_LLM=openai|groq|openrouter|gemini|auto
 *   CHAT_LLM_FALLBACKS=groq,openrouter,openai
 *   OPENAI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY
 *   OPENAI_CHAT_MODEL / GROQ_CHAT_MODEL / OPENROUTER_CHAT_MODEL / GEMINI_CHAT_MODEL
 *   LLM_CACHE_TTL_SECONDS (default: 300)
 *
 * Flow: rule-based backend still computes intent + facts; this module only rewrites
 * the reply in clearer language. Keeps answers grounded and avoids fake DB data.
 */

const axios = require('axios');
const crypto = require('crypto');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const cache = new Map();
let redisClientPromise = null;

function hasRedisConfig() {
    return Boolean(process.env.REDIS_URL);
}

async function getRedisClient() {
    if (!hasRedisConfig()) return null;
    if (redisClientPromise) return redisClientPromise;

    redisClientPromise = (async () => {
        try {
            // Optional dependency: this service still works with in-memory cache if redis is not installed.
            // eslint-disable-next-line global-require
            const { createClient } = require('redis');
            const client = createClient({
                url: process.env.REDIS_URL,
                socket: {
                    connectTimeout: 5000,
                },
            });

            client.on('error', (err) => {
                console.error('[LLM cache] Redis error:', err?.message || err);
            });

            await client.connect();
            return client;
        } catch (err) {
            console.error('[LLM cache] Redis unavailable, using memory cache:', err?.message || err);
            return null;
        }
    })();

    return redisClientPromise;
}

function nowMs() {
    return Date.now();
}

function getTtlMs() {
    const sec = Number(process.env.LLM_CACHE_TTL_SECONDS || 300);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 300_000;
}

function cleanupCache() {
    const now = nowMs();
    for (const [key, value] of cache.entries()) {
        if (!value || value.expiresAt <= now) {
            cache.delete(key);
        }
    }
}

function sanitizeText(input, maxLen = 500) {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    const noControlChars = trimmed.replace(/[\u0000-\u001F\u007F]/g, ' ');
    const noPromptDelimiters = noControlChars
        .replace(/```+/g, ' ')
        .replace(/<\/?script\b[^>]*>/gi, ' ')
        .replace(/<\|.*?\|>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return noPromptDelimiters.slice(0, maxLen);
}

function isRetriableStatus(code) {
    return code === 408 || code === 409 || code === 425 || code === 429 || (code >= 500 && code <= 599);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashCacheKey(payload) {
    return crypto.createHash('sha256').update(payload).digest('hex');
}

function redisKey(hash) {
    return `llm:chat:${hash}`;
}

async function getCachedValue(key) {
    const redis = await getRedisClient();
    if (redis) {
        try {
            const raw = await redis.get(redisKey(key));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed?.text && parsed?.provider && parsed?.model) {
                return parsed;
            }
        } catch (err) {
            console.error('[LLM cache] Redis read failed:', err?.message || err);
        }
    }

    const existing = cache.get(key);
    if (existing && existing.expiresAt > nowMs()) return existing;
    return null;
}

async function setCachedValue(key, value) {
    const ttlMs = getTtlMs();
    const redis = await getRedisClient();
    if (redis) {
        try {
            await redis.set(redisKey(key), JSON.stringify(value), {
                EX: Math.max(1, Math.round(ttlMs / 1000)),
            });
        } catch (err) {
            console.error('[LLM cache] Redis write failed:', err?.message || err);
        }
    }

    cache.set(key, {
        ...value,
        expiresAt: nowMs() + ttlMs,
    });
}

function getPreferredProviders() {
    const configured = (process.env.CHAT_LLM || 'auto').toLowerCase();
    const fallbackCsv = process.env.CHAT_LLM_FALLBACKS || 'groq,openrouter,openai,gemini';
    const fallback = fallbackCsv.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

    const base = configured === 'auto' ? fallback : [configured, ...fallback];
    const unique = [...new Set(base)];

    return unique.filter((provider) => {
        if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
        if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY);
        if (provider === 'openrouter') return Boolean(process.env.OPENROUTER_API_KEY);
        if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
        return false;
    });
}

async function callOpenAI(messages) {
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const { data } = await axios.post(
        OPENAI_URL,
        {
            model,
            temperature: 0.4,
            messages,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            timeout: 45_000,
        }
    );
    return { text: data?.choices?.[0]?.message?.content?.trim() || null, model };
}

async function callGroq(messages) {
    const model = process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
    const { data } = await axios.post(
        GROQ_URL,
        {
            model,
            temperature: 0.3,
            messages,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            timeout: 35_000,
        }
    );
    return { text: data?.choices?.[0]?.message?.content?.trim() || null, model };
}

async function callOpenRouter(messages) {
    const model = process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini';
    const { data } = await axios.post(
        OPENROUTER_URL,
        {
            model,
            temperature: 0.4,
            messages,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://urbanfix.local',
                'X-Title': process.env.OPENROUTER_APP_NAME || 'UrbanFix Backend',
            },
            timeout: 45_000,
        }
    );
    return { text: data?.choices?.[0]?.message?.content?.trim() || null, model };
}

async function callGemini(messages) {
    const model = process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash';
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

    const { data } = await axios.post(
        url,
        {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
            ],
            generationConfig: {
                temperature: 0.4,
            },
        },
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45_000,
        }
    );

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n').trim() || null;
    return { text, model };
}

async function callProvider(provider, messages) {
    if (provider === 'openai') return callOpenAI(messages);
    if (provider === 'groq') return callGroq(messages);
    if (provider === 'openrouter') return callOpenRouter(messages);
    if (provider === 'gemini') return callGemini(messages);
    return { text: null, model: 'unknown' };
}

async function generateWithFallback(messages) {
    const providers = getPreferredProviders();
    if (!providers.length) return null;

    for (const provider of providers) {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const out = await callProvider(provider, messages);
                if (out?.text) {
                    return { text: out.text, provider, model: out.model };
                }
                break;
            } catch (e) {
                const code = e?.response?.status;
                const retriable = isRetriableStatus(code);
                if (!retriable || attempt === 2) {
                    console.error(`[LLM polish] ${provider} failed:`, e.response?.data || e.message);
                    break;
                }
                await sleep(300 * attempt);
            }
        }
    }

    return null;
}

async function polishUrbanFixReply({ userMessage, intent, draftText }) {
    const providers = getPreferredProviders();
    if (!providers.length || !draftText) {
        return null;
    }

    cleanupCache();
    const safeUser = sanitizeText(userMessage, 500);
    const safeDraft = sanitizeText(draftText, 2200);
    if (!safeDraft) return null;

    const system = `You are "UrbanFix AI", a helpful assistant for a civic issue reporting app in India.
You MUST:
- Keep every factual claim from the draft (issue titles, counts, statuses). Do not invent issues or statistics.
- Stay concise (under ~180 words unless the draft is longer).
- Tone: friendly, clear; you may use light Hinglish if the user wrote in Hindi/Hinglish.
- Do not claim you queried a database; just present the information naturally.
- Do NOT hallucinate new issue types, categories, locations, or statuses.
- If uncertain, keep the original draft wording rather than adding new facts.
Intent tag (for context only): ${intent}`;

    const user = `User wrote:\n"""${safeUser}"""\n\nDraft reply to improve:\n"""${safeDraft}"""`;

    const cacheKey = hashCacheKey(JSON.stringify({ intent, safeUser, safeDraft }));
    const existing = await getCachedValue(cacheKey);
    if (existing) {
        return {
            text: existing.text,
            llmProvider: existing.provider,
            llmModel: existing.model,
            llmCacheHit: true,
        };
    }

    const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];

    const generated = await generateWithFallback(messages);
    if (!generated?.text) {
        return null;
    }

    await setCachedValue(cacheKey, {
        text: generated.text,
        provider: generated.provider,
        model: generated.model,
    });

    return {
        text: generated.text,
        llmProvider: generated.provider,
        llmModel: generated.model,
        llmCacheHit: false,
    };
}

async function generateJSON(systemPrompt, userPrompt) {
    const safeSystem = sanitizeText(systemPrompt, 2000);
    const safeUser = sanitizeText(userPrompt, 2500);
    const baseMessages = [
        { role: 'system', content: `${safeSystem}\n\nReturn ONLY valid JSON.` },
        { role: 'user', content: safeUser },
    ];

    const first = await generateWithFallback(baseMessages);
    if (!first?.text) return null;

    try {
        return JSON.parse(first.text);
    } catch {
        const retryMessages = [
            ...baseMessages,
            {
                role: 'user',
                content: 'Your previous reply was not valid JSON. Return ONLY strict JSON with double quotes and no markdown.',
            },
        ];

        const second = await generateWithFallback(retryMessages);
        if (!second?.text) return null;

        try {
            return JSON.parse(second.text);
        } catch {
            return null;
        }
    }
}

module.exports = { polishUrbanFixReply, generateJSON, sanitizeText };

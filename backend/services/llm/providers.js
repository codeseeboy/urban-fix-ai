/**
 * Gemini on Vertex AI — the single LLM provider UrbanFix uses (vision + chat).
 *
 * Auth is Google Application Default Credentials (gcloud ADC), not an API key:
 * on a dev machine that is `gcloud auth application-default login`; on a server
 * it is the attached service account. google-auth-library refreshes tokens and
 * adds the quota-project header for us.
 *
 * Cost controls (all overridable by env):
 *   - Flash-Lite models only            VERTEX_VISION_MODELS / VERTEX_CHAT_MODELS
 *   - low image resolution (~280 tok)   VERTEX_MEDIA_RESOLUTION
 *   - capped output tokens per call     maxOutputTokens argument
 *
 * Reliability: transient failures (429/5xx/timeouts) retry with backoff, and each
 * call walks an ordered model list, so one overloaded model does not fail a report.
 */

const { GoogleAuth } = require('google-auth-library');

const TRANSIENT = new Set([0, 408, 429, 500, 502, 503, 504]);

class ProviderError extends Error {
    constructor(status, message) {
        super(`vertex: ${message}`);
        this.status = status;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function csv(value, fallback) {
    const list = String(value || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return list.length ? list : fallback;
}

const config = {
    project: () => process.env.VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0047539429',
    location: () => process.env.VERTEX_LOCATION || 'global',
    visionModels: () => csv(process.env.VERTEX_VISION_MODELS, ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']),
    chatModels: () => csv(process.env.VERTEX_CHAT_MODELS, ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']),
    mediaResolution: () => process.env.VERTEX_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_LOW',
};

let authClientPromise = null;
let authError = null;

function getAuthClient() {
    if (!authClientPromise) {
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        authClientPromise = auth.getClient().catch((err) => {
            authClientPromise = null; // allow a retry after the user fixes ADC
            authError = err.message;
            throw err;
        });
    }
    return authClientPromise;
}

function endpoint(model) {
    const loc = config.location();
    const host = loc === 'global' ? 'aiplatform.googleapis.com' : `${loc}-aiplatform.googleapis.com`;
    return `https://${host}/v1/projects/${config.project()}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

async function callModel(model, body, timeoutMs) {
    const url = endpoint(model);
    let headers;
    try {
        const client = await getAuthClient();
        headers = await client.getRequestHeaders(url);
    } catch (err) {
        throw new ProviderError(401, `ADC credentials unavailable (${err.message}). Run: gcloud auth application-default login`);
    }

    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        throw new ProviderError(0, err.name === 'TimeoutError' ? `${model} timed out` : err.message);
    }

    const text = await res.text();
    if (!res.ok) {
        let msg = text.slice(0, 300);
        try { msg = JSON.parse(text)?.error?.message || msg; } catch { /* keep raw */ }
        throw new ProviderError(res.status, `${model}: ${msg}`);
    }

    return JSON.parse(text);
}

function candidateText(data, model) {
    const cand = data?.candidates?.[0];
    const out = (cand?.content?.parts || []).map((p) => (p.thought ? '' : p.text || '')).join('').trim();
    if (!out) {
        const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
        throw new ProviderError(502, `${model}: no text (${reason})`);
    }
    return out;
}

/** Walk the model list with retries; `run(model)` does one attempt. */
async function withModels(models, run) {
    let lastErr;
    for (const model of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await run(model);
            } catch (err) {
                lastErr = err;
                if (err.status === 401) throw err; // auth will not fix itself on retry
                if (!TRANSIENT.has(err.status)) break; // bad request / model missing → next model
                if (attempt === 0) await sleep(700);
            }
        }
    }
    throw lastErr;
}

/**
 * Generate content with Gemini on Vertex AI.
 *
 * @param {object} opts
 * @param {Array}  opts.contents          Gemini contents (role + parts). Use inlineData for images.
 * @param {string} [opts.system]          system instruction
 * @param {object} [opts.schema]          responseSchema — forces structured JSON output
 * @param {'vision'|'chat'} [opts.kind]   picks the model list
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxOutputTokens]
 * @param {number} [opts.timeoutMs]       per attempt
 * @returns {Promise<{ text: string, json: any, model: string, usage: object|null }>}
 */
async function generate({
    contents,
    system,
    schema,
    kind = 'chat',
    temperature = 0.3,
    maxOutputTokens = 512,
    timeoutMs = 15000,
}) {
    if (!config.project()) throw new ProviderError(500, 'VERTEX_PROJECT is not set');

    const generationConfig = { temperature, maxOutputTokens };
    if (kind === 'vision') generationConfig.mediaResolution = config.mediaResolution();
    if (schema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = schema;
    }
    const body = { contents, generationConfig };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const models = kind === 'vision' ? config.visionModels() : config.chatModels();
    return withModels(models, async (model) => {
        const data = await callModel(model, body, timeoutMs);
        const text = candidateText(data, model);
        return { text, json: schema ? safeParse(text) : null, model, usage: data.usageMetadata || null };
    });
}

/**
 * One turn of a tool-using conversation.
 *
 * Returns the model's raw `content` so the caller can append it to the history
 * unchanged — Gemini 3 attaches thought signatures to function calls and rejects
 * the follow-up request if they are stripped. Pass `model` back in on later turns
 * so a multi-step tool loop stays on the model that produced those signatures.
 *
 * @returns {Promise<{ content: object, text: string, functionCalls: Array<{name, args}>, model: string, usage: object|null }>}
 */
async function chat({ contents, system, tools, model, temperature = 0.4, maxOutputTokens = 500, timeoutMs = 20000 }) {
    if (!config.project()) throw new ProviderError(500, 'VERTEX_PROJECT is not set');
    const body = { contents, generationConfig: { temperature, maxOutputTokens } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (tools?.length) body.tools = [{ functionDeclarations: tools }];

    return withModels(model ? [model] : config.chatModels(), async (m) => {
        const data = await callModel(m, body, timeoutMs);
        const cand = data?.candidates?.[0];
        const content = cand?.content || { role: 'model', parts: [] };
        const parts = content.parts || [];
        const functionCalls = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
        const text = parts.map((p) => (p.thought ? '' : p.text || '')).join('').trim();
        if (!functionCalls.length && !text) {
            throw new ProviderError(502, `${m}: empty reply (${cand?.finishReason || 'unknown'})`);
        }
        return { content: { role: 'model', parts }, text, functionCalls, model: m, usage: data.usageMetadata || null };
    });
}

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        const match = String(text).match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* fall through */ }
        }
        return null;
    }
}

function status() {
    return {
        provider: 'vertex-ai',
        project: config.project() || null,
        location: config.location(),
        visionModels: config.visionModels(),
        chatModels: config.chatModels(),
        mediaResolution: config.mediaResolution(),
        authError,
    };
}

module.exports = { generate, chat, status, safeParse, ProviderError };

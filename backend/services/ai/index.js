/**
 * AI/ML Service Abstraction Layer
 * 
 * Provides a unified interface for all AI/ML capabilities.
 * When AI_SERVICE_URL is set, calls the FastAPI Python service
 * for real CV-based detection. Falls back to rule-based logic.
 */

const store = require('../../data/store');
const supabase = require('../../config/supabase');

// ─── Configuration ──────────────────────────────────────────────────────────

const AI_CONFIG = {
    provider: process.env.AI_PROVIDER || 'rules',     // 'rules' | 'fastapi' | 'openai' | 'aws'
    serviceUrl: process.env.AI_SERVICE_URL || null,    // e.g. https://urbanfix-ai.onrender.com
    // Support both names to avoid deploy-time env mismatch.
    serviceApiKey: process.env.AI_SERVICE_API_KEY || process.env.AI_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || null,
    awsRegion: process.env.AWS_REGION || 'ap-south-1',
    modelEndpoint: process.env.AI_MODEL_ENDPOINT || null,
    enableLogging: process.env.AI_LOGGING === 'true',
};

function log(context, message, data) {
    if (AI_CONFIG.enableLogging) {
        console.log(`[AI/${context}] ${message}`, data || '');
    }
}

// ─── FastAPI Integration ─────────────────────────────────────────────────────

/**
 * Call the FastAPI AI service to analyze an image.
 * Sends the image as multipart/form-data, receives full pipeline results.
 * @param {Buffer} imageBuffer - raw image bytes
 * @param {string} filename - original filename
 * @returns {object|null} - FastAPI analysis result or null on failure
 */
async function callFastAPIAnalyze(imageBuffer, filename) {
    if (!AI_CONFIG.serviceUrl) return null;

    try {
        const FormData = (await import('form-data')).default;
        const form = new FormData();

        // Detect content-type from filename extension
        const ext = (filename || '').split('.').pop().toLowerCase();
        const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp' };
        const contentType = mimeMap[ext] || 'image/jpeg';

        form.append('file', imageBuffer, {
            filename: filename || 'image.jpg',
            contentType,
        });

        const formBuffer = form.getBuffer();
        const headers = { ...form.getHeaders(), 'Content-Length': formBuffer.length };
        if (AI_CONFIG.serviceApiKey) {
            headers['Authorization'] = `Bearer ${AI_CONFIG.serviceApiKey}`;
        }

        const response = await fetch(`${AI_CONFIG.serviceUrl}/analyze`, {
            method: 'POST',
            headers,
            body: formBuffer,
            signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
            log('fastapi', `HTTP ${response.status}: ${response.statusText}`);
            return null;
        }

        const result = await response.json();
        log('fastapi', 'Analysis complete', {
            category: result.category,
            severity: result.ai_severity,
            priority: result.priority_score,
            issues: result.issue_count,
        });
        return result;
    } catch (err) {
        log('fastapi', `Call failed: ${err.message}`);
        return null;
    }
}

// ─── 1. Image Classification ────────────────────────────────────────────────

async function detectIssueInImage(imageUrl, imageBuffer, filename) {
    log('detectIssue', 'Analyzing image', { imageUrl: imageUrl?.substring(0, 80) });

    // Try FastAPI service first (real CV models)
    if ((AI_CONFIG.provider === 'fastapi' || AI_CONFIG.serviceUrl) && imageBuffer) {
        const fastResult = await callFastAPIAnalyze(imageBuffer, filename);
        if (fastResult) {
            return {
                isValid: fastResult.is_valid,
                validationReason: fastResult.validation_reason,
                detectedCategory: fastResult.category,
                confidence: fastResult.category_confidence,
                tags: fastResult.ai_tags || [],
                detectedIssues: fastResult.detected_issues || [],
                mainIssue: fastResult.main_issue,
                aiSeverity: fastResult.ai_severity,
                priorityScore: fastResult.priority_score,
                departmentTag: fastResult.department_tag,
                size: fastResult.size,
                issueCount: fastResult.issue_count,
                needsUserConfirmation: fastResult.needs_user_confirmation,
                floodScore: fastResult.flood_score,
                note: fastResult.note,
                provider: 'fastapi',
            };
        }
    }

    // Rule-based fallback
    return {
        isValid: true,
        detectedCategory: null,
        confidence: 0,
        tags: ['civic', 'infrastructure'],
        provider: 'rules',
    };
}

// ─── 2. Severity Scoring ────────────────────────────────────────────────────

const CATEGORY_SEVERITY_MAP = {
    roads: { base: 'Medium', emergency: 'Critical' },
    lighting: { base: 'High', emergency: 'Critical' },
    trash: { base: 'Low', emergency: 'Medium' },
    water: { base: 'Medium', emergency: 'Critical' },
    parks: { base: 'Low', emergency: 'Medium' },
    drainage: { base: 'Medium', emergency: 'High' },
    electricity: { base: 'High', emergency: 'Critical' },
    safety: { base: 'High', emergency: 'Critical' },
    other: { base: 'Low', emergency: 'Medium' },
};

async function calculateSeverity({ category, description, emergency, imageAnalysis }) {
    log('severity', 'Scoring', { category, emergency });

    if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openaiKey) {
        // FUTURE: LLM-based severity assessment
        // const prompt = `Given a civic issue: category=${category}, description="${description}", 
        //   emergency=${emergency}. Rate severity: Low, Medium, High, or Critical.`;
        // return await callOpenAI(prompt);
    }

    if (AI_CONFIG.provider === 'custom' && AI_CONFIG.modelEndpoint) {
        // FUTURE: Custom ML model endpoint
        // const response = await fetch(AI_CONFIG.modelEndpoint + '/severity', {
        //     method: 'POST', body: JSON.stringify({ category, description, emergency, imageAnalysis })
        // });
        // return (await response.json()).severity;
    }

    // Rule-based
    if (emergency) return 'Critical';
    const mapping = CATEGORY_SEVERITY_MAP[category] || CATEGORY_SEVERITY_MAP.other;
    return mapping.base;
}

// ─── 3. Priority Scoring ────────────────────────────────────────────────────

async function calculatePriority({ severity, upvoteCount, category, createdAt, emergency }) {
    log('priority', 'Calculating', { severity, upvoteCount });

    // Rule-based scoring (replace with ML model)
    let score = 0;
    const severityScores = { Critical: 40, High: 30, Medium: 20, Low: 10 };
    score += severityScores[severity] || 15;
    score += Math.min(upvoteCount * 3, 30);
    if (emergency) score += 20;

    const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
    if (ageHours > 168) score += 10; // > 1 week old gets urgency boost

    return Math.min(Math.round(score), 100);
}

// ─── 4. Duplicate Detection ─────────────────────────────────────────────────

async function checkDuplicate({ latitude, longitude, category, description }) {
    log('duplicate', 'Checking', { latitude, longitude, category });

    if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openaiKey) {
        // FUTURE: Semantic similarity with embeddings
        // const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: description });
        // Search Pinecone/pgvector for similar vectors in same area
    }

    // Rule-based: check for same-category issues within 50m
    try {
        const { data: nearby } = await supabase
            .from('issues')
            .select('id, title, category, status')
            .eq('category', category)
            .neq('status', 'Resolved')
            .limit(5);

        if (nearby && nearby.length > 0) {
            return {
                isDuplicate: false,
                potentialMatches: nearby.map(i => ({ id: i.id, title: i.title })),
                provider: 'rules',
            };
        }
    } catch (e) { /* silent */ }

    return { isDuplicate: false, potentialMatches: [], provider: 'rules' };
}

// ─── 5. Department Routing ──────────────────────────────────────────────────

const DEPT_MAP = {
    roads: 'PWD', lighting: 'Electrical', trash: 'Sanitation',
    water: 'Water Supply', parks: 'Horticulture', drainage: 'Drainage',
    electricity: 'Electrical', safety: 'Safety', other: 'General',
};

async function routeToDepartment(category) {
    // FUTURE: ML-based multi-label classification for complex routing
    return DEPT_MAP[category] || 'General';
}

// ─── 6. AI Tags Generation ──────────────────────────────────────────────────

async function generateTags({ category, description, title }) {
    log('tags', 'Generating', { category });

    if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openaiKey) {
        // FUTURE: LLM-based tag extraction
    }

    const tags = [category];
    const keywords = {
        pothole: 'road-damage', broken: 'infrastructure', garbage: 'sanitation',
        flood: 'drainage', dark: 'lighting', leak: 'water-supply',
        danger: 'safety', tree: 'horticulture',
    };
    const text = `${title} ${description}`.toLowerCase();
    for (const [keyword, tag] of Object.entries(keywords)) {
        if (text.includes(keyword)) tags.push(tag);
    }
    return [...new Set(tags)].slice(0, 5);
}

// ─── Unified analyze function (called during issue creation) ────────────────

async function analyzeIssue({ category, description, title, emergency, imageUrl, latitude, longitude, imageBuffer, filename }) {
    // If FastAPI service is available AND we have an image buffer, get full CV results
    if ((AI_CONFIG.provider === 'fastapi' || AI_CONFIG.serviceUrl) && imageBuffer) {
        const cvResult = await callFastAPIAnalyze(imageBuffer, filename);
        if (cvResult && cvResult.is_valid !== false) {
            const duplicateCheck = await checkDuplicate({
                latitude, longitude,
                category: cvResult.category || category,
                description,
            });

            return {
                aiSeverity: cvResult.ai_severity || 'Medium',
                departmentTag: cvResult.department_tag || DEPT_MAP[category] || 'General',
                aiTags: cvResult.ai_tags || [category],
                priorityScore: cvResult.priority_score || 0,
                duplicate: duplicateCheck,
                detectedIssues: cvResult.detected_issues || [],
                mainIssue: cvResult.main_issue,
                isValid: cvResult.is_valid,
                needsUserConfirmation: cvResult.needs_user_confirmation,
                provider: 'fastapi',
            };
        } else if (cvResult && cvResult.is_valid === false) {
            return {
                aiSeverity: 'Low',
                departmentTag: 'General',
                aiTags: ['rejected'],
                priorityScore: 0,
                duplicate: { isDuplicate: false, potentialMatches: [] },
                isValid: false,
                validationReason: cvResult.validation_reason || cvResult.note,
                provider: 'fastapi',
            };
        }
        // If FastAPI call failed, fall through to rules
    }

    // Rule-based fallback
    const [severity, department, tags, duplicateCheck] = await Promise.all([
        calculateSeverity({ category, description, emergency }),
        routeToDepartment(category),
        generateTags({ category, description, title }),
        checkDuplicate({ latitude, longitude, category, description }),
    ]);

    const priority = await calculatePriority({
        severity, upvoteCount: 0, category, createdAt: new Date(), emergency,
    });

    return {
        aiSeverity: severity,
        departmentTag: department,
        aiTags: tags,
        priorityScore: priority,
        duplicate: duplicateCheck,
        provider: AI_CONFIG.provider,
    };
}

module.exports = {
    detectIssueInImage,
    callFastAPIAnalyze,
    calculateSeverity,
    calculatePriority,
    checkDuplicate,
    routeToDepartment,
    generateTags,
    analyzeIssue,
    AI_CONFIG,
};

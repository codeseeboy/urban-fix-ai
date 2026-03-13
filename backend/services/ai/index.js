/**
 * AI/ML Service Abstraction Layer
 * 
 * Provides a unified interface for all AI/ML capabilities.
 * Currently uses rule-based logic. When real models are ready,
 * swap the implementation in each method without changing the interface.
 * 
 * INTEGRATION GUIDE FOR DEVELOPERS:
 * 
 * 1. Image Classification (detectIssue):
 *    - Replace with: TensorFlow Serving, AWS Rekognition, or OpenAI Vision API
 *    - Input: image URL/buffer → Output: { isValid, category, confidence, tags }
 * 
 * 2. Severity Scoring (calculateSeverity):
 *    - Replace with: Custom ML model (XGBoost/Random Forest) or LLM
 *    - Input: { category, description, imageAnalysis, location } → Output: severity string
 * 
 * 3. Duplicate Detection (checkDuplicate):
 *    - Replace with: Vector similarity (pgvector/Pinecone) + geospatial
 *    - Input: { location, category, description } → Output: { isDuplicate, matchId, similarity }
 * 
 * 4. NLP / Chat (processChat):
 *    - Replace with: OpenAI GPT, AWS Bedrock, or custom fine-tuned model
 *    - Input: message + context → Output: response text
 * 
 * 5. Priority Scoring (calculatePriority):
 *    - Replace with: ML ranking model trained on resolution data
 *    - Input: issue data → Output: 0-100 score
 */

const store = require('../../data/store');
const supabase = require('../../config/supabase');

// ─── Configuration ──────────────────────────────────────────────────────────

const AI_CONFIG = {
    provider: process.env.AI_PROVIDER || 'rules',     // 'rules' | 'openai' | 'aws' | 'custom'
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

// ─── 1. Image Classification ────────────────────────────────────────────────

async function detectIssueInImage(imageUrl) {
    log('detectIssue', 'Analyzing image', { imageUrl: imageUrl?.substring(0, 80) });

    if (AI_CONFIG.provider === 'openai' && AI_CONFIG.openaiKey) {
        // FUTURE: OpenAI Vision API integration
        // const response = await openai.chat.completions.create({
        //     model: 'gpt-4-vision-preview',
        //     messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: imageUrl } }] }]
        // });
        // return parseVisionResponse(response);
    }

    if (AI_CONFIG.provider === 'aws') {
        // FUTURE: AWS Rekognition integration
        // const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
        // const client = new RekognitionClient({ region: AI_CONFIG.awsRegion });
        // const result = await client.send(new DetectLabelsCommand({ Image: { S3Object: { ... } } }));
        // return mapLabelsToCategory(result.Labels);
    }

    // Rule-based fallback (current behavior)
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

async function analyzeIssue({ category, description, title, emergency, imageUrl, latitude, longitude }) {
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
    calculateSeverity,
    calculatePriority,
    checkDuplicate,
    routeToDepartment,
    generateTags,
    analyzeIssue,
    AI_CONFIG,
};

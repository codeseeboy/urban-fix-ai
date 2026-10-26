const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config({ path: path.join(__dirname, '.env') });

const { initFirebase } = require('./config/firebase');
const { startPromoScheduler } = require('./services/promoScheduler');

// Eagerly initialise Firebase Admin so push notifications work from the first request
initFirebase();

const app = express();
app.disable('etag');

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Static serving kept only for legacy URLs; new uploads go to Supabase Storage
app.use('/public', express.static(require('path').join(__dirname, 'public')));
app.use(require('./middleware/requestLogger'));

app.get('/', (req, res) => {
    res.json({ status: 'UrbanFix AI API is running', version: '1.0.0', database: 'Supabase PostgreSQL' });
});

// Connectivity check used by the apps on launch: is the API up, can it reach
// the database, and is the AI provider configured.
app.get('/api/health', async (req, res) => {
    const supabase = require('./config/supabase');
    const { status: aiStatus } = require('./services/llm/providers');
    const started = Date.now();
    let db = 'up';
    try {
        const { error } = await supabase.from('issues').select('id', { head: true, count: 'exact' }).limit(1);
        if (error) db = 'down';
    } catch {
        db = 'down';
    }
    res.status(db === 'up' ? 200 : 503).json({ ok: db === 'up', db, dbLatencyMs: Date.now() - started, ai: aiStatus(), time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes'));
app.use('/api/gamification', require('./routes/gamificationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/municipal', require('./routes/municipal'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/bda', require('./routes/bdaRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ UrbanFix AI API running on http://localhost:${PORT}`);
    console.log(`🗄️  Database: Supabase PostgreSQL`);
    console.log(`📡 Project: ${process.env.SUPABASE_URL || 'NOT SET'}`);

    // Engagement reminders are opt-in so a local/dev server never pushes to real users.
    if (process.env.PROMO_NOTIFICATIONS === 'true') startPromoScheduler();
});

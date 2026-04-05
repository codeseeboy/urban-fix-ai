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

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes'));
app.use('/api/gamification', require('./routes/gamificationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/municipal', require('./routes/municipal'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ UrbanFix AI API running on http://localhost:${PORT}`);
    console.log(`🗄️  Database: Supabase PostgreSQL`);
    console.log(`📡 Project: ${process.env.SUPABASE_URL || 'NOT SET'}`);

    // Start promotional notification scheduler
    startPromoScheduler();
});

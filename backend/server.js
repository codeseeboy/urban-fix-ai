const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ UrbanFix AI API running on http://localhost:${PORT}`);
    console.log(`🗄️  Database: Supabase PostgreSQL`);
    console.log(`📡 Project: ${process.env.SUPABASE_URL || 'NOT SET'}`);
});

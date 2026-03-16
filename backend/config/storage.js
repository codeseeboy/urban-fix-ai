const supabase = require('./supabase');
const path = require('path');

const BUCKET = 'uploads';

async function ensureBucket() {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error && error.message.includes('not found')) {
        await supabase.storage.createBucket(BUCKET, {
            public: true,
            fileSizeLimit: 52428800,
            allowedMimeTypes: ['image/*', 'video/*'],
        });
        console.log('Created Supabase storage bucket:', BUCKET);
    }
}

ensureBucket().catch(e => console.error('Storage bucket init error:', e.message));

async function uploadFile(file) {
    if (!file || !file.buffer) return null;

    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    const filePath = uniqueName;

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
        });

    if (error) {
        console.error('Supabase upload error:', error.message);
        return null;
    }

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

module.exports = { uploadFile };

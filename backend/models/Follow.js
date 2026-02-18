const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
    followerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    followingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MunicipalPage',
        required: true
    },
    notificationsEnabled: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now }
});

// Compound index to ensure unique follows
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema);

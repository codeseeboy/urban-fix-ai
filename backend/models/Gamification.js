const mongoose = require('mongoose');

const badgeSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    description: String,
    icon: String, // URL or Icon Name
    criteria: String, // Description of how to earn
});

const rewardSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    points: {
        type: Number,
        required: true,
    },
    reason: {
        type: String, // 'Report Issue', 'Vote', 'Resolved'
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = {
    Badge: mongoose.model('Badge', badgeSchema),
    Reward: mongoose.model('Reward', rewardSchema),
};

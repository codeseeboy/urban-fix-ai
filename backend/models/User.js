const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['citizen', 'admin', 'department_admin', 'field_worker', 'super_admin'],
        default: 'citizen',
    },
    points: {
        type: Number,
        default: 0,
    },
    badges: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
    }],
    reportsResolved: {
        type: Number,
        default: 0,
    },
    impactScore: {
        type: Number,
        default: 0,
    },
    region: {
        type: String,
        default: 'General',
    },
    avatar: {
        type: String,
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const statusUpdateSchema = mongoose.Schema({
    status: {
        type: String,
        enum: ['Submitted', 'Acknowledged', 'InProgress', 'Resolved', 'Rejected'],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    comment: String,
});

const issueSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    image: {
        type: String, // URL
        required: true,
    },
    mediaProof: [String], // Additional proof images
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
        },
        address: String,
    },
    departmentTag: {
        type: String,
        default: 'General',
    },
    status: {
        type: String,
        enum: ['Submitted', 'Acknowledged', 'InProgress', 'Resolved', 'Rejected'],
        default: 'Submitted',
    },
    statusTimeline: [statusUpdateSchema],
    priorityScore: {
        type: Number,
        default: 0,
    },
    aiSeverity: {
        type: String, // 'High', 'Medium', 'Low'
    },
    aiTags: [String],
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Field Worker or Admin
    },
    resolutionProof: String, // URL
}, {
    timestamps: true,
});

issueSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Issue', issueSchema);

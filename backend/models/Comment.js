const mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    issue: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Issue',
        required: true,
    },
    text: {
        type: String,
        required: true,
    },
    parentComment: {
        type: mongoose.Schema.Types.ObjectId, // For nested comments
        ref: 'Comment',
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Comment', commentSchema);

const mongoose = require('mongoose');

const municipalPageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    handle: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    region: {
        city: { type: String, required: true },
        ward: { type: String }
    },
    verified: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 },
    avatar: { type: String },
    coverImage: { type: String },
    description: { type: String },

    // Governance & Audit
    createdByAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contactEmail: { type: String },
    isActive: { type: Boolean, default: true },
    pageType: {
        type: String,
        enum: ['Department', 'City', 'EmergencyAuthority'],
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('MunicipalPage', municipalPageSchema);

const Issue = require('../../models/Issue');

exports.checkDuplicate = async (location, category) => {
    // Check for issues within 20 meters with same category
    // This requires 2dsphere index on Issue model

    // For MVP, just return false (no duplicate)
    return false;
};

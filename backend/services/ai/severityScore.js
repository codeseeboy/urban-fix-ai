exports.calculateSeverity = async (category, imageAnalysis) => {
    // Mock logic based on category
    const baseScores = {
        'Pothole': 'Medium',
        'Garbage': 'Low',
        'StreetLight': 'High', // Safety concern
        'Graffiti': 'Low'
    };

    return baseScores[category] || 'Medium';
};

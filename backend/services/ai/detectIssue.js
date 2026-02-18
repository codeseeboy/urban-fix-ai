exports.detectIssueInImage = async (imageUrl) => {
    // Mock logic: Always return true and a random category for now
    // In production, this would call Python FastAPI or OpenAI Vision API
    return {
        isValid: true,
        detectedCategory: ['Pothole', 'Garbage', 'StreetLight', 'Graffiti'][Math.floor(Math.random() * 4)],
        confidence: 0.95,
        tags: ['civic', 'infrastructure']
    };
};

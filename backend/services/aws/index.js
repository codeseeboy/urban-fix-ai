/**
 * AWS Service Abstraction Layer
 * 
 * Provides a unified interface for AWS services.
 * Currently uses local/Supabase alternatives. When AWS is ready,
 * set AWS_ENABLED=true and configure credentials.
 * 
 * INTEGRATION GUIDE FOR DEVELOPERS:
 * 
 * 1. Install AWS SDK:
 *    npm install @aws-sdk/client-s3 @aws-sdk/client-rekognition @aws-sdk/client-sagemaker-runtime
 * 
 * 2. Set environment variables:
 *    AWS_ENABLED=true
 *    AWS_REGION=ap-south-1
 *    AWS_ACCESS_KEY_ID=your_key
 *    AWS_SECRET_ACCESS_KEY=your_secret
 *    AWS_S3_BUCKET=urbanfix-uploads
 *    AWS_SAGEMAKER_ENDPOINT=urbanfix-severity-model
 * 
 * 3. Each method checks AWS_ENABLED before using AWS services.
 *    Falls back to local/Supabase when disabled.
 */

const AWS_CONFIG = {
    enabled: process.env.AWS_ENABLED === 'true',
    region: process.env.AWS_REGION || 'ap-south-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'urbanfix-uploads',
    sagemakerEndpoint: process.env.AWS_SAGEMAKER_ENDPOINT || null,
    cloudwatchLogGroup: process.env.AWS_CLOUDWATCH_LOG_GROUP || 'urbanfix-api',
};

let s3Client = null;
let rekognitionClient = null;

function getS3Client() {
    if (!AWS_CONFIG.enabled) return null;
    if (s3Client) return s3Client;

    try {
        const { S3Client } = require('@aws-sdk/client-s3');
        s3Client = new S3Client({ region: AWS_CONFIG.region });
        return s3Client;
    } catch (e) {
        console.warn('[AWS] S3 SDK not installed. Run: npm install @aws-sdk/client-s3');
        return null;
    }
}

function getRekognitionClient() {
    if (!AWS_CONFIG.enabled) return null;
    if (rekognitionClient) return rekognitionClient;

    try {
        const { RekognitionClient } = require('@aws-sdk/client-rekognition');
        rekognitionClient = new RekognitionClient({ region: AWS_CONFIG.region });
        return rekognitionClient;
    } catch (e) {
        console.warn('[AWS] Rekognition SDK not installed. Run: npm install @aws-sdk/client-rekognition');
        return null;
    }
}

// ─── S3: File Storage ───────────────────────────────────────────────────────

async function uploadFile(buffer, key, contentType) {
    const client = getS3Client();
    if (!client) {
        return { url: null, provider: 'local', message: 'AWS S3 not configured' };
    }

    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(new PutObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
    }));

    return {
        url: `https://${AWS_CONFIG.s3Bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`,
        provider: 'aws-s3',
    };
}

async function deleteFile(key) {
    const client = getS3Client();
    if (!client) return { success: false, provider: 'local' };

    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(new DeleteObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
    }));
    return { success: true, provider: 'aws-s3' };
}

// ─── Rekognition: Image Analysis ────────────────────────────────────────────

async function analyzeImage(imageBuffer) {
    const client = getRekognitionClient();
    if (!client) {
        return { labels: [], provider: 'none', message: 'AWS Rekognition not configured' };
    }

    const { DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
    const result = await client.send(new DetectLabelsCommand({
        Image: { Bytes: imageBuffer },
        MaxLabels: 15,
        MinConfidence: 70,
    }));

    return {
        labels: result.Labels.map(l => ({ name: l.Name, confidence: l.Confidence })),
        provider: 'aws-rekognition',
    };
}

// ─── SageMaker: Custom ML Models ────────────────────────────────────────────

async function invokeSageMaker(payload) {
    if (!AWS_CONFIG.enabled || !AWS_CONFIG.sagemakerEndpoint) {
        return { prediction: null, provider: 'none', message: 'SageMaker not configured' };
    }

    try {
        const { SageMakerRuntimeClient, InvokeEndpointCommand } = require('@aws-sdk/client-sagemaker-runtime');
        const client = new SageMakerRuntimeClient({ region: AWS_CONFIG.region });

        const result = await client.send(new InvokeEndpointCommand({
            EndpointName: AWS_CONFIG.sagemakerEndpoint,
            ContentType: 'application/json',
            Body: JSON.stringify(payload),
        }));

        const responseBody = JSON.parse(new TextDecoder().decode(result.Body));
        return { prediction: responseBody, provider: 'aws-sagemaker' };
    } catch (e) {
        console.warn('[AWS] SageMaker SDK not installed or endpoint error:', e.message);
        return { prediction: null, provider: 'none', error: e.message };
    }
}

// ─── SNS: Push Notifications (future alternative to Firebase) ───────────────

async function sendPushViaSNS(topicArn, message, title) {
    if (!AWS_CONFIG.enabled) {
        return { sent: false, provider: 'none', message: 'AWS SNS not configured' };
    }

    try {
        const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
        const client = new SNSClient({ region: AWS_CONFIG.region });

        await client.send(new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify({ default: message, GCM: JSON.stringify({ notification: { title, body: message } }) }),
            MessageStructure: 'json',
        }));

        return { sent: true, provider: 'aws-sns' };
    } catch (e) {
        console.warn('[AWS] SNS not available:', e.message);
        return { sent: false, provider: 'none', error: e.message };
    }
}

module.exports = {
    AWS_CONFIG,
    uploadFile,
    deleteFile,
    analyzeImage,
    invokeSageMaker,
    sendPushViaSNS,
    getS3Client,
    getRekognitionClient,
};

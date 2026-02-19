. # UrbanFix AI — AI/ML Models Development Plan

## 📱 App Overview

**UrbanFix AI** is a civic issue reporting mobile application that enables citizens to report urban infrastructure problems (potholes, garbage, streetlights, water leaks, etc.) and track their resolution through municipal authorities.

---

## 🎯 Current App Features

### Core Features
| Feature | Description | Current State |
|---------|-------------|---------------|
| **Issue Reporting** | Citizens report issues with photos, GPS location, category selection | ✅ Working |
| **Issue Categories** | roads, lighting, trash, water, parks, other | ✅ Working |
| **GPS Location** | Auto-detect from EXIF/Live GPS/Cached location | ✅ Working |
| **Map View** | Interactive map with issue markers (GeoJSON) | ✅ Working |
| **Issue Tracking** | Status timeline (Submitted → Acknowledged → InProgress → Resolved) | ✅ Working |
| **Emergency Issues** | High-priority flagging for urgent problems | ✅ Working |
| **Anonymous Reporting** | Optional anonymity for reporters | ✅ Working |
| **Before/After Proof** | Resolution verification with comparison photos | ✅ Working |

### AI Features (Currently MOCK - Need Implementation)
| Feature | Current Implementation | Status |
|---------|------------------------|--------|
| **AI Issue Detection** | Returns random category + 95% confidence | ❌ MOCK |
| **AI Severity Scoring** | Returns random Low/Medium/High/Critical | ❌ MOCK |
| **Duplicate Detection** | Always returns `false` | ❌ MOCK |
| **Priority Score** | Random 20-100 + upvote adjustments | ⚠️ Partial |
| **Department Routing** | Manual mapping `category → department` | ⚠️ Partial |

### Social & Engagement Features
| Feature | Description | Current State |
|---------|-------------|---------------|
| **Upvotes/Downvotes** | Community voting on issues | ✅ Working |
| **Comments** | Discussion threads on issues | ✅ Working |
| **Follow Issue** | Get updates on specific issues | ✅ Working |
| **Share** | Social sharing of issues | ✅ Working |

### Gamification Features
| Feature | Description | Current State |
|---------|-------------|---------------|
| **Points System** | +10 report, +2 comment, +25/50 resolved | ✅ Working |
| **Badges** | Achievement badges (First Report, etc.) | ✅ Working |
| **Leaderboard** | Top citizens ranking | ✅ Working |
| **Levels** | 10 level progression system | ✅ Working |

### Admin & Workflow Features
| Feature | Description | Current State |
|---------|-------------|---------------|
| **Admin Dashboard** | Stats, priority queue, quick actions | ✅ Working |
| **Department Assignment** | Assign issues to departments | ✅ Working |
| **Field Worker Dashboard** | View tasks, GPS directions, submit proof | ✅ Working |
| **Municipal Pages** | Official government verified pages | ✅ Working |
| **Notifications** | Real-time status/upvote/comment alerts | ✅ Working |

---

## 🤖 AI/ML Models Required

Based on the app's features and the current mock implementations, here are the AI/ML models that need to be developed:

---

### 1️⃣ OBJECT DETECTION & IMAGE CLASSIFICATION MODEL (Issue Detection)

**Purpose:** Automatically detect, localize (bounding box), and classify civic issues from user-uploaded images.

**Current Mock Location:** `backend/services/ai/detectIssue.js`

```javascript
// Current MOCK implementation
exports.detectIssueInImage = async (imageUrl) => {
    return {
        isValid: true,
        detectedCategory: ['Pothole', 'Garbage', 'StreetLight', 'Graffiti'][Math.floor(Math.random() * 4)],
        confidence: 0.95,
        tags: ['civic', 'infrastructure']
    };
};
```

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Object Detection (primary) + Multi-class Classification (fallback) |
| **Primary Architecture** | **YOLOv8 / YOLOv9 / YOLOv11** (Ultralytics) — real-time detection with bounding boxes |
| **Fallback Architecture** | EfficientNet-B4 / MobileNetV3 (classification only, for edge/mobile deployment) |
| **Input Resolution** | **640×640** (YOLO standard) / 224×224 (lightweight classifier) |
| **Output** | Bounding boxes + class labels + confidence scores |
| **Classes (10 Primary)** | `pothole`, `garbage`, `streetlight_fault`, `graffiti`, `water_leak`, `broken_sidewalk`, `fallen_tree`, `road_damage`, `drainage_issue`, `encroachment` |
| **Training Data Required** | 5,000–10,000 **annotated** images per class (with bounding box labels) |
| **Confidence Threshold** | ≥0.75 for auto-classification, 0.50–0.74 for manual review |
| **Deployment** | FastAPI endpoint / ONNX Runtime / TensorFlow Serving |
| **Latency Budget** | **< 500ms** per inference (server-side) |

**Why YOLO Over Pure Classification:**

| Aspect | Classification (CNN) | Object Detection (YOLO) |
|--------|---------------------|------------------------|
| Output | Single class label | Bounding boxes + class labels |
| Multi-issue | ❌ Cannot detect multiple issues in one image | ✅ Detects all issues in the frame |
| Localization | ❌ No spatial info | ✅ Exact location within image |
| Real-time | ⚠️ Moderate speed | ✅ Real-time capable (YOLOv8n: ~2ms/image on GPU) |
| Use case fit | Simple "what is it?" | "What is it, where is it, and how many?" |

**YOLO Training Configuration (Ultralytics):**

```yaml
# dataset.yaml — YOLO training dataset config
path: ./datasets/urbanfix
train: images/train
val: images/val
test: images/test

nc: 10  # number of classes
names:
  0: pothole
  1: garbage
  2: streetlight_fault
  3: graffiti
  4: water_leak
  5: broken_sidewalk
  6: fallen_tree
  7: road_damage
  8: drainage_issue
  9: encroachment
```

```python
# Training script
from ultralytics import YOLO

# Load pre-trained YOLOv8 medium model
model = YOLO("yolov8m.pt")

# Fine-tune on UrbanFix dataset
results = model.train(
    data="dataset.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    lr0=0.01,
    lrf=0.001,
    optimizer="AdamW",
    augment=True,
    freeze=10,           # Freeze first 10 layers for transfer learning
    patience=15,          # Early stopping patience
    project="urbanfix",
    name="yolov8m_civic_v1"
)
```

**Annotation Format (YOLO `.txt` per image):**

```
# Each line: <class_id> <x_center> <y_center> <width> <height> (normalized 0-1)
0 0.45 0.60 0.30 0.25    # pothole at center-left
1 0.80 0.40 0.15 0.20    # garbage on the right
```

**Model Output Schema:**
```json
{
  "isValid": true,
  "detections": [
    {
      "class": "pothole",
      "confidence": 0.92,
      "boundingBox": { "x1": 120, "y1": 80, "x2": 320, "y2": 230 },
      "area_percentage": 12.5
    },
    {
      "class": "road_damage",
      "confidence": 0.67,
      "boundingBox": { "x1": 400, "y1": 200, "x2": 550, "y2": 350 },
      "area_percentage": 5.8
    }
  ],
  "primaryCategory": "pothole",
  "primaryConfidence": 0.92,
  "tags": ["road", "infrastructure", "safety-hazard"],
  "modelVersion": "yolov8m_civic_v2.1",
  "inferenceTimeMs": 45
}
```

**Dataset Sources:**
- Kaggle Pothole Detection datasets (pre-annotated with bounding boxes)
- **Roboflow Universe** — search for civic/urban infrastructure datasets
- Custom data collection campaign in target cities
- Synthetic data augmentation (rotations, crops, lighting, mosaic)
- Web scraping from municipal complaint portals
- Google Open Images (filtered for relevant classes)

**Pre-trained Weights:**
- Start with Ultralytics YOLOv8m pre-trained on COCO dataset
- Fine-tune on UrbanFix civic issue dataset
- Export to ONNX for deployment flexibility

---

### 2️⃣ IMAGE VALIDATION MODEL (Authenticity Check)

**Purpose:** Verify if the uploaded image actually shows a legitimate civic issue (not random photos, memes, or non-issue content).

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Binary/Multi-class Classifier |
| **Architecture** | MobileNetV3-Large / EfficientNet-B0 (lightweight for fast validation) |
| **Input** | RGB Image — **224×224** (resized with aspect-ratio padding) |
| **Output** | `isValid` (boolean) + rejection reason + flag details |
| **Validation Classes** | Valid Issue, Non-Issue (nature/selfie), Screenshot/Meme, Duplicate Image, Blurry/Unreadable, Indoor Photo |
| **Training Data Required** | 10,000+ mixed images (valid + invalid, balanced) |
| **Latency Budget** | **< 300ms** (runs before the main detection model) |

**Model Output Schema:**
```json
{
  "isValid": true,
  "validationScore": 0.94,
  "rejectionReason": null,
  "flags": {
    "isBlurry": false,
    "isScreenshot": false,
    "isIndoor": false,
    "containsFaces": false,
    "containsText": true
  }
}
```

**Validation Checks (Pipeline Order):**
1. ✅ **Blur Detection** — Laplacian variance < 100 → reject as blurry
2. ✅ **Screenshot Detection** — Edge detection patterns + status bar detection
3. ✅ **Indoor/Outdoor Classification** — Scene classifier (outdoor required)
4. ✅ **Face Detection** — Flag if human faces present (privacy concern)
5. ✅ **EXIF GPS Match** — Image EXIF location vs submitted location (within 500m radius)
6. ✅ **EXIF Timestamp** — Image must be taken within last 24 hours
7. ✅ **Minimum Resolution** — At least 640×480 pixels
8. ✅ **File Size Check** — 50KB minimum (reject tiny/placeholder images)

---

### 3️⃣ SEVERITY ASSESSMENT MODEL

**Purpose:** Automatically calculate the severity level of detected issues based on visual analysis and contextual metadata.

**Current Mock Location:** `backend/services/ai/severityScore.js`

```javascript
// Current MOCK implementation
exports.calculateSeverity = async (category, imageAnalysis) => {
    const baseScores = {
        'Pothole': 'Medium',
        'Garbage': 'Low',
        'StreetLight': 'High',
        'Graffiti': 'Low'
    };
    return baseScores[category] || 'Medium';
};
```

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Regression + Classification Hybrid (multi-head output) |
| **Architecture** | **Dual-Input Network**: CNN branch (image features) + MLP branch (metadata features), fused via concatenation layer |
| **Image Input** | RGB Image **384×384** (from detection crop or full image) |
| **Metadata Input** | Feature vector: `[category_onehot, lat, lng, nearby_school, nearby_hospital, is_main_road, season_onehot, hour_of_day]` |
| **Output** | Severity score (0–100) + Level (Low/Medium/High/Critical) |
| **Latency Budget** | **< 400ms** |

**Multi-Input Architecture Diagram:**

```
┌──────────────┐     ┌───────────────────┐
│  Image Input │     │  Metadata Input   │
│  (384×384)   │     │  (feature vector) │
└──────┬───────┘     └────────┬──────────┘
       │                      │
  ┌────▼─────┐          ┌─────▼──────┐
  │ CNN      │          │   MLP      │
  │ (ResNet  │          │ (3 Dense   │
  │  -18)    │          │  layers)   │
  └────┬─────┘          └─────┬──────┘
       │   512d               │ 64d
       └──────────┬───────────┘
              ┌───▼────┐
              │ Concat │  576d
              │ + FC   │
              └───┬────┘
          ┌───────┴────────┐
     ┌────▼────┐     ┌────▼────┐
     │ Score   │     │ Level   │
     │ (0-100) │     │ (4-cls) │
     └─────────┘     └─────────┘
```

**Severity Calculation Factors:**

| Factor | Weight | Description |
|--------|--------|-------------|
| Visual Damage Size | 30% | Bounding box area / total image area |
| Category Base Risk | 25% | Streetlight=High, Pothole=Medium, etc. |
| Location Context | 20% | Near school (+20), hospital (+25), main road (+15) |
| Historical Data | 15% | Similar issues in area, repeat complaints |
| Weather/Season | 10% | Monsoon +15, Winter +5 |

**Model Output Schema:**
```json
{
  "severityScore": 78,
  "severityLevel": "High",
  "factors": {
    "visualDamage": 0.35,
    "categoryRisk": 0.25,
    "locationContext": "Near School Zone",
    "estimatedImpact": "200+ daily commuters affected"
  },
  "recommendedResponseTime": "24 hours",
  "escalationRequired": true
}
```

---

### 4️⃣ DUPLICATE DETECTION MODEL

**Purpose:** Detect if a newly reported issue is a duplicate of an existing report.

**Current Mock Location:** `backend/services/ai/duplicateCheck.js`

```javascript
// Current MOCK implementation - Always returns false
exports.checkDuplicate = async (location, category) => {
    return false;
};
```

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Multi-modal similarity matching |
| **Components** | Geo-spatial clustering + Image similarity (CLIP / Siamese Network) + Text embedding (Sentence-BERT) |
| **Input** | Location (lat/lng), Image, Title/Description, Category |
| **Output** | `isDuplicate` + matched issue IDs + similarity scores |
| **Latency Budget** | **< 1000ms** (includes vector DB lookup) |

**Duplicate Detection Logic:**

```
STEP 1: Geo-spatial Filter
  - Find all issues within 50m radius
  - Same category filter
  
STEP 2: Image Similarity (CLIP Embeddings / Siamese Network)
  - Extract image embeddings (512d vector)
  - Store in vector DB (Pinecone / pgvector / Milvus)
  - Cosine similarity > 0.85 = potential duplicate
  
STEP 3: Text Similarity (Sentence Transformers — all-MiniLM-L6-v2)
  - Compare title + description embeddings
  - Semantic similarity > 0.80 = potential duplicate
  
STEP 4: Combined Score
  - Weighted average: 40% location + 35% image + 25% text
  - Score > 0.75 = DUPLICATE
```

**Model Output Schema:**
```json
{
  "isDuplicate": true,
  "confidence": 0.89,
  "matchedIssues": [
    {
      "issueId": "abc123",
      "title": "Large pothole on MG Road",
      "similarity": 0.91,
      "distance": "23 meters",
      "status": "InProgress",
      "reportedAt": "2026-02-15"
    }
  ],
  "recommendation": "MERGE_WITH_EXISTING",
  "action": "Show user the existing issue and ask to upvote instead"
}
```

---

### 5️⃣ SMART PRIORITY SCORING MODEL

**Purpose:** Calculate a dynamic priority score based on multiple factors for issue queue management.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Gradient Boosting (XGBoost) / Neural Network Regressor |
| **Input** | Multi-factor feature vector (8 features) |
| **Output** | Priority score (0–100) |
| **Update Frequency** | Real-time (on upvote/status change) |
| **Latency Budget** | **< 100ms** (lightweight computation) |

**Priority Score Formula:**

```
PriorityScore = (
    w1 × SeverityScore +
    w2 × UpvoteScore +
    w3 × AgeDecay +
    w4 × LocationPriority +
    w5 × EmergencyFlag +
    w6 × ReporterCredibility +
    w7 × CategoryUrgency +
    w8 × DuplicateBoost
)

Where:
- SeverityScore: AI-calculated severity (0-100)
- UpvoteScore: log(upvotes + 1) × 10
- AgeDecay: 100 - (days_since_report × 2)
- LocationPriority: Zone-based multiplier (Hospital=1.5, School=1.4, etc.)
- EmergencyFlag: +30 if emergency
- ReporterCredibility: Based on user history (0.5-1.5 multiplier)
- CategoryUrgency: StreetLight=25, OpenManhole=30, Pothole=15
- DuplicateBoost: +5 per similar report
```

---

### 6️⃣ SMART DEPARTMENT ROUTING MODEL

**Purpose:** Automatically assign issues to the correct municipal department based on issue type, location, and historical patterns.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Multi-class Classification + Rule Engine Fallback |
| **Input** | Issue category, location, description, image analysis |
| **Output** | Department assignment + confidence |
| **Departments** | Roads, Sanitation, Electricity, Water, Parks, Security, Traffic, Building |
| **Latency Budget** | **< 200ms** |

**Routing Logic:**

| Issue Type | Primary Dept | Secondary Dept | Special Rules |
|------------|--------------|----------------|---------------|
| Pothole | Roads | Traffic | If on highway → NHAI |
| Garbage | Sanitation | Health | If medical waste → Hazmat |
| StreetLight | Electricity | Roads | If pole damaged → Roads |
| Water Leak | Water | Roads | If sewage → Sanitation |
| Fallen Tree | Parks | Traffic | If blocking road → Traffic |
| Open Manhole | Roads | Water | Emergency escalation |
| Graffiti | Parks | Security | If offensive → Security |

---

### 7️⃣ RESOLUTION VERIFICATION MODEL

**Purpose:** Automatically verify if the "after" photo submitted by field workers actually shows the issue has been resolved.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Siamese Network / Change Detection |
| **Input** | Before image (640×640) + After image (640×640) |
| **Output** | `isResolved` (boolean) + confidence + change analysis |
| **Architecture** | Twin CNN (shared weights) with difference layer + classifier head |
| **Latency Budget** | **< 800ms** |

**Model Output Schema:**
```json
{
  "isResolved": true,
  "confidence": 0.94,
  "changeAnalysis": {
    "beforeState": "Pothole detected - 40cm diameter",
    "afterState": "Surface appears repaired/patched",
    "changePercentage": 87,
    "qualityScore": 0.82
  },
  "flags": {
    "sameLocation": true,
    "differentAngle": true,
    "timeGap": "3 days",
    "weatherDifference": false
  },
  "recommendation": "APPROVE_RESOLUTION"
}
```

---

### 8️⃣ NLP TEXT ANALYSIS MODEL

**Purpose:** Analyze issue titles and descriptions for better categorization, sentiment, and urgency extraction.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Transformer-based NLP (BERT / DistilBERT / IndicBERT) |
| **Tasks** | Named Entity Recognition, Sentiment Analysis, Urgency Classification, Keyword Extraction |
| **Languages (Phase 1)** | English, Hindi |
| **Languages (Phase 2)** | Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati |
| **Multilingual Model** | `google/muril-base-cased` (MuRIL — Multilingual Representations for Indian Languages) |
| **Latency Budget** | **< 500ms** |

**Language Support Roadmap:**

| Phase | Languages | Model |
|-------|-----------|-------|
| Phase 1 (MVP) | English, Hindi | `distilbert-base-multilingual-cased` |
| Phase 2 | + Marathi, Tamil, Telugu | `google/muril-base-cased` |
| Phase 3 | + Kannada, Bengali, Gujarati | Fine-tuned MuRIL |

**Use Cases:**

1. **Auto-Title Generation:** Generate titles from descriptions
2. **Sentiment Analysis:** Detect frustrated/angry citizens for priority
3. **Urgency Extraction:** Extract "since 3 weeks", "children at risk"
4. **Location NER:** Extract mentioned landmarks ("near City Mall")
5. **Spam Detection:** Filter non-issue reports
6. **Language Detection:** Auto-detect input language for routing

**Model Output Schema:**
```json
{
  "extractedEntities": {
    "location": "MG Road, near City Mall",
    "duration": "3 weeks",
    "affectedParties": ["pedestrians", "children"]
  },
  "sentiment": {
    "score": -0.6,
    "label": "Frustrated",
    "urgencyIndicators": ["accident risk", "daily basis"]
  },
  "suggestedCategory": "roads",
  "spamScore": 0.05,
  "languageDetected": "en"
}
```

---

### 9️⃣ HOTSPOT DETECTION MODEL

**Purpose:** Identify clustering patterns to detect problem areas and predict future issues.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Spatial Clustering (DBSCAN / HDBSCAN) + Time Series |
| **Input** | Historical issue data (location, category, time) |
| **Output** | Hotspot zones, trend predictions, resource allocation recommendations |
| **Latency Budget** | **< 5 seconds** (batch analytics — not real-time critical) |

**Use Cases:**

1. **Cluster Detection:** Group nearby issues into hotspots
2. **Trend Analysis:** "Pothole complaints up 40% in Zone 5"
3. **Predictive Maintenance:** Predict areas likely to have issues
4. **Resource Allocation:** Suggest patrol routes for field workers
5. **Infrastructure Scoring:** Rate areas by infrastructure health

**Model Output Schema:**
```json
{
  "hotspots": [
    {
      "centroid": { "lat": 28.6139, "lng": 77.2090 },
      "radius": 200,
      "issueCount": 15,
      "dominantCategory": "roads",
      "severity": "High",
      "trend": "increasing",
      "recommendation": "Schedule road resurfacing for entire stretch"
    }
  ],
  "predictions": [
    {
      "area": "Sector 15, Phase 2",
      "predictedIssue": "Water logging",
      "probability": 0.78,
      "trigger": "Monsoon season + poor drainage history"
    }
  ]
}
```

---

### 🔟 FRAUD/FAKE REPORT DETECTION MODEL

**Purpose:** Detect fraudulent, spam, or gaming-the-system reports.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Anomaly Detection + Classification (Ensemble) |
| **Input** | User behavior, report patterns, image metadata |
| **Output** | Fraud score (0–1) + specific flags |
| **Latency Budget** | **< 500ms** |

**Detection Signals:**

| Signal | Weight | Description |
|--------|--------|-------------|
| Report Frequency | High | Same user, 50+ reports/day |
| Image Reuse | Critical | Same image uploaded multiple times (perceptual hash) |
| GPS Spoofing | Critical | EXIF location ≠ submitted location |
| Copy-Paste Text | Medium | Identical descriptions (text hash matching) |
| Account Age | Low | New accounts with high activity |
| Resolution Gaming | Medium | Reports resolved suspiciously fast |
| VPN Detection | Low | Unusual IP patterns |

---

### 1️⃣1️⃣ ETA PREDICTION MODEL

**Purpose:** Predict estimated time to resolution based on historical data.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Regression (XGBoost / LightGBM) |
| **Input** | Issue category, severity, department, location, current workload |
| **Output** | Estimated resolution time (hours) + confidence interval |
| **Latency Budget** | **< 200ms** |

**ETA Factors:**

| Factor | Impact |
|--------|--------|
| Issue Category | Streetlight (2 days), Pothole (7 days), Major repair (30 days) |
| Severity | Critical (-50%), Low (+100%) |
| Department Workload | High (+40%), Low (-20%) |
| Historical Performance | Department's average resolution time |
| Weather | Monsoon (+50%), Clear (-10%) |
| Budget Cycle | End of fiscal year (-30%) |

---

### 1️⃣2️⃣ RESOURCE OPTIMIZATION MODEL

**Purpose:** Optimize field worker routes and task assignment.

**Required Model Specifications:**

| Specification | Details |
|---------------|---------|
| **Model Type** | Vehicle Routing Problem (VRP) / Reinforcement Learning |
| **Input** | Worker locations, pending tasks, skills, traffic |
| **Output** | Optimized daily routes per worker |
| **Latency Budget** | **< 10 seconds** (batch scheduling, run once per shift) |

**Optimization Goals:**
- Minimize total travel time
- Maximize issues resolved per day
- Balance workload across workers
- Prioritize critical issues
- Consider worker skills (electrician for streetlights)

---

## 📊 Implementation Priority

| Priority | Model | Complexity | Impact | Latency Budget | Timeline |
|----------|-------|------------|--------|----------------|----------|
| 🔴 P0 | Object Detection (YOLO) | High | Critical | < 500ms | 6–8 weeks |
| 🔴 P0 | Severity Assessment | Medium | Critical | < 400ms | 4–6 weeks |
| 🟠 P1 | Duplicate Detection | High | High | < 1000ms | 6–8 weeks |
| 🟠 P1 | Image Validation | Medium | High | < 300ms | 4 weeks |
| 🟡 P2 | Priority Scoring | Low | Medium | < 100ms | 2–3 weeks |
| 🟡 P2 | Department Routing | Low | Medium | < 200ms | 2 weeks |
| 🟢 P3 | Resolution Verification | Medium | Medium | < 800ms | 4–6 weeks |
| 🟢 P3 | NLP Text Analysis | Medium | Medium | < 500ms | 4 weeks |
| 🔵 P4 | Hotspot Detection | Medium | Medium | < 5s (batch) | 4 weeks |
| 🔵 P4 | Fraud Detection | Medium | Low | < 500ms | 4 weeks |
| ⚪ P5 | ETA Prediction | Medium | Low | < 200ms | 4 weeks |
| ⚪ P5 | Resource Optimization | High | Low | < 10s (batch) | 8 weeks |

---

## 🏗️ Technical Architecture

### Recommended Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                       MOBILE APP (React Native)                  │
│                    ↓ Upload Image + Location ↓                   │
├─────────────────────────────────────────────────────────────────┤
│                      NODE.JS BACKEND (Express)                   │
│                    ↓ Forward to AI Service ↓                     │
├─────────────────────────────────────────────────────────────────┤
│                    PYTHON AI SERVICE (FastAPI)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐              │
│  │ YOLO /      │ │   PyTorch   │ │ Scikit-learn  │              │
│  │ Ultralytics │ │   Models    │ │ / XGBoost     │              │
│  └─────────────┘ └─────────────┘ └──────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                    INFERENCE OPTIMIZATION                        │
│  ┌──────────┐ ┌─────────────┐ ┌──────────────────┐             │
│  │ ONNX     │ │ TensorRT    │ │ TorchScript      │             │
│  │ Runtime  │ │ (GPU opt.)  │ │ (JIT compiled)   │             │
│  └──────────┘ └─────────────┘ └──────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                         MODEL STORAGE                            │
│        AWS S3 / Google Cloud Storage / Azure Blob               │
├─────────────────────────────────────────────────────────────────┤
│                          DATABASES                               │
│   PostgreSQL (Supabase)  │  Redis (Cache)  │  pgvector / Milvus│
│                          │                 │  (Vector Store)    │
└─────────────────────────────────────────────────────────────────┘
```

### API Integration Points

Update `backend/services/ai/` files to call Python FastAPI service:

```javascript
// backend/services/ai/detectIssue.js - Updated
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

exports.detectIssueInImage = async (imageUrl) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/api/v1/detect`, {
            image_url: imageUrl,
            include_severity: true,
            include_validation: true
        }, { timeout: 30000 });
        
        return {
            isValid: response.data.validation.is_valid,
            detectedCategory: response.data.classification.category,
            confidence: response.data.classification.confidence,
            tags: response.data.classification.tags,
            severity: response.data.severity.level,
            severityScore: response.data.severity.score
        };
    } catch (error) {
        console.error('AI Service Error:', error.message);
        // Fallback to category-based defaults
        return {
            isValid: true,
            detectedCategory: 'Other',
            confidence: 0.5,
            tags: ['unclassified'],
            severity: 'Medium',
            severityScore: 50
        };
    }
};
```

---

## 📁 Recommended Folder Structure

```
backend/
├── services/
│   └── ai/
│       ├── detectIssue.js      # Image classification client
│       ├── duplicateCheck.js   # Duplicate detection client
│       ├── severityScore.js    # Severity assessment client
│       ├── textAnalysis.js     # NLP analysis client (NEW)
│       ├── fraudDetection.js   # Fraud detection client (NEW)
│       └── index.js            # Unified AI service exports

ai-service/                     # New Python FastAPI service
├── app/
│   ├── main.py                 # FastAPI application
│   ├── api/
│   │   └── v1/
│   │       ├── detect.py       # Detection endpoints
│   │       ├── duplicate.py    # Duplicate check endpoints
│   │       ├── severity.py     # Severity endpoints
│   │       └── hotspots.py     # Analytics endpoints
│   ├── models/
│   │   ├── yolo_detector/      # YOLOv8 model weights & config
│   │   ├── image_classifier/   # Fallback CNN classifier
│   │   ├── severity_model/     # Severity model
│   │   ├── siamese_network/    # Duplicate detection
│   │   └── nlp_model/          # Text analysis (MuRIL / BERT)
│   ├── services/
│   │   ├── image_service.py    # Image processing & preprocessing
│   │   ├── geo_service.py      # Geospatial operations
│   │   ├── vector_service.py   # Embedding storage & similarity search
│   │   └── cache_service.py    # Redis caching
│   └── utils/
│       ├── preprocessing.py    # Image preprocessing pipelines
│       ├── postprocessing.py   # Result formatting & thresholds
│       └── anonymization.py    # Face/plate blurring utilities
├── training/
│   ├── notebooks/              # Jupyter training notebooks
│   ├── scripts/                # Training scripts (train.py, evaluate.py)
│   ├── configs/                # YOLO dataset.yaml, hyperparams
│   ├── datasets/               # Training data (gitignored, stored in cloud)
│   └── experiments/            # MLflow experiments
├── tests/
│   ├── test_detection.py
│   ├── test_severity.py
│   └── test_integration.py
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## 🛠️ Annotation Tools & Data Pipeline

### Recommended Annotation Tools

| Tool | Use Case | Format Support | Cost |
|------|----------|---------------|------|
| **[Roboflow](https://roboflow.com)** | Image annotation, augmentation, dataset management | YOLO, COCO, VOC, TFRecord | Free (1,000 images) → $249/mo |
| **[CVAT](https://cvat.ai)** | Open-source annotation (bounding boxes, polygons) | YOLO, COCO, VOC, LabelMe | Free (self-hosted) |
| **[LabelImg](https://github.com/HumanSignal/labelImg)** | Lightweight desktop annotation tool | YOLO `.txt`, Pascal VOC | Free |
| **[Label Studio](https://labelstud.io)** | Multi-modal annotation (image, text, audio) | All major formats | Free (open-source) |
| **[Supervisely](https://supervisely.com)** | Team annotation with QA workflows | YOLO, COCO, custom | Free tier available |

### Annotation Format Standards

**For YOLO Object Detection (Primary):**
```
# Format: <class_id> <x_center> <y_center> <width> <height>
# All values normalized to 0-1 relative to image dimensions
# One .txt file per image (same filename as image)

# Example: pothole.txt
0 0.45 0.60 0.30 0.25
```

**For COCO JSON (Duplicate Detection & Evaluation):**
```json
{
  "images": [{ "id": 1, "file_name": "img001.jpg", "width": 640, "height": 640 }],
  "annotations": [{ "id": 1, "image_id": 1, "category_id": 0, "bbox": [120, 80, 200, 150] }],
  "categories": [{ "id": 0, "name": "pothole" }]
}
```

### Data Pipeline Architecture

```
┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  Raw Images  │───▶│  Annotation │───▶│  Validation  │───▶│  Augmentation │
│  Collection  │    │  (Roboflow/ │    │  QA Check    │    │  Pipeline     │
│              │    │   CVAT)     │    │  (min 2      │    │  (Albumen-    │
│              │    │             │    │   reviewers)  │    │   tations)    │
└──────────────┘    └─────────────┘    └──────────────┘    └───────┬───────┘
                                                                   │
                                                            ┌──────▼───────┐
                                                            │  Dataset     │
                                                            │  Versioning  │
                                                            │  (DVC /      │
                                                            │   Roboflow)  │
                                                            └──────┬───────┘
                                                                   │
                                              ┌────────────────────▼────────────────────┐
                                              │            Training Pipeline             │
                                              │  ┌──────────┐ ┌───────┐ ┌────────────┐ │
                                              │  │  Train   │ │ Val   │ │   Test     │ │
                                              │  │  (70%)   │ │ (15%) │ │   (15%)    │ │
                                              │  └──────────┘ └───────┘ └────────────┘ │
                                              └─────────────────────────────────────────┘
```

### Data Quality Standards

| Criteria | Minimum Requirement |
|----------|-------------------|
| **Image Resolution** | ≥ 640×480 pixels |
| **Image Format** | JPEG / PNG / WebP |
| **Lighting** | Daytime preferred, low-light acceptable with flash |
| **Annotation Accuracy** | Bounding box IoU ≥ 0.90 with ground truth |
| **Label Consistency** | Each image reviewed by ≥ 2 annotators |
| **Class Balance** | No class should be > 3× the smallest class |
| **Geographic Diversity** | Images from ≥ 5 different cities/zones |
| **Augmentation** | Rotation (±15°), Flip (H), Brightness (±30%), Mosaic, MixUp |

---

## 📈 Data Collection Requirements

### Training Data Needed

| Model | Data Type | Quantity | Annotation Format | Source |
|-------|-----------|----------|-------------------|--------|
| Object Detection (YOLO) | Labeled images with bounding boxes | 50,000+ | YOLO `.txt` | Kaggle, Roboflow Universe, Custom collection |
| Severity Assessment | Images + severity labels (1–100 score) | 20,000+ | CSV + Image paths | Manual annotation by domain experts |
| Duplicate Detection | Image pairs (similar/different) | 30,000+ pairs | Pair CSV (img1, img2, is_duplicate) | Synthetic + real duplicates |
| Image Validation | Valid + invalid images | 10,000+ each | Binary label CSV | Web scraping + intentional invalid samples |
| Resolution Verification | Before/After image pairs | 10,000+ pairs | Pair CSV with resolution label | Field worker submissions |
| NLP Text Analysis | Annotated text (entities, sentiment, urgency) | 50,000+ samples | IOB / JSON annotation | Municipal complaint portals |

### Data Collection Strategy

1. **Manual Collection Campaign**
   - Partner with municipal corporations (BBMP, BMC, GHMC, etc.)
   - Citizen data donation program (in-app opt-in)
   - Field worker submissions with GPS-tagged photos

2. **Synthetic Data Generation**
   - Image augmentation: rotation, flip, brightness, contrast, noise
   - **Mosaic augmentation** (YOLO-native) — combines 4 images into 1
   - **MixUp augmentation** — blends two images with interpolated labels
   - Copy-paste augmentation for small objects
   - GAN-generated samples (StyleGAN/Stable Diffusion for edge cases)

3. **Public Datasets & Web Scraping**
   - **Roboflow Universe** — search "pothole", "garbage", "road damage"
   - Kaggle Pothole Detection / Road Damage datasets
   - Public municipal complaint portals (311 data, Open Data APIs)
   - News articles with civic issue images
   - Social media (Twitter/X `#pothole`, `#roadproblem`, etc.)

4. **Transfer Learning**
   - Pre-trained YOLO on COCO dataset (80 classes, 330K images)
   - Fine-tune on UrbanFix civic issue domain
   - Start with YOLOv8m weights → fine-tune with lower learning rate

---

## 🧪 Model Evaluation & Validation Strategy

### Dataset Split

| Set | Percentage | Purpose |
|-----|------------|---------|
| **Training** | 70% | Model learning |
| **Validation** | 15% | Hyperparameter tuning, early stopping |
| **Test** | 15% | Final unbiased evaluation (never touched during training) |

> **Rule:** Test set must contain images from at least 2 cities NOT present in training set (geographic generalization test).

### Evaluation Metrics Per Model

| Model | Primary Metric | Secondary Metrics | Minimum Target |
|-------|---------------|-------------------|----------------|
| **Object Detection (YOLO)** | **mAP@0.5** (mean Average Precision) | mAP@0.5:0.95, Precision, Recall, F1 | mAP@0.5 ≥ **0.85** |
| **Image Validation** | **F1-Score** (balanced) | Precision, Recall, AUC-ROC | F1 ≥ **0.90** |
| **Severity Assessment** | **MAE** (Mean Absolute Error) on score | Accuracy on level classification, RMSE | MAE ≤ **10**, Level Acc ≥ **85%** |
| **Duplicate Detection** | **Precision@K** (top-K results) | Recall, AUC-PR, False Positive Rate | Precision ≥ **0.95**, FPR < **3%** |
| **Priority Scoring** | **Spearman Rank Correlation** | RMSE, Kendall's Tau | ρ ≥ **0.85** |
| **Department Routing** | **Top-1 Accuracy** | Top-2 Accuracy, Confusion Matrix | Top-1 ≥ **90%**, Top-2 ≥ **98%** |
| **Resolution Verification** | **Accuracy** | Precision, Recall, Cohen's Kappa | Acc ≥ **90%**, Kappa ≥ **0.80** |
| **NLP Text Analysis** | **Entity F1** (NER), **Macro-F1** (Sentiment) | Per-entity recall, language-wise breakdown | Entity F1 ≥ **0.80**, Sentiment F1 ≥ **0.82** |
| **Fraud Detection** | **Precision** (minimize false accusations) | Recall, F1, AUC-ROC | Precision ≥ **0.98**, Recall ≥ **0.70** |

### YOLO-Specific Evaluation

```bash
# Run YOLO validation
yolo val model=best.pt data=dataset.yaml imgsz=640

# Key metrics from validation:
# - mAP@0.5         → overall detection accuracy
# - mAP@0.5:0.95    → strict accuracy (IoU range)
# - Per-class AP     → identify weak classes
# - Confusion Matrix → check inter-class confusion
# - Inference Speed  → FPS on target hardware
```

### Baseline Comparisons

| Approach | Purpose |
|----------|---------|
| **Random baseline** | Lower bound — model must significantly outperform |
| **Rule-based heuristic** | Current mock logic as reference |
| **Pre-trained YOLO (no fine-tuning)** | Measure fine-tuning improvement |
| **Cloud API (AWS Rekognition / Google Vision)** | Cost vs accuracy comparison |
| **Human annotator agreement** | Upper bound (inter-annotator kappa) |

### Cross-Validation

- Use **5-fold Cross-Validation** for tabular models (Priority, ETA, Routing)
- Use **stratified split by city** for image models (ensure geographic diversity)
- Report **mean ± std** across folds

---

## 🖥️ GPU & Hardware Requirements

### Training Hardware

| Phase | Hardware | Specification | Purpose | Estimated Cost |
|-------|----------|--------------|---------|----------------|
| **Prototyping** | Google Colab Pro+ | NVIDIA A100 (40GB) / T4 (15GB) | Quick experiments, small datasets | $50/month |
| **Full Training** | Cloud GPU Instance | NVIDIA A100 (80GB) × 1-2 | Production model training | $2.50–$4/hr |
| **Budget Alternative** | Cloud GPU Instance | NVIDIA T4 (16GB) × 1 | Smaller models (MobileNet, EfficientNet) | $0.50–$1/hr |
| **On-Premise (optional)** | Workstation | RTX 4090 (24GB) | Team that trains frequently | $2,000 one-time |

### Training Time Estimates

| Model | GPU | Dataset Size | Estimated Training Time |
|-------|-----|-------------|------------------------|
| YOLOv8m (Object Detection) | A100 | 50K images, 100 epochs | **4–8 hours** |
| YOLOv8m (Object Detection) | T4 | 50K images, 100 epochs | **12–20 hours** |
| ResNet-50 (Classification) | T4 | 50K images, 50 epochs | **3–6 hours** |
| Siamese Network (Duplicates) | T4 | 30K pairs, 50 epochs | **4–8 hours** |
| Severity Model (Multi-head) | T4 | 20K images, 80 epochs | **3–5 hours** |
| DistilBERT (NLP) | T4 | 50K texts, 10 epochs | **1–2 hours** |

### Inference Hardware (Production)

| Scenario | Hardware | Models Served | Expected QPS |
|----------|----------|--------------|-------------|
| **MVP / Low Traffic** | CPU (4-core, 16GB RAM) | All models (ONNX optimized) | 5–10 req/s |
| **Production** | NVIDIA T4 (16GB) | All models | 50–100 req/s |
| **High Scale** | NVIDIA A10G (24GB) | All models + batching | 200+ req/s |

### Recommended Prototyping Workflow

```
1. Start with Google Colab Pro (free tier / $10/month)
   → Quick experimentation, prove model feasibility
   → Use Roboflow for dataset management

2. Move to cloud GPU (AWS/GCP/Azure) for full training
   → AWS: p3.2xlarge (V100) or g5.xlarge (A10G)
   → GCP: a2-highgpu-1g (A100)
   → Use spot/preemptible instances (60-80% cheaper)

3. Deploy inference on CPU initially (ONNX Runtime)
   → Upgrade to GPU when traffic justifies cost
```

---

## 🔧 MLOps Requirements

### Model Versioning & Registry

| Tool | Purpose | Setup |
|------|---------|-------|
| **MLflow** (self-hosted on EC2/GCP VM) | Experiment tracking, model registry | Docker Compose deployment |
| **DVC** (Data Version Control) | Dataset versioning with Git | Git + S3 remote storage |
| **Weights & Biases** (alternative) | Experiment tracking with rich UI | Cloud-hosted (free tier: 100GB) |
| **Roboflow** (for YOLO) | Dataset versioning + auto-export | Cloud-hosted |

### Model Lifecycle

```
Development → Staging → Canary (10%) → Production (100%)
    │             │          │              │
    │             │          │              ├─ Monitor for 48 hours
    │             │          │              └─ Rollback if error rate > 5%
    │             │          │
    │             │          ├─ 10% traffic for 24 hours
    │             │          └─ Compare metrics vs current production
    │             │
    │             ├─ Full test suite (unit + integration)
    │             └─ Benchmark against baseline
    │
    └─ Feature branch, experiment tracking in MLflow
```

### CI/CD Pipeline

| Stage | Actions | Tools |
|-------|---------|-------|
| **Code Push** | Lint, unit tests, type checks | GitHub Actions |
| **Model Training** | Auto-train on new data pushes | GitHub Actions + GPU runner |
| **Model Evaluation** | Run eval suite, compare to baseline | MLflow / custom scripts |
| **Model Packaging** | Export ONNX, Docker build, push to registry | Docker, ECR/GCR |
| **Canary Deploy** | Deploy to 10% traffic | Kubernetes / ECS |
| **Full Rollout** | Promote to 100% after validation | Automated gate |
| **Rollback** | Auto-rollback on metric degradation | Monitoring alerts |

### Monitoring & Alerting

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| **Model Accuracy** (live) | Prometheus + Grafana | Drop > 5% from baseline |
| **Inference Latency** (p95) | DataDog / CloudWatch | > 2× expected latency |
| **Data Drift** | Evidently AI / NannyML | Distribution shift p-value < 0.05 |
| **Concept Drift** | Custom dashboard | Prediction distribution shift |
| **Error Rate** | Application logs | > 2% of requests failing |
| **GPU Utilization** | CloudWatch / Prometheus | < 20% (over-provisioned) or > 90% (under-provisioned) |

### Model Fallback Strategy

```
IF AI_SERVICE is unreachable:
  → Use category-based defaults (current mock logic)
  → Log incident, alert on-call

IF model confidence < 0.50:
  → Flag for manual review
  → Use rule-based fallback
  → Notify admin dashboard

IF new model version underperforms in canary:
  → Auto-rollback to previous version within 5 minutes
  → Alert ML team with comparison report
```

---

## 🔒 Data Privacy & Compliance

### Regulatory Compliance

| Regulation | Applicability | Key Requirements |
|-----------|---------------|-----------------|
| **Indian IT Act, 2000** | All users in India | Reasonable security practices, data breach notification |
| **DPDP Act, 2023** | Personal data of Indian citizens | Consent, purpose limitation, data minimization |
| **GDPR** (if EU users) | EU citizens | Right to erasure, data portability, explicit consent |

### PII Handling in Images

| PII Type | Detection Method | Action |
|----------|-----------------|--------|
| **Human Faces** | Face detection (MTCNN / MediaPipe) | Auto-blur before storage & processing |
| **License Plates** | OCR / YOLO plate detector | Auto-blur before storage & processing |
| **ID Cards / Documents** | OCR text detection | Reject image with warning |
| **Personal Phone Numbers** | OCR + regex matching | Redact from image & text |

### Image Anonymization Pipeline

```python
# Runs BEFORE any AI model processing
def anonymize_image(image):
    """
    Privacy pipeline — runs on every uploaded image.
    """
    # 1. Detect and blur faces
    faces = face_detector.detect(image)
    for face in faces:
        image = gaussian_blur(image, face.bbox, sigma=30)
    
    # 2. Detect and blur license plates
    plates = plate_detector.detect(image)
    for plate in plates:
        image = gaussian_blur(image, plate.bbox, sigma=30)
    
    # 3. Strip sensitive EXIF metadata (keep GPS for validation)
    image = strip_exif(image, keep=['GPSInfo', 'DateTime'])
    
    return image
```

### Data Retention Policy

| Data Type | Retention Period | Storage |
|-----------|-----------------|---------|
| **Original images** (with PII blurred) | 2 years after resolution | Encrypted S3 bucket |
| **AI model predictions** | 1 year | PostgreSQL (Supabase) |
| **Training datasets** | Indefinite (anonymized) | DVC-managed S3 |
| **User personal data** | Until account deletion | Supabase (encrypted) |
| **Anonymous reports** | 5 years | Supabase |

### Security Measures

- All images encrypted at rest (AES-256) and in transit (TLS 1.3)
- AI service runs in private subnet (no public internet access)
- Model weights stored in private S3 bucket with IAM policies
- Rate limiting on AI endpoints (100 requests/min per user)
- Audit logging for all AI predictions (who, what, when)

---

## 💰 Cost Estimation

### Cloud Infrastructure (Monthly)

| Service | Purpose | Estimated Cost |
|---------|---------|----------------|
| GPU Instance (Training) | Model training (spot instances) | $300–600 |
| API Server (Inference) | FastAPI on T4 GPU | $200–400 |
| Model Storage | S3/GCS | $50–100 |
| Vector Database | pgvector / Milvus (embeddings) | $100–200 |
| Monitoring | Prometheus + Grafana (self-hosted) | $50 |
| MLflow Server | Experiment tracking | $50 |
| **Total** | | **$750–1,400/month** |

### Alternative: Managed ML Services

| Service | Purpose | Cost |
|---------|---------|------|
| AWS Rekognition | Image classification | $0.001/image |
| Google Vision AI | Image analysis | $1.50/1000 images |
| OpenAI GPT-4V | Image understanding | $0.01/image |
| Azure Computer Vision | Object detection | $1.00/1000 images |

### Cost Optimization Tips

- Use **spot/preemptible GPU instances** for training (60–80% cheaper)
- Start with **CPU inference + ONNX Runtime** for MVP (free tier eligible)
- Use **model quantization** (FP32 → FP16 → INT8) to reduce inference cost
- Implement **caching** — don't re-process the same image twice
- Batch non-urgent analytics (hotspots, fraud) to off-peak hours

---

## 📅 Implementation Roadmap

### Phase 1: Foundation (Weeks 1–8)
- [ ] Set up Python FastAPI service scaffold
- [ ] Set up Roboflow workspace and annotation pipeline
- [ ] Collect & annotate initial training data (5,000+ images)
- [ ] Train YOLOv8 Object Detection model (MVP — 5 classes)
- [ ] Train Severity Assessment model (rule-based MVP → ML model)
- [ ] Build image anonymization pipeline (face/plate blurring)
- [ ] Integrate AI service with Node.js backend
- [ ] Deploy on single GPU instance (staging)

### Phase 2: Enhancement (Weeks 9–16)
- [ ] Expand YOLO to all 10 classes (collect more data)
- [ ] Implement Duplicate Detection (CLIP embeddings + pgvector)
- [ ] Add Image Validation model
- [ ] Build NLP Text Analysis (English + Hindi)
- [ ] Set up MLflow experiment tracking
- [ ] Iterate: improve model accuracy based on real-world feedback
- [ ] A/B test AI predictions vs manual classification

### Phase 3: Intelligence (Weeks 17–24)
- [ ] Deploy Resolution Verification model
- [ ] Implement Hotspot Detection analytics
- [ ] Add Fraud Detection system
- [ ] Build Admin Analytics Dashboard (model-powered insights)
- [ ] Add regional language support (Marathi, Tamil, Telugu)
- [ ] Set up monitoring & drift detection

### Phase 4: Optimization (Weeks 25–32)
- [ ] ETA Prediction model
- [ ] Resource Optimization (field worker routing)
- [ ] Model quantization & ONNX optimization for latency
- [ ] Full CI/CD MLOps pipeline
- [ ] A/B testing framework for model versions
- [ ] Load testing at production scale

---

## ✅ Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Object Detection mAP@0.5 | >85% | N/A (Mock) |
| Image Classification Accuracy | >90% | N/A (Mock) |
| Severity Assessment Accuracy | >85% | N/A (Mock) |
| Duplicate Detection Precision | >95% | 0% |
| False Positive Rate (all models) | <5% | N/A |
| API Latency (p95) — Detection | <500ms | N/A |
| API Latency (p95) — Full Pipeline | <2 seconds | N/A |
| User Trust Score | >4.5/5 | N/A |
| Image Anonymization Coverage | >99% | N/A |

---

## 🚀 Quick Start Commands

```bash
# Clone and setup AI service
cd backend/
mkdir ai-service && cd ai-service

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install fastapi uvicorn ultralytics torch torchvision onnxruntime pillow sentence-transformers clip-by-openai evidently mlflow dvc

# Run AI service
uvicorn app.main:app --reload --port 8000

# Train YOLO model (after data preparation)
yolo detect train data=dataset.yaml model=yolov8m.pt epochs=100 imgsz=640

# Evaluate model
yolo detect val model=runs/detect/train/weights/best.pt data=dataset.yaml

# Export to ONNX for deployment
yolo export model=best.pt format=onnx
```

---

## 📚 References

- [Ultralytics YOLOv8 Documentation](https://docs.ultralytics.com/)
- [Roboflow — Dataset Management & Annotation](https://roboflow.com/)
- [TensorFlow Image Classification](https://www.tensorflow.org/tutorials/images/classification)
- [PyTorch Transfer Learning](https://pytorch.org/tutorials/beginner/transfer_learning_tutorial.html)
- [FastAPI ML Deployment](https://fastapi.tiangolo.com/)
- [CLIP for Image Similarity](https://openai.com/research/clip)
- [Sentence Transformers](https://www.sbert.net/)
- [DBSCAN Clustering](https://scikit-learn.org/stable/modules/clustering.html#dbscan)
- [MLflow — Experiment Tracking](https://mlflow.org/)
- [DVC — Data Version Control](https://dvc.org/)
- [MuRIL — Indian Language BERT](https://huggingface.co/google/muril-base-cased)
- [Evidently AI — Model Monitoring](https://evidentlyai.com/)
- [ONNX Runtime](https://onnxruntime.ai/)

---

*Document Created: February 19, 2026*  
*Last Updated: February 19, 2026*  
*Version: 2.0*

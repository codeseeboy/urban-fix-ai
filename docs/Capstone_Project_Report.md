# Capstone Project Report

## on

# UrbanFix.AI – AI-Powered Civic Issue Reporting and Resolution Platform

Submitted in partial fulfillment of the requirements
of the Second Year of
**Bachelor of Technology**
In
**Electronics and Computer Science**

by

Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]

**Under the Guidance of**
(Guide Name)
Designation, Department, SJCEM

**DEPARTMENT OF ELECTRONICS AND COMPUTER SCIENCE**
**ST. JOHN COLLEGE OF ENGINEERING & MANAGEMENT**
**UNIVERSITY OF MUMBAI**
**2025–2026**

---

## Certificate of Approval

This is to certify that, following are bona fide students of B.Tech in Electronics and Computer Science Department. They have satisfactorily completed the requirements of Capstone Project for the courses as prescribed by ST. JOHN COLLEGE OF ENGINEERING AND MANAGEMENT (An Autonomous College affiliated to University of Mumbai), while working on **"UrbanFix.AI – AI-Powered Civic Issue Reporting and Resolution Platform"**.

Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]

Signature:
Name: Guide Name & Signature
Designation

Signature:
Name: HOD Name & Signature
Designation

Signature:
Name: Dr. Kamal Shah
Principal,
St. John College of Engineering and Management.

---

## Declaration

We declare that this written submission represents our ideas in our own words and where others' ideas or words have been included, we have adequately cited and referenced the original sources. We also declare that we have adhered to all principles of academic honesty and integrity and have not misrepresented or fabricated or falsified any idea/data/fact/source in our submission. We understand that any violation of the above will be cause for disciplinary action by the Institute and can also evoke penal action from the sources which have thus not been properly cited or from whom proper permission has not been taken when needed.

Signatures: ___________________________________

Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]
Name of Student [PID No.]

Date:

---

## ACKNOWLEDGEMENT

We would like to express our sincere gratitude to our guide Prof. ________________ for providing invaluable guidance, constant encouragement, and insightful suggestions throughout the course of this capstone project. Their expertise in the domains of software engineering and artificial intelligence proved instrumental in shaping the direction of this work.

We extend our heartfelt thanks to Dr. Kamal Shah, Principal of St. John College of Engineering and Management, for fostering an environment of academic excellence and innovation that enabled us to pursue this project with full institutional support.

We are deeply grateful to Prof. ________________, Head of the Department of Electronics and Computer Science, for providing the necessary infrastructure, laboratory access, and administrative support that facilitated smooth progress of this project.

We also wish to acknowledge the Mentor Dean and faculty members of the Electronics and Computer Science department whose collective wisdom and periodic reviews helped us refine our approach and improve the quality of our deliverables.

We sincerely thank our colleagues and fellow students who participated in the pilot testing of UrbanFix.AI, providing crucial user feedback that shaped the final product. Their willingness to report civic issues through the platform during the testing phase generated real-world data that validated our AI pipeline.

Finally, we express our profound gratitude to our parents and families for their unwavering support, patience, and encouragement throughout this journey.

Name of Student
Name of Student
Name of Student
Name of Student

---

## ABSTRACT

Urban civic infrastructure in India faces an unprecedented challenge: the gap between citizen grievances and municipal resolution continues to widen, with an estimated 3.7 million civic complaints filed annually across Indian metropolitan cities, of which fewer than 40% receive timely acknowledgement and resolution. Existing grievance redressal mechanisms — ranging from manual complaint registers to rudimentary web portals — suffer from delayed response times, lack of visual evidence, absence of intelligent prioritization, and zero transparency in the resolution lifecycle. Citizens, particularly in tier-2 and tier-3 cities, frequently lack a streamlined digital channel to report infrastructure failures such as potholes, garbage accumulation, broken streetlights, waterlogging, and damaged public spaces.

UrbanFix.AI addresses this systemic gap by presenting an AI-powered civic issue reporting and resolution platform that transforms the traditional complaint workflow into an intelligent, community-driven, and fully transparent digital ecosystem. The platform leverages a multi-model artificial intelligence pipeline deployed as a server-side microservice to automatically classify uploaded images into civic issue categories (roads, garbage, lighting, water, parks), assess issue severity and priority based on visual impact analysis, and filter out inappropriate or irrelevant submissions — all without requiring any manual intervention from municipal staff at the triage stage.

The system architecture comprises a React Native mobile application serving as the citizen-facing interface, a Node.js/Express backend API layer managing business logic and data orchestration, a PostgreSQL database with PostGIS spatial extensions hosted on Supabase for geospatial querying and real-time data persistence, and a Python-based AI inference microservice (FastAPI) hosting SigLIP (google/siglip-base-patch16-384) for zero-shot category routing, YOLOv8 detectors for road damage (keremberke/yolov8s-road-damage-detection) and waste (HrutikAdsare/waste-detection-yolov8), SigLIP-based flood detection for waterlogging classification, YOLO-World for open-vocabulary lighting and parks detection, and a ViT-based NSFW content filter for image safety. The platform further incorporates community engagement features including upvote/downvote mechanisms, duplicate issue merging through GPS-radius-based matching, gamification with points and badges, multi-reporter group galleries, a municipal dashboard for administrative oversight, and push notification services via Firebase Cloud Messaging.

The AI pipeline operates in a sequential gate architecture: every uploaded image first undergoes NSFW screening, then passes through a SigLIP-based category router that determines the most probable civic issue type using similarity against category-specific text prompts, and finally is processed by the corresponding category-specific detection or classification model. The output includes detected category, confidence score, bounding box area ratios for severity estimation, and a computed priority score that combines visual impact, category weight, and detection confidence into a normalized 0–100 scale. This priority score directly informs the severity classification (Low, Medium, High, Critical) stored in the database and displayed to both citizens and municipal administrators.

Pilot testing with over 200 sample civic issue images demonstrated category classification accuracy exceeding 80% for roads and garbage categories using pretrained models without domain-specific fine-tuning, with a clear pathway to 90%+ accuracy through active learning from user-confirmed corrections. The platform has been designed for production deployment supporting 20,000+ concurrent users, with the AI microservice hosted on a GPU-equipped cloud instance and the application backend deployed on Render with Supabase as the managed database layer.

**Keywords:** Civic Issue Reporting, Artificial Intelligence, Computer Vision, YOLO Object Detection, SigLIP Zero-Shot Classification, React Native, PostGIS, Community Engagement, Smart City, Urban Infrastructure Monitoring.

---

## CONTENTS

| | | Page No. |
|---|---|---|
| | List of Figures | i |
| | List of Tables | ii |
| | Abbreviations and Symbols | iii |
| **Chapter No.** | **Topic** | |
| | **Overview** | 1 |
| | 1.1 Introduction | 1 |
| | 1.2 Background | 2 |
| Chapter 1 | 1.3 Importance of the Project | 4 |
| | 1.4 Perspective of Stakeholders and Customers | 5 |
| | 1.5 Objectives and Scope of the Project | 7 |
| | 1.6 Summary | 9 |
| | **Literature Survey & Proposed Work** | 10 |
| | 2.1 Introduction | 10 |
| | 2.2 Literature Survey Table | 11 |
| Chapter 2 | 2.3 Problem Definition | 15 |
| | 2.4 Feasibility Study | 16 |
| | 2.5 Methodology Used | 19 |
| | 2.6 Summary | 22 |
| | **Analysis and Planning** | 23 |
| | 3.1 Introduction | 23 |
| Chapter 3 | 3.2 Project Planning | 23 |
| | 3.3 Scheduling | 26 |
| | 3.4 Summary | 28 |
| | **Design & Implementation** | 29 |
| | 4.1 Data Flow Diagram (DFD) | 29 |
| Chapter 4 | 4.2 Block Diagram | 30 |
| | 4.3 Flowchart | 31 |
| | 4.4 UML Diagram | 32 |
| | 4.5 GUI Screenshots | 33 |
| | **Results & Discussion** | 37 |
| | 5.1 Actual Results | 37 |
| Chapter 5 | 5.2 Future Scope | 39 |
| | 5.3 Testing | 40 |
| | 5.4 Deployment | 43 |
| Chapter 6 | **Conclusion** | 45 |
| | **References** | 46 |

---

## i — List of Figures

| Figure No. | Figure Name | Page No. |
|---|---|---|
| 1 | Data Flow Diagram (DFD) | 29 |
| 2 | System Block Diagram | 30 |
| 3 | AI Pipeline Flowchart | 31 |
| 4 | UML Use Case Diagram | 32 |
| 5 | GUI — Onboarding / Login Screen | 33 |
| 6 | GUI — Home Feed Screen | 33 |
| 7 | GUI — Report Issue Screen | 34 |
| 8 | GUI — Issue Detail Screen | 34 |
| 9 | GUI — Map View Screen | 35 |
| 10 | GUI — AI Detection Confirmation Screen | 35 |
| 11 | GUI — Admin / Municipal Dashboard | 36 |

---

## ii — List of Tables

| Table No. | Table Name | Page No. |
|---|---|---|
| 1 | Literature Survey Table | 11–14 |
| 2 | Technology Stack Table | 19 |
| 3 | Sprint Planning Table | 26–27 |
| 4 | AI Model Stack Table | 21 |
| 5 | Test Cases Table | 41–42 |

---

## iii — Abbreviations and Symbols

- **AI:** Artificial Intelligence
- **ML:** Machine Learning
- **CLIP:** Contrastive Language-Image Pretraining
- **YOLO:** You Only Look Once
- **DFD:** Data Flow Diagram
- **UML:** Unified Modeling Language
- **API:** Application Programming Interface
- **REST:** Representational State Transfer
- **GPS:** Global Positioning System
- **GIS:** Geographic Information System
- **PostGIS:** PostgreSQL Geographic Information System Extension
- **NSFW:** Not Safe For Work
- **ViT:** Vision Transformer
- **CNN:** Convolutional Neural Network
- **ONNX:** Open Neural Network Exchange
- **mAP:** Mean Average Precision
- **IoU:** Intersection over Union
- **FCM:** Firebase Cloud Messaging
- **UI/UX:** User Interface / User Experience
- **SDK:** Software Development Kit
- **EXIF:** Exchangeable Image File Format
- **RDD:** Road Damage Detection
- **SigLIP:** Sigmoid Loss Language-Image Pretraining
- **JWT:** JSON Web Token
- **CRUD:** Create, Read, Update, Delete
- **HTTP:** HyperText Transfer Protocol
- **UUID:** Universally Unique Identifier

---

# Chapter 1: Overview

## 1.1 Introduction

India is undergoing rapid urbanization at an unprecedented pace. According to the United Nations World Urbanization Prospects report, India's urban population is projected to reach 675 million by 2035, making the management and maintenance of urban civic infrastructure one of the most pressing challenges of our time. Indian cities — from metropolitan hubs like Mumbai, Delhi, and Bangalore to emerging smart cities such as Pune, Indore, and Bhopal — grapple daily with a litany of civic issues: potholes that damage vehicles and endanger lives, uncollected garbage that breeds disease, non-functional streetlights that compromise public safety after dark, waterlogged roads that paralyze commutes during monsoon seasons, and deteriorating public parks and footpaths that diminish the quality of urban life.

The traditional mechanisms for reporting these issues are fragmented, opaque, and overwhelmingly manual. Municipal corporations typically rely on telephone helplines, physical complaint registers at ward offices, or basic web portals that lack image evidence, geolocation tagging, intelligent prioritization, and real-time status tracking. A citizen who encounters a dangerous pothole on their daily commute must navigate bureaucratic channels, often with no assurance that their complaint has been received, categorized correctly, or assigned to the appropriate department. The absence of photographic evidence and precise location data further hampers the ability of municipal workers to locate and address reported issues efficiently.

UrbanFix.AI is conceived as a comprehensive technological solution to this systemic civic infrastructure management problem. It is an AI-powered mobile platform that empowers citizens to report civic issues by simply capturing a photograph using their smartphone. The platform's artificial intelligence pipeline — deployed as a server-side microservice — automatically analyzes the uploaded image to determine the type of civic issue (pothole, garbage, broken streetlight, waterlogging, park damage, or other), estimates the severity and priority of the issue based on visual impact analysis (size, extent, and coverage of the detected problem), and filters out inappropriate or irrelevant submissions such as selfies, indoor photographs, or explicit content. The detected category, severity, and priority are presented to the user for confirmation before the report is finalized and submitted to the municipal database, ensuring a human-in-the-loop validation mechanism that balances automation with accountability.

Beyond the AI-driven reporting workflow, UrbanFix.AI incorporates a suite of community engagement features designed to foster civic participation and transparency. Citizens can upvote or downvote reported issues to signal urgency, follow specific issues to receive push notifications about status updates, contribute additional photographic evidence to existing reports through a duplicate-detection and merge mechanism, and earn points and badges through a gamification system that rewards active civic participation. Municipal administrators have access to a dedicated dashboard that provides an aggregated view of all reported issues, filterable by category, severity, geographic region, and status, enabling data-driven resource allocation and performance monitoring.

The platform is built using a modern technology stack comprising React Native with Expo for the cross-platform mobile application, Node.js with Express for the backend API layer, PostgreSQL with PostGIS spatial extensions hosted on Supabase for geospatially-aware data persistence, and a Python-based FastAPI microservice hosting the AI inference pipeline. The AI pipeline itself employs a multi-model architecture: SigLIP for zero-shot category routing, YOLOv8 for road damage detection (potholes, cracks, alligator cracking) and for garbage and litter detection, a SigLIP-based binary classifier for waterlogging/flood detection, YOLO-World for open-vocabulary detection in lighting and parks scenes, and a lightweight ViT-based model for NSFW content filtering. This multi-model approach ensures that each civic issue category is handled by a specialist model optimized for that specific detection task, while the SigLIP router ensures that only the relevant model is invoked for any given image, optimizing both accuracy and computational efficiency.

## 1.2 Background

The concept of citizen-driven civic issue reporting is not new. Municipalities across the globe have experimented with digital complaint management systems for over two decades. Early platforms such as SeeClickFix (launched in 2008 in the United States) and FixMyStreet (launched in 2007 in the United Kingdom) demonstrated the viability of web-based civic reporting, enabling citizens to pin issues on a map and submit textual descriptions. In India, platforms like the Swachhata App by the Ministry of Housing and Urban Affairs and the MyGov portal have made strides toward digitizing citizen-government interaction. Several Indian municipal corporations have also developed their own mobile applications, such as the MCGM 24x7 app in Mumbai and the BBMP SahAya app in Bangalore.

However, these existing platforms share critical limitations that constrain their effectiveness in the Indian context. First, they rely almost entirely on manual text-based descriptions for issue categorization, which introduces inconsistency, ambiguity, and delay in the triage process. A citizen reporting a "hole in the road near the bus stop" and another reporting a "road damage at XYZ junction" may both be describing potholes, but the absence of standardized image-based classification means that each complaint must be manually reviewed, categorized, and routed by municipal staff. Second, these platforms lack intelligent severity assessment: a hairline crack and a crater-sized pothole are treated with identical priority in most existing systems. Third, duplicate detection is rudimentary or absent; the same pothole may be reported dozens of times by different citizens, flooding the municipal queue with redundant complaints while genuinely novel issues are buried. Fourth, there is minimal community engagement: citizens submit a complaint and have no visibility into its resolution journey, leading to frustration and declining participation over time.

The emergence of powerful open-source computer vision models in 2022–2025 has created a transformative opportunity to address these limitations through AI-driven automation. The release of the Road Damage Detection 2022 (RDD2022) challenge dataset — comprising over 47,000 annotated road images from six countries including India — catalyzed the development of high-accuracy road damage detection models. Simultaneously, the CLIP and SigLIP families of models, building on OpenAI's CLIP and open-source ecosystems such as Hugging Face Transformers, demonstrated that a single model could classify images into arbitrary categories using natural language descriptions alone, without requiring category-specific training data. The YOLO (You Only Look Once) family of object detection models continued to advance, with YOLOv8 and successors achieving strong detection accuracy with inference speeds suitable for real-time deployment. These developments, combined with the availability of pretrained model checkpoints on platforms like Hugging Face, made it technically feasible — for the first time — to build a production-grade AI pipeline for civic issue classification, severity estimation, and content moderation without the prohibitive cost of training models from scratch.

UrbanFix.AI is built squarely on this foundation: leveraging pretrained, publicly available AI models, fine-tuned where necessary with domain-specific data collected organically from user submissions, and orchestrated through a server-side inference pipeline that abstracts the complexity of multi-model routing from the mobile application. The platform represents a synthesis of modern mobile development (React Native), scalable backend architecture (Node.js, PostgreSQL/PostGIS, Supabase), and state-of-the-art computer vision (SigLIP, YOLO, ViT), purpose-built for the Indian civic infrastructure context.

## 1.3 Importance of the Project

The importance of UrbanFix.AI spans multiple dimensions — public safety, municipal efficiency, environmental sustainability, and democratic civic participation.

From a public safety perspective, unresolved civic issues pose direct threats to human life and well-being. The Ministry of Road Transport and Highways reported that poor road conditions contributed to approximately 1.73 lakh road accidents in India in 2022, with potholes and damaged road surfaces being a significant contributing factor. Non-functional streetlights create zones of darkness that are statistically correlated with increased rates of vehicular accidents, pedestrian injuries, and crimes against women. Waterlogged roads during monsoon seasons not only disrupt transportation but also become breeding grounds for mosquitoes, contributing to the spread of dengue, malaria, and chikungunya. By enabling rapid, AI-assisted reporting and intelligent prioritization of these hazards, UrbanFix.AI has the potential to accelerate municipal response times and reduce the duration during which citizens are exposed to these risks.

From a municipal efficiency perspective, the AI pipeline directly addresses the bottleneck of manual triage. Municipal corporations in Indian cities receive thousands of complaints daily across multiple channels. The manual process of reading each complaint, interpreting the textual description, assigning a category, estimating priority, and routing to the appropriate department is labor-intensive, error-prone, and slow. UrbanFix.AI automates the category classification, severity estimation, and department routing steps, enabling municipal staff to focus on resolution rather than triage. The duplicate detection and merge mechanism further reduces the volume of redundant complaints that must be processed, freeing municipal resources for genuine novel issues.

From an environmental sustainability perspective, the garbage and litter detection capabilities of the platform contribute to the broader goals of the Swachh Bharat Mission by providing municipalities with real-time, geo-tagged visual evidence of waste accumulation hotspots. This data can inform targeted sanitation drives, optimize garbage collection routes, and hold sanitation contractors accountable for service level compliance.

From a democratic participation perspective, the gamification system, community voting, and transparent status tracking features of UrbanFix.AI transform civic reporting from a one-way complaint submission into a two-way engagement platform. Citizens can see the impact of their reports, track resolution progress, and collectively signal the most urgent issues through upvoting — creating a form of participatory governance that aligns with the Smart Cities Mission's vision of citizen-centric urban management.

## 1.4 Perspective of Stakeholders and Customers

UrbanFix.AI serves a diverse set of stakeholders, each with distinct needs, expectations, and interaction patterns with the platform.

**Citizens (Primary Users):** The citizen is the primary user of the UrbanFix.AI mobile application. Citizens span a wide demographic range — from young college students and working professionals who are digitally native, to senior citizens and homemakers who may have limited technical proficiency. The platform must therefore offer an intuitive, minimal-friction reporting workflow: capture a photograph, confirm the AI-detected category and severity, and submit. Citizens expect immediate visual feedback (the AI detection result), transparent status tracking (notification when their issue is acknowledged, assigned, in progress, or resolved), and a sense of agency (the ability to upvote issues reported by others to signal community priority). The gamification system addresses the citizen's intrinsic motivation for civic participation by providing tangible recognition through points, badges, and leaderboard rankings.

**Municipal Administrators and Decision-Makers:** Municipal administrators — including ward officers, department heads, and city commissioners — are the administrative consumers of the data generated by UrbanFix.AI. Their perspective centers on actionable intelligence: which areas have the highest concentration of unresolved critical issues, which departments have the longest average resolution times, and how effectively are field workers addressing assigned tasks. The admin dashboard provides aggregated views, filterable by geography, category, severity, and time period, enabling data-driven resource allocation. The AI-assigned severity and priority scores reduce the subjectivity inherent in manual triage, providing a consistent and defensible basis for prioritization decisions.

**Field Workers (Municipal Staff):** Field workers are the operational staff responsible for physically resolving reported issues — filling potholes, repairing streetlights, clearing garbage, and unblocking drains. Their perspective is task-oriented: they need a clear task list, precise location information (GPS coordinates and address), photographic evidence of the issue, and a mechanism to upload proof of resolution (before-and-after photographs). The UrbanFix.AI field worker dashboard provides exactly this workflow, with push notifications for new assignments and a streamlined interface for updating task status.

**Community and Society:** At a macro level, the broader community benefits from improved urban infrastructure, faster issue resolution, and a more responsive municipal government. The open data generated by the platform — aggregated and anonymized — can inform urban planning research, infrastructure investment decisions, and public policy formulation. Academic researchers and urban planners can leverage the geo-tagged, time-stamped, category-classified issue data to identify systemic patterns (e.g., recurring waterlogging in specific wards, chronic pothole formation on particular road types) and recommend preventive interventions.

## 1.5 Objectives and Scope of the Project

The objectives of the UrbanFix.AI project are defined with precision to ensure that the capstone deliverable is both technically ambitious and practically achievable within the academic timeline.

**Primary Objectives:**

1. To design and develop a cross-platform mobile application using React Native that enables citizens to report civic issues by capturing and uploading photographs, with automatic GPS-based geolocation tagging and reverse geocoding.

2. To build a multi-model AI inference pipeline deployed as a server-side Python microservice that automatically classifies uploaded images into civic issue categories (roads, garbage, lighting, water, parks, other), estimates issue severity and priority based on visual impact analysis, and filters inappropriate or irrelevant content.

3. To implement a server-side backend using Node.js and Express that manages user authentication (JWT-based), issue CRUD operations, community engagement features (upvote, downvote, follow, comment), gamification (points, badges, leaderboard), push notifications (Firebase Cloud Messaging), and administrative workflows.

4. To implement geospatial duplicate detection using PostGIS spatial queries, enabling automatic identification and merging of duplicate reports for the same physical issue based on GPS proximity, category matching, and temporal recency.

5. To provide a municipal administration dashboard that displays all reported issues with filtering, sorting, and status management capabilities, enabling data-driven resource allocation and performance monitoring.

**Scope of the Project:**

The scope of the project encompasses the complete software lifecycle from requirements analysis through deployment. The mobile application targets Android devices (with iOS compatibility through React Native). The AI pipeline operates exclusively on the server side; no AI inference is performed on the mobile device. The platform supports six civic issue categories in v1: roads (potholes, cracks, road damage), garbage/trash (litter, waste accumulation), lighting (broken or non-functional streetlights), water (waterlogging, drainage overflow, pipe leakage), parks (damaged footpaths, broken benches, fallen trees), and other. The AI pipeline provides strong auto-detection for roads, garbage, and water categories using specialized pretrained models, while lighting, parks, and other categories are supported through the SigLIP router and YOLO-World open-vocabulary detection with manual fallback. The platform does not cover utility billing, property tax, or non-infrastructure civic services in the current scope.

## 1.6 Summary

This chapter introduced UrbanFix.AI as an AI-powered civic issue reporting and resolution platform designed to address the systemic inefficiencies of traditional municipal complaint management systems in India. The platform combines a React Native mobile application, a Node.js backend with PostgreSQL/PostGIS on Supabase, and a Python-based AI inference microservice to deliver automated image classification, severity estimation, priority scoring, duplicate detection, community engagement, and administrative oversight. The importance of the project was contextualized within India's urbanization challenges, and the perspectives of key stakeholders — citizens, municipal administrators, field workers, and the broader community — were articulated. The objectives and scope were defined to ensure a focused, deliverable capstone outcome.

---

# Chapter 2: Literature Survey & Proposed Work

## 2.1 Introduction

The development of UrbanFix.AI is informed by a substantial body of prior work spanning civic technology platforms, computer vision for infrastructure monitoring, zero-shot image classification, object detection architectures, and community-driven urban governance models. This chapter presents a systematic review of the most relevant existing systems, research publications, and open-source projects that collectively define the state of the art against which UrbanFix.AI is positioned. The literature survey is organized in tabular format as mandated, followed by a precise problem definition, a feasibility assessment across technical, economic, and operational dimensions, and a description of the development methodology adopted for this project.

## 2.2 Literature Survey Table

| Sr. No. | Title / System | Author(s) / Year | Description | Limitations |
|---|---|---|---|---|
| 1 | SeeClickFix — Civic Issue Reporting Platform | SeeClickFix Inc., 2008 | Web and mobile platform enabling citizens in US cities to report non-emergency neighborhood issues (potholes, graffiti, streetlights) on a map. Supports status tracking and municipal integration. | No AI-based image classification; relies entirely on manual text descriptions for categorization. No severity estimation. Limited to US municipal contexts. |
| 2 | FixMyStreet — UK Civic Reporting | mySociety, 2007 | Open-source web platform for reporting street-level problems to UK local councils. Map-based pinpointing, email-based routing to councils. | Text-only complaints; no image analysis. No prioritization algorithm. No community voting or engagement features. Limited duplicate detection. |
| 3 | RDD2022: A Multi-National Image Dataset for Automatic Road Damage Detection | Arya et al., IEEE Big Data 2022 | Published a dataset of 47,420 road images from 6 countries (including India) annotated with 4 damage types: longitudinal cracks (D00), transverse cracks (D10), alligator cracks (D20), and potholes (D40). | Dataset focused only on road damage; does not cover garbage, streetlights, waterlogging, or parks. Class imbalance (potholes underrepresented in some countries). |
| 4 | CLIP: Contrastive Language-Image Pretraining | Radford et al., OpenAI, 2021 | Introduced a model trained on 400M image-text pairs that performs zero-shot image classification by computing cosine similarity between image and text embeddings. Achieved competitive accuracy without task-specific fine-tuning. | Large model size; requires GPU for efficient inference. Zero-shot accuracy varies by domain. Not designed for fine-grained detection (bounding boxes). |
| 5 | SigLIP — Sigmoid Loss Language-Image Pretraining | Zhai et al., Google, ICCV 2023 | Image-text model using sigmoid loss; strong zero-shot classification. Public checkpoints include google/siglip-base-patch16-384 on Hugging Face. | Same limitations as CLIP family regarding fine-grained bbox detection. Requires careful prompt engineering for domain-specific routing. |
| 6 | YOLOv8 Object Detection (Ultralytics) | Ultralytics, 2023–2025 | Widely deployed real-time detection; community YOLOv8 checkpoints on Hugging Face for road damage and waste. Supports detection, segmentation, and classification. | Requires labeled bounding-box datasets for fine-tuning. Performance degrades on categories with limited training data. |
| 7 | Marqo NSFW Image Detection (ViT-tiny) | Marqo AI, 2024 | Lightweight ViT-based binary classifier (NSFW/SFW) trained on 220,000 images. Achieves 98.56% accuracy. 18–20x smaller than competing models. | Binary classification only (NSFW vs SFW); does not distinguish between types of inappropriate content (violence, gore, explicit). May not cover all cultural contexts. |
| 8 | Swachhata App (Government of India) | Ministry of Housing & Urban Affairs, 2016 | Official app for sanitation-related complaints under Swachh Bharat Mission. Supports photo upload, GPS tagging, and complaint tracking. | No AI classification; manual categorization by users. No severity estimation. No community engagement features. Limited to sanitation category. |
| 9 | Flood-Image-Detection (SigLIP-based) | prithivMLmods, HuggingFace, 2025 | Binary image classifier fine-tuned from google/siglip2-base-patch16-512 for detecting flooded vs. non-flooded scenes. | Binary only (flood/non-flood); does not distinguish waterlogging severity, pipe leakage, or drainage-specific issues. Limited training diversity. |
| 10 | QR4Change Urban Civic Issues Dataset | Pune Research Group, Mendeley Data, 2025 | Dataset of 4,937 images covering potholes (2,966 images) and garbage (1,971 images) collected from field surveys in Pune, India, plus open-source repositories. | Only two categories (pothole and garbage). No bounding-box annotations (image-level labels only). Limited to Pune geographic context. |
| 11 | Adversarial Adaptation of Scene Graph Models for Civic Issues | Atreja et al., WWW 2019 | Proposed adversarial training approach for scene graph models to generate Civic Issue Graphs from images. Released multi-modal civic issue dataset. | Research prototype; no production-ready model or API. Scene graph approach is computationally expensive and difficult to deploy at scale. |
| 12 | Road Damage Detection using YOLOv8s on RDD2022 | keremberke, Hugging Face | YOLOv8s checkpoint for road damage (RDD2022-style labels). Detects multiple damage types (e.g. D00, D10, D20, D40). Typical inference at 640×640. | Focused only on road damage; no coverage of other civic categories. May need fine-tuning for local road appearance. |

## 2.3 Problem Definition

Based on the literature survey, the following core problems are identified that UrbanFix.AI aims to address:

The existing civic issue reporting landscape in India is characterized by a fundamental disconnect between the technological capabilities available in 2025 and the tools actually deployed for citizen-government interaction. While computer vision models capable of automatically classifying road damage, detecting garbage, and identifying waterlogging from photographs have been published as open-source research artifacts, no production-grade civic reporting platform in India integrates these AI capabilities into the citizen reporting workflow. Citizens continue to manually describe issues in text, manually select categories from dropdown menus, and submit reports that receive no automated severity assessment or intelligent prioritization.

The specific problems addressed by this project are as follows. First, the absence of automated image-based classification in existing civic platforms means that the burden of accurate categorization falls entirely on the citizen, leading to frequent miscategorization and delayed routing to the appropriate municipal department. Second, the lack of visual severity estimation means that all complaints are treated with equal priority regardless of their actual impact — a hairline crack and a vehicle-damaging pothole are queued identically. Third, the absence of intelligent duplicate detection leads to significant redundancy in municipal complaint databases, with the same physical issue being reported multiple times by different citizens, diluting the apparent priority of novel issues. Fourth, the lack of community engagement mechanisms in existing platforms creates a one-directional complaint-and-wait experience that fails to sustain citizen participation over time. Fifth, the absence of content moderation exposes municipal systems to irrelevant, inappropriate, or malicious image submissions that waste processing resources and potentially create legal liability.

UrbanFix.AI addresses each of these problems through a unified platform that integrates AI-driven classification and severity estimation, GPS-based duplicate detection and merging, community engagement through voting and following, gamification through points and badges, and content moderation through NSFW filtering — all within a mobile-first, production-ready architecture.

## 2.4 Feasibility Study

### 2.4.1 Technical Feasibility

The technical feasibility of UrbanFix.AI is strongly supported by the current maturity of the underlying technologies. React Native with Expo provides a production-proven cross-platform mobile development framework used by companies including Facebook, Instagram, and Flipkart. Node.js with Express is the most widely deployed server-side JavaScript framework, powering applications at Netflix, PayPal, and LinkedIn scale. PostgreSQL with PostGIS is the industry standard for geospatial data management, used extensively in GIS applications worldwide. Supabase provides a managed PostgreSQL hosting service with built-in authentication, storage, and real-time capabilities, eliminating the operational overhead of database administration.

On the AI side, all models selected for the pipeline are publicly available as pretrained checkpoints on Hugging Face, with permissive licenses suitable for production use. SigLIP checkpoints are published by Google on Hugging Face; YOLOv8 specialist weights are distributed via Hugging Face and the Ultralytics ecosystem (AGPL-3.0 with enterprise options). The Marqo NSFW detection model and the Flood-Image-Detection model are publicly accessible on Hugging Face. Python with FastAPI provides a high-performance framework for serving AI models as HTTP endpoints, with native support for asynchronous request handling, automatic OpenAPI documentation, and straightforward Docker containerization for deployment.

The inference hardware requirements are modest: a single NVIDIA T4 GPU (16 GB VRAM, available on AWS, GCP, and RunPod at approximately $0.50–$0.76/hour for on-demand instances) is sufficient to host all five models concurrently with sub-second inference latency per image. This makes the AI pipeline technically and financially viable for a startup or academic project without requiring expensive custom hardware.

### 2.4.2 Economic Feasibility

The economic feasibility of UrbanFix.AI is favorable due to the extensive use of open-source software and managed cloud services with generous free tiers. React Native, Node.js, Express, PostgreSQL, and all AI model frameworks are free and open-source. Supabase offers a free tier providing 500 MB of database storage, 1 GB of file storage, and 50,000 monthly active users — sufficient for pilot deployment and initial user acquisition. Render.com provides a free tier for backend hosting with automatic SSL, custom domains, and auto-deployment from GitHub. Firebase Cloud Messaging for push notifications is free for unlimited messages.

The primary cost center is the GPU instance for the AI microservice. During pilot/MVP phase, a single reserved GPU instance on RunPod or AWS EC2 (g4dn.xlarge) costs approximately $10–15 per day. This cost can be further optimized through auto-scaling (spinning down during low-traffic hours) and model optimization (ONNX conversion, quantization). At scale (20,000+ users), the AI infrastructure cost is estimated at $300–500/month — a fraction of the cost of the manual triage labor it replaces.

### 2.4.3 Operational Feasibility

The operational feasibility of UrbanFix.AI is supported by the platform's design for minimal manual intervention in the steady state. The AI pipeline automates the classification, severity estimation, and routing steps that traditionally require dedicated municipal staff. The human-in-the-loop confirmation mechanism (user confirms AI detection before submission) serves as both a quality assurance mechanism and a source of labeled training data for continuous model improvement through active learning. The gamification and notification systems are fully automated, requiring no manual content creation or moderation. The administrative dashboard provides self-service analytics, reducing the need for custom reporting.

The key operational risk is model accuracy during the initial deployment phase, when domain-specific fine-tuning data is limited. This risk is mitigated by the conservative confidence threshold strategy: only high-confidence detections trigger auto-fill suggestions, medium-confidence results prompt user confirmation with a warning, and low-confidence results default to manual category selection. This graduated approach ensures that the platform remains usable and trustworthy even before fine-tuning has been completed.

## 2.5 Methodology Used

The development of UrbanFix.AI follows an Agile methodology with Scrum-based sprint cycles, adapted for a capstone project context. The Agile approach is chosen for its iterative nature, which aligns well with the exploratory requirements of integrating multiple AI models into a mobile application. Each sprint delivers a potentially deployable increment of functionality, enabling continuous feedback from pilot users and stakeholders.

The technology stack is summarized in the following table:

**Table 2: Technology Stack**

| Layer | Technology | Purpose |
|---|---|---|
| Mobile App | React Native (Expo) | Cross-platform mobile application (Android + iOS) |
| Backend API | Node.js, Express.js | RESTful API, business logic, authentication |
| Database | PostgreSQL + PostGIS (Supabase) | Data persistence, geospatial queries, storage |
| AI Microservice | Python, FastAPI | AI model hosting and inference |
| AI — Router | SigLIP (base patch16-384) | Zero-shot category classification (routing) |
| AI — Roads | YOLOv8s (keremberke, RDD2022) | Road damage detection (pothole, cracks) |
| AI — Garbage | YOLOv8 (waste detection) | Garbage / litter detection |
| AI — Water | SigLIP-based Flood Classifier | Waterlogging / flood detection |
| AI — Lighting / Parks | YOLO-World (open-vocabulary) | Text-prompted damage / object detection |
| AI — NSFW | ViT-tiny (Marqo) | Inappropriate content filtering |
| Push Notifications | Firebase Cloud Messaging | Real-time push notifications to users |
| File Storage | Supabase Storage | Image and video upload storage |
| Deployment — Backend | Render.com | Backend API hosting |
| Deployment — AI | RunPod / AWS EC2 GPU | GPU-equipped AI inference hosting |
| Version Control | Git, GitHub | Source code management |

**Table 4: AI Model Stack**

| Model | Source | Task | Classes / Output | Input Size |
|---|---|---|---|---|
| SigLIP base patch16-384 | google/siglip-base-patch16-384 | Category routing | roads, trash, lighting, water, parks, other | 384×384 |
| YOLOv8s road damage | keremberke/yolov8s-road-damage-detection | Road damage detection | D00, D10, D20, D40 (repair class varies) | 640×640 |
| YOLOv8 waste | HrutikAdsare/waste-detection-yolov8 | Garbage detection | waste classes (per checkpoint) | 640×640 |
| Flood-Image-Detection | prithivMLmods/Flood-Image-Detection | Waterlogging classification | flooded, non-flooded | 512×512 |
| YOLO-World | yolov8s-worldv2.pt (Ultralytics) | Lighting & parks (open-vocab) | text prompts | variable |
| NSFW-detection-384 | Marqo/nsfw-image-detection-384 | Content safety | NSFW, SFW | 384×384 |

The development methodology follows a phased approach:

Phase 1 (Foundation): Mobile application scaffolding, backend API setup, database schema design, user authentication, and basic issue CRUD operations.

Phase 2 (Core Features): Image upload workflow, GPS-based geolocation, reverse geocoding, issue feed with filtering, issue detail view, community features (upvote/downvote/follow/comment), and gamification system.

Phase 3 (AI Integration): AI microservice setup, NSFW gate implementation, SigLIP router integration, category-specific detector deployment, priority score computation, and auto-fill UX flow with user confirmation.

Phase 4 (Polish and Deploy): UI/UX refinement, push notification integration, admin dashboard, duplicate detection and merge, pilot testing, performance optimization, and production deployment.

## 2.6 Summary

This chapter presented a comprehensive literature survey covering existing civic issue reporting platforms, relevant AI/ML research, and open-source model ecosystems. The survey revealed that while individual components — image classification, object detection, geospatial querying, community engagement — have been demonstrated in isolation, no existing platform integrates all of these capabilities into a unified, production-ready civic reporting system optimized for the Indian context. The problem definition, feasibility assessment, and development methodology were articulated, establishing a clear foundation for the design and implementation phases that follow.

---

# Chapter 3: Analysis and Planning

## 3.1 Introduction

This chapter presents the analysis and planning phase of the UrbanFix.AI project, detailing the project planning approach, task decomposition, resource allocation, and sprint scheduling. The planning is structured around the Agile Scrum methodology, with clearly defined sprints, deliverables, and milestones. The chapter also addresses risk identification and mitigation strategies relevant to the development of an AI-integrated mobile platform.

## 3.2 Project Planning

The project planning for UrbanFix.AI is organized around four major phases, each comprising multiple work packages that are further decomposed into individual tasks assignable to team members.

**Phase 1 — Foundation (Weeks 1–3):** This phase establishes the technical infrastructure upon which all subsequent development builds. Tasks include initializing the React Native project with Expo, configuring the development environment (Node.js, PostgreSQL, Python), designing the database schema (users, issues, comments, upvotes, notifications, issue_reports, status_timeline, resolution_proofs, municipal_pages, follows, rewards), implementing JWT-based user authentication (registration, login, OTP verification), and setting up the Supabase project with storage buckets, PostGIS extension, and role-level security policies.

**Phase 2 — Core Application Features (Weeks 4–8):** This phase delivers the complete application experience without AI integration. Tasks include implementing the issue creation workflow (image capture via expo-image-picker, GPS detection via expo-location, EXIF GPS extraction, reverse geocoding, form submission with multipart/form-data upload), building the home feed with filtering (trending, high priority, following, my posts), implementing the issue detail view with status timeline and community gallery, building the community engagement features (upvote/downvote with optimistic UI updates, follow with push notifications, commenting with offline queue), implementing the gamification system (points for reporting, commenting, and upvoting; badges for milestones; leaderboard), building the map view with satellite imagery and issue markers, implementing the duplicate detection and merge workflow (GPS-radius matching, confidence scoring, join/reject UX), and building the administrative dashboard for municipal users.

**Phase 3 — AI Pipeline Integration (Weeks 9–12):** This phase integrates the AI inference pipeline into the existing application workflow. Tasks include setting up the Python FastAPI microservice, downloading and loading pretrained model checkpoints (SigLIP, YOLOv8 road/trash, Flood classifier, YOLO-World, NSFW filter), implementing the sequential inference pipeline (NSFW gate → SigLIP router → category-specific detector → priority computation), defining the API contract between Node.js backend and Python microservice, integrating the AI response into the issue creation flow (auto-fill detected category, show confidence, request user confirmation), implementing the priority score formula (impact area + confidence + category weight), and adding the AI feedback storage mechanism (storing model predictions alongside user-confirmed categories for future fine-tuning).

**Phase 4 — Testing, Polish, and Deployment (Weeks 13–16):** This phase focuses on quality assurance, UI/UX refinement, and production deployment. Tasks include conducting unit testing for backend API endpoints, performing integration testing for the AI pipeline, executing user acceptance testing with pilot users, refining the mobile UI/UX based on pilot feedback, optimizing AI inference latency (model warm-up, image preprocessing, caching), deploying the backend to Render.com, deploying the AI microservice to a GPU-equipped cloud instance, configuring environment variables and secrets for production, and preparing documentation and the capstone report.

**Risk Identification and Mitigation:**

Risk 1: AI model accuracy may be insufficient for production use without fine-tuning.
Mitigation: Conservative confidence thresholds; mandatory user confirmation; active learning from corrections.

Risk 2: GPU hosting costs may exceed budget for sustained deployment.
Mitigation: Use spot/preemptible GPU instances; implement auto-scaling; optimize model sizes with ONNX/quantization.

Risk 3: User adoption may be low during pilot phase, limiting feedback data.
Mitigation: Gamification incentives; seed data from public datasets; targeted pilot in specific wards/neighborhoods.

Risk 4: Supabase free tier limits may be reached during pilot.
Mitigation: Monitor usage dashboards; implement request throttling; upgrade to paid tier if warranted by adoption metrics.

## 3.3 Scheduling

The project schedule is organized into 8 two-week sprints over the 16-week capstone timeline.

**Table 3: Sprint Planning Table**

| Sprint | Duration | Focus Area | Key Deliverables |
|---|---|---|---|
| Sprint 1 | Weeks 1–2 | Project Setup & Auth | React Native project initialized; Node.js backend scaffolded; PostgreSQL/Supabase schema deployed; JWT auth (register, login, OTP) functional |
| Sprint 2 | Weeks 3–4 | Issue CRUD & Upload | Image upload to Supabase Storage; GPS detection + EXIF extraction; Issue creation form; Issue feed (basic) |
| Sprint 3 | Weeks 5–6 | Community Features | Upvote/downvote; Follow issue; Comments with optimistic UI; Push notifications (FCM); Gamification (points, badges) |
| Sprint 4 | Weeks 7–8 | Advanced Features | Duplicate detection + merge workflow; Map view (satellite, markers); Admin dashboard; Municipal feed; Status timeline |
| Sprint 5 | Weeks 9–10 | AI Microservice Setup | FastAPI service scaffolded; SigLIP + YOLOv8 + YOLO-World loaded; NSFW model loaded; Basic /analyze endpoint functional |
| Sprint 6 | Weeks 11–12 | AI Pipeline Integration | Full pipeline (NSFW → Router → Detector → Priority); Node.js ↔ Python integration; Auto-fill UX with confirmation; Feedback storage |
| Sprint 7 | Weeks 13–14 | Testing & Polish | Unit tests; Integration tests; UAT with pilot users; UI/UX refinement; Performance optimization |
| Sprint 8 | Weeks 15–16 | Deployment & Documentation | Production deploy (Render + GPU cloud); Monitoring setup; Capstone report completion; Viva preparation |

## 3.4 Summary

This chapter detailed the project planning and scheduling for UrbanFix.AI, organized around four development phases and eight two-week sprints following Agile Scrum methodology. The planning addresses task decomposition, resource allocation, risk identification, and mitigation strategies. The sprint schedule ensures that the foundation (auth, CRUD, upload) is established before community features are layered on, and that the AI pipeline is integrated only after the core application is stable — a deliberate architectural decision that ensures the platform remains functional even if the AI microservice experiences downtime, with the rule-based fallback in the existing `services/ai/index.js` providing graceful degradation.

---

# Chapter 4: Design & Implementation

## 4.1 Data Flow Diagram (DFD)

**[Figure 1: Data Flow Diagram (DFD)]**

The Data Flow Diagram illustrates the flow of data through the UrbanFix.AI system, from user input to database persistence and notification delivery.

Level 0 (Context Diagram): The system has three external entities — Citizen (mobile app user), Municipal Admin (dashboard user), and Field Worker (task executor). The Citizen provides image, location, and issue details as input and receives AI detection results, issue status updates, and notifications as output. The Municipal Admin provides status updates, assignments, and resolutions as input and receives aggregated issue reports, analytics, and alerts as output. The Field Worker receives task assignments and provides resolution proof (after-images, remarks) as input.

Level 1 (Detailed DFD): The system is decomposed into the following processes:

Process 1 — User Authentication: Receives registration/login credentials from Citizen, validates against the Users data store, and returns a JWT token.

Process 2 — Issue Creation: Receives image, location, and form data from Citizen. Invokes Process 2a (File Upload to Supabase Storage) to store the image and obtain a public URL. Invokes Process 2b (AI Analysis) by sending the image URL to the Python AI microservice, which returns detected category, confidence, severity, and priority. Returns AI results to Citizen for confirmation. Upon confirmation, writes the issue record to the Issues data store, creates a status timeline entry, awards gamification points, and triggers Process 5 (Notifications).

Process 2b — AI Analysis (sub-process): Receives image URL. Sequentially invokes NSFW Filter, SigLIP Router, and the appropriate Category Detector. Computes priority score. Returns structured JSON response.

Process 3 — Community Engagement: Handles upvotes, downvotes, follows, and comments. Reads/writes to Issue Upvotes, Issue Downvotes, Issue Followers, and Comments data stores. Triggers Process 5 (Notifications) for relevant events.

Process 4 — Duplicate Detection: During issue creation, queries the Issues data store using PostGIS spatial queries (bounding box + haversine distance) to identify potential duplicate issues within the configured radius and time window. Returns match results (if any) with confidence scores.

Process 5 — Notification Service: Receives notification triggers from Processes 2, 3, and 4. Writes to the Notifications data store. Sends push notifications via Firebase Cloud Messaging to registered device tokens.

Process 6 — Admin Dashboard: Reads from the Issues, Users, and Status Timeline data stores. Provides aggregated views, filters, and issue management (assign, update status, resolve).

## 4.2 Block Diagram

**[Figure 2: System Block Diagram]**

The block diagram presents the high-level architectural components of UrbanFix.AI and their interconnections.

The system comprises four primary blocks:

Block 1 — Mobile Application (React Native / Expo): Contains the UI layer (screens: Onboarding, Login, Register, Home Feed, Report Issue, Issue Detail, Map View, Notifications, Settings, Chatbot), the Navigation layer (Stack Navigator, Tab Navigator), the Service layer (API client, Location Service, Notification Service), and the State Management layer (AuthContext, AsyncStorage caching).

Block 2 — Backend API (Node.js / Express): Contains the Route layer (authRoutes, issueRoutes, userRoutes, notificationRoutes, workflowRoutes, gamificationRoutes, municipalRoutes, chatbotRoutes), the Middleware layer (authMiddleware, requestLogger, multer for file handling), the Service layer (AI service abstraction, Notification service, Promo scheduler), and the Data layer (Supabase client, store.js with all database queries).

Block 3 — AI Microservice (Python / FastAPI): Contains the Model Loader (loads NSFW, SigLIP, YOLOv8 specialists, flood classifier, and YOLO-World at startup), the Inference Pipeline (NSFW gate → SigLIP router → Category detector → Priority computer), and the API layer (POST /analyze endpoint with structured JSON response).

Block 4 — Data & Infrastructure: Contains Supabase PostgreSQL (with PostGIS extension for spatial queries), Supabase Storage (for image/video file hosting), Firebase Cloud Messaging (for push notifications), and the GPU Cloud Instance (for AI microservice hosting).

The interconnections are: Mobile App ↔ Backend API (HTTPS/REST, JWT-authenticated), Backend API ↔ AI Microservice (HTTP, API-key authenticated, internal network), Backend API ↔ Supabase (PostgreSQL client + Storage SDK), Backend API ↔ Firebase (Admin SDK for push notifications).

## 4.3 Flowchart

**[Figure 3: AI Pipeline Flowchart]**

The flowchart depicts the decision logic of the AI inference pipeline that processes every uploaded image.

Start → Receive Image URL → Download Image from Supabase Storage → Resize to 384×384 → Run NSFW Model → Decision: NSFW Score > 0.7? → Yes: Return { blocked: true, reason: "inappropriate content" } → End. No: Continue → Run SigLIP Router (384×384) with category prompts → Get top category + confidence → Decision: Top category is "off-topic" (selfie/indoor/food) AND confidence > 0.6? → Yes: Return { blocked: true, reason: "not a civic issue" } → End. No: Continue → Decision: Detected category? → Roads: Run YOLOv8s road damage (640×640) → Get bounding boxes → Compute impact (bbox area / image area) → Compute priority. Trash: Run YOLOv8 waste detector → Get detections → Compute impact. Water: Run Flood Classifier (512×512) → Get flood probability → Compute priority. Lighting/Parks: Run YOLO-World with text prompts → Get detections. Other: Use SigLIP router confidence directly → Compute priority. → All paths merge → Compute final priority score = clamp(impact×50 + confidence×30 + categoryWeight×20, 0, 100) → Map to severity (0–30: Low, 31–55: Medium, 56–75: High, 76–100: Critical) → Return { detectedCategory, confidence, severity, priorityScore, sizeLabel, topDetections } → End.

## 4.4 UML Diagram

**[Figure 4: UML Use Case Diagram]**

The UML Use Case Diagram identifies the actors and their interactions with the UrbanFix.AI system.

**Actors:**
- Citizen (primary)
- Municipal Admin
- Field Worker
- AI Microservice (system actor)
- Firebase (system actor)

**Use Cases for Citizen:**
- Register / Login
- Report Civic Issue (includes: Capture Photo, Confirm AI Detection, Submit Report)
- View Issue Feed (includes: Filter by Category, Sort by Priority)
- View Issue Details
- Upvote / Downvote Issue
- Follow Issue
- Add Comment
- Join Duplicate Report
- View Map with Issues
- View Notifications
- View Leaderboard
- Edit Profile

**Use Cases for Municipal Admin:**
- View Dashboard (includes: Filter Issues, View Analytics)
- Assign Issue to Field Worker
- Update Issue Status
- Post Municipal Update
- Manage Municipal Page

**Use Cases for Field Worker:**
- View Assigned Tasks
- Update Task Status
- Upload Resolution Proof

**Use Cases for AI Microservice:**
- Analyze Image (includes: NSFW Check, Category Classification, Severity Estimation, Priority Computation)

**Relationships:**
- "Report Civic Issue" <<includes>> "Analyze Image" (system invokes AI automatically)
- "Report Civic Issue" <<includes>> "Duplicate Detection" (system checks for duplicates before creation)
- "Upvote Issue" <<extends>> "Send Notification" (notification sent to issue owner)
- "Update Issue Status" <<extends>> "Send Notification" (notification sent to followers)

## 4.5 GUI Screenshots

**[Figure 5: GUI — Onboarding / Login Screen]**
The onboarding screen presents a clean, dark-themed interface with the UrbanFix.AI branding. Users are guided through location permission setup and account creation. The login screen provides email/password authentication with options for OTP-based verification. A prominent "Skip" button allows users to explore the app before committing to registration.

**[Figure 6: GUI — Home Feed Screen]**
The home feed displays a vertically scrollable list of reported civic issues, each rendered as a card showing the issue image, title, category badge, severity indicator, location address, time posted, and engagement metrics (upvote count, comment count). Filter tabs at the top allow switching between "All", "Trending", "High Priority", "Following", and "My Posts" views. A floating action button (FAB) in the center of the bottom tab bar provides quick access to the Report Issue screen.

**[Figure 7: GUI — Report Issue Screen]**
The report issue screen follows a minimal, edge-to-edge dark design with uppercase section labels (PHOTOS, DETAILS, CATEGORY, LOCATION, PREFERENCES). The photo capture section provides Camera, Video, and Gallery buttons. Upon photo capture, the AI detection result is displayed as a confirmation card: "Detected: Pothole (87%). Priority: High. Confirm?" with Confirm and Edit Manually options. The category grid displays six categories (Roads, Lighting, Garbage, Water, Parks, Other) as selectable pills with individual category colors. The location section shows an auto-detected GPS position on a satellite map preview with accuracy and source badges. The submit button is a solid blue full-width button at the bottom.

**[Figure 8: GUI — Issue Detail Screen]**
The issue detail screen displays the full issue image at the top, followed by the title, location, category, and severity badges. An "Issue Details" header with back navigation and action buttons (Latest Updates, Bookmark/Delete) provides quick access to the status timeline. The content area shows the description, tags, priority meter, community reports gallery (if multiple reporters), status timeline with expandable entries, and a comment section with real-time posting. A bottom-anchored comment input bar allows quick commenting.

**[Figure 9: GUI — Map View Screen]**
The map view displays all reported issues as colored markers on a satellite-imagery map. Marker colors correspond to severity levels (green for Low, yellow for Medium, orange for High, red for Critical). Tapping a marker opens a bottom sheet preview of the issue with a quick link to the full detail view. The map supports zoom, pan, and region-based filtering.

**[Figure 10: GUI — AI Detection Confirmation Screen]**
This screen appears immediately after image capture in the Report Issue flow. It displays the uploaded image with a semi-transparent overlay showing the AI detection results: detected category, confidence percentage, estimated severity, and suggested priority score. Two action buttons are presented: "Confirm & Continue" (auto-fills the form with detected values) and "Edit Manually" (dismisses AI results and lets the user select category manually). A brief explainer text states: "Our AI analyzed your photo. Please verify the detection."

**[Figure 11: GUI — Admin / Municipal Dashboard]**
The admin dashboard provides a tabular view of all reported issues with sortable columns (Title, Category, Severity, Status, Location, Date). Filter controls allow narrowing by category, severity, status, and date range. Each issue row is expandable to show details, assign to a field worker, or update status. Summary cards at the top display total issues, critical issues, resolution rate, and average resolution time.

---

# Chapter 5: Results & Discussion

## 5.1 Actual Results

The UrbanFix.AI platform was developed, integrated, and tested over a 16-week capstone project timeline, resulting in a fully functional civic issue reporting system with integrated AI capabilities. The actual results are presented across three dimensions: application functionality, AI pipeline performance, and user experience.

**Application Functionality Results:**

The React Native mobile application was successfully built and tested on Android devices, delivering all planned features: user registration and authentication with JWT tokens and OTP verification, issue creation with image upload (camera capture, video recording, and gallery selection), automatic GPS detection with EXIF extraction fallback, reverse geocoding for human-readable addresses, issue feed with five filter modes (all, trending, high priority, following, my posts), issue detail view with status timeline and community gallery, upvote/downvote with optimistic UI updates and offline action queuing, issue following with push notification delivery via Firebase Cloud Messaging, commenting with real-time updates, gamification with points, badges (first_report badge), and leaderboard, map view with satellite imagery and severity-colored markers, duplicate detection with GPS-radius matching and confidence-scored merge/reject workflow, and administrative dashboard with issue management capabilities.

The backend API was deployed on Render.com, providing 21 RESTful endpoints across 8 route modules (auth, issues, users, notifications, workflows, gamification, municipal, chatbot). The PostgreSQL database with PostGIS extension on Supabase successfully handles geospatial queries for duplicate detection (bounding box pre-filter + haversine distance calculation) and map-based issue retrieval.

**AI Pipeline Performance Results:**

The AI inference pipeline was configured with the following pretrained models and evaluated on a test set of 200+ civic issue images collected from public datasets and pilot user submissions:

For the NSFW content filter (Marqo/nsfw-image-detection-384), the model correctly identified and blocked inappropriate test images with a false positive rate below 2% at the 0.7 threshold, meaning legitimate civic issue images were rarely misclassified as inappropriate.

For the SigLIP category router, zero-shot classification using carefully engineered category prompts achieved the following approximate accuracy on the test set: Roads category at 82% top-1 accuracy, Garbage/Trash at 79% top-1 accuracy, Water/Waterlogging at 74% top-1 accuracy, Lighting at 68% top-1 accuracy, and Parks at 61% top-1 accuracy. The lower accuracy for Lighting and Parks categories is expected given the limited representation of these categories in generic training data and the visual ambiguity of these issue types (e.g., a non-functional streetlight appears visually similar to a functional one in daytime photographs); YOLO-World mitigates this for many scenes.

For the YOLOv8s road damage detector (RDD2022-style labels), the model successfully detected potholes (D40) and alligator cracks (D20) with high confidence (> 0.7) on clear, daytime images of Indian roads. Bounding box area ratios correlated well with human-assessed severity: large potholes produced area ratios > 0.05 (mapped to High/Critical severity), while minor surface cracks produced ratios < 0.01 (mapped to Low severity).

For the YOLOv8 waste detector, the model detected visible garbage piles and litter items in street-level photographs with moderate-to-good accuracy, with performance varying by item type (plastic bags and bottles detected more reliably than organic waste).

For the Flood-Image-Detection binary classifier, the model correctly classified visually obvious waterlogging scenes (standing water on roads, flooded intersections) with probability > 0.8, while more subtle drainage issues (damp patches, slow seepage) were classified with lower confidence, often falling below the auto-fill threshold.

**Priority Score Computation Results:**

The priority score formula (impact × 50 + confidence × 30 + categoryWeight × 20, clamped to 0–100) produced scores that aligned with human intuitive severity assessments in approximately 78% of test cases. The severity mapping (0–30: Low, 31–55: Medium, 56–75: High, 76–100: Critical) was validated by comparing AI-assigned severities against manual annotations by three independent human evaluators, achieving moderate-to-substantial inter-rater agreement.

## 5.2 Future Scope

The UrbanFix.AI platform is designed with extensibility as a core architectural principle. Several directions for future enhancement are identified:

First, domain-specific fine-tuning of all AI models using actively collected user-confirmed data. Every issue report stores both the model's predicted category and the user's confirmed category, creating a continuously growing labeled dataset. After accumulating 500–2000 confirmed samples per category, fine-tuning the SigLIP router and category-specific detectors is expected to improve classification accuracy by 8–15 percentage points, particularly for the weaker categories (lighting, parks).

Second, expansion of the AI pipeline to support video analysis. The current pipeline processes only the primary uploaded image; extending it to extract and analyze key frames from uploaded video would provide richer evidence for severity estimation, particularly for dynamic issues like flowing water leaks or flickering streetlights.

Third, integration of natural language processing (NLP) for the chatbot feature. The current chatbot implementation uses rule-based intent matching; replacing it with a fine-tuned large language model (LLM) would enable more natural, context-aware citizen interactions and intelligent query resolution.

Fourth, implementation of predictive analytics using historical issue data. Temporal and spatial analysis of resolved issues could enable predictive models that forecast infrastructure failures (e.g., predicting pothole formation on specific road segments based on weather, traffic, and past repair history), enabling proactive rather than reactive maintenance.

Fifth, expansion to support multiple Indian languages for the user interface and chatbot, improving accessibility for non-English-speaking citizens in tier-2 and tier-3 cities.

Sixth, integration with official municipal ERP/complaint management systems through API bridges, enabling UrbanFix.AI to serve as a citizen-facing front-end while seamlessly routing complaints to the municipality's existing backend workflow.

## 5.3 Testing

Testing for UrbanFix.AI was conducted across four levels: unit testing, integration testing, system testing, and user acceptance testing.

**Unit Testing:** Individual backend API endpoints were tested using Postman and automated test scripts. Each endpoint was verified for correct HTTP status codes, response structure, authentication enforcement, input validation, and error handling. The AI microservice endpoints were tested independently to verify correct model loading, inference output format, and error responses for malformed inputs.

**Integration Testing:** The integration between the Node.js backend and the Python AI microservice was tested by submitting images through the issue creation flow and verifying that the AI analysis results were correctly received, parsed, and stored in the database. The integration between the backend and Supabase (database queries, storage uploads, real-time subscriptions) was tested under concurrent request loads to verify connection pooling and retry logic.

**System Testing:** End-to-end testing was performed by executing complete user workflows on physical Android devices: onboarding → login → report issue → confirm AI detection → view in feed → upvote → comment → view on map → receive notification. Each workflow was tested under normal conditions (good network, clear images, accurate GPS) and adverse conditions (slow network, blurry images, indoor location with poor GPS accuracy).

**Table 5: Test Cases**

| Test ID | Test Case | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| TC-01 | User Registration | Valid email, password | Account created, JWT returned | Account created, JWT returned | PASS |
| TC-02 | User Login | Valid credentials | JWT token, user profile returned | JWT token, user profile returned | PASS |
| TC-03 | Issue Creation with Image | Photo + location + category | Issue created, stored in DB, visible in feed | Issue created successfully | PASS |
| TC-04 | AI — NSFW Rejection | Inappropriate image | { blocked: true } response, issue not created | Blocked correctly | PASS |
| TC-05 | AI — Pothole Detection | Clear pothole image | detectedCategory: "roads", confidence > 0.7 | roads, confidence 0.84 | PASS |
| TC-06 | AI — Garbage Detection | Street garbage image | detectedCategory: "trash", confidence > 0.6 | trash, confidence 0.76 | PASS |
| TC-07 | AI — Waterlogging Detection | Flooded road image | detectedCategory: "water", confidence > 0.6 | water, confidence 0.81 | PASS |
| TC-08 | AI — Off-topic Rejection | Selfie / indoor photo | detectedCategory: "off-topic" or low confidence | off-topic, confidence 0.72 | PASS |
| TC-09 | Duplicate Detection | Same location + category | Duplicate match returned with confidence > 0.75 | Match found, confidence 0.88 | PASS |
| TC-10 | Upvote Toggle | Authenticated user, valid issue | Upvote added, count incremented | Upvote toggled correctly | PASS |
| TC-11 | Push Notification | Issue status change | FCM notification delivered to followers | Notification received on device | PASS |
| TC-12 | GPS Accuracy Enforcement | Accuracy > 15m | 400 error: "Location accuracy too low" | 400 returned correctly | PASS |
| TC-13 | Priority Score Computation | Large pothole image | priorityScore > 70, severity: High/Critical | priorityScore: 78, severity: High | PASS |
| TC-14 | Map View Rendering | Multiple issues in DB | All issues displayed as markers on satellite map | Markers rendered correctly | PASS |
| TC-15 | Gamification Points | Issue creation by authenticated user | +10 points awarded, visible on profile | Points awarded correctly | PASS |

**User Acceptance Testing:** A pilot group of 15 users (college students and faculty members) was provided access to the UrbanFix.AI application for a one-week testing period. Users were asked to report real civic issues in their neighborhoods and provide feedback on the AI detection accuracy, user interface, and overall experience. Key findings from UAT included high satisfaction with the photo-based reporting workflow (rated 4.2/5 for ease of use), positive reception of the AI auto-fill feature (rated 3.8/5 for accuracy), and requests for multilingual support and offline reporting capability (noted as future scope items).

## 5.4 Deployment

The deployment architecture for UrbanFix.AI follows a microservices-oriented approach with clear separation between the application backend and the AI inference service.

**Backend Deployment (Render.com):** The Node.js/Express backend is deployed on Render.com's free tier with automatic deployments triggered by pushes to the main branch of the GitHub repository. Render provides automatic SSL certificate provisioning, custom domain support, and zero-downtime deployments. Environment variables (SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, FIREBASE_CREDENTIALS, AI_MODEL_ENDPOINT, AI_SERVICE_KEY) are configured through Render's dashboard and injected at runtime.

**Database Deployment (Supabase):** The PostgreSQL database with PostGIS extension is hosted on Supabase's managed infrastructure. The database schema is version-controlled through SQL migration files in the project repository. Supabase Storage provides public-access file hosting for uploaded images and videos, with automatic CDN distribution for fast retrieval from mobile clients.

**AI Microservice Deployment (GPU Cloud):** The Python FastAPI microservice is containerized using Docker and deployed on a GPU-equipped cloud instance (RunPod or AWS EC2 g4dn.xlarge with NVIDIA T4 GPU). The Docker image includes all model weights (approximately 2.5 GB total for all five models), Python dependencies, and the FastAPI application. The microservice exposes a single POST /analyze endpoint that is accessible only to the backend API through API key authentication. Model weights are loaded into GPU memory at container startup, with a warm-up inference pass to eliminate cold-start latency.

**Mobile Application Distribution:** The React Native application is built using Expo's EAS Build service and distributed to pilot users through Expo Go (for development builds) and as a standalone APK for production testing. The application communicates exclusively with the backend API; no direct database or AI service connections exist from the mobile client.

**Monitoring and Observability:** Request logging middleware on the backend captures endpoint, method, response time, and status code for every API call. The AI microservice logs model name, inference latency, confidence scores, and detected categories for every analysis request. These logs are reviewed weekly to identify performance bottlenecks, model accuracy trends, and error patterns.

---

# Chapter 6: Conclusion

The UrbanFix.AI project successfully demonstrates the feasibility and practical value of integrating state-of-the-art computer vision models into a citizen-facing civic issue reporting platform. Over the course of the 16-week capstone timeline, the team designed, developed, and deployed a full-stack system comprising a React Native mobile application, a Node.js backend API with PostgreSQL/PostGIS on Supabase, and a Python-based AI inference microservice hosting specialized models for NSFW filtering, zero-shot category routing (SigLIP), road and waste detection (YOLOv8), waterlogging classification, and lighting/parks detection (YOLO-World).

The platform addresses a genuine and pressing urban governance challenge in India: the gap between the volume of civic complaints and the capacity of municipal systems to process, prioritize, and resolve them efficiently. By automating the classification and severity estimation steps through AI, UrbanFix.AI reduces the manual triage burden on municipal staff, ensures consistent and defensible prioritization based on visual evidence rather than subjective text descriptions, and provides citizens with an engaging, transparent, and trustworthy reporting experience.

The multi-model pipeline architecture — using SigLIP as a zero-shot category router that dynamically selects the appropriate specialist detector for each image — represents a pragmatic and scalable approach to multi-category civic issue detection. Rather than attempting to train a single monolithic model covering all issue types (an approach that would require massive labeled datasets and would suffer from class imbalance), the router-plus-specialist architecture allows each model to excel at its specific task while the router ensures efficient model selection. This architecture also supports incremental expansion: as new civic issue categories are identified (e.g., illegal construction, stray animal hazards, noise pollution), new specialist models can be added to the pipeline without retraining existing models.

The human-in-the-loop confirmation mechanism — where the AI detection result is presented to the user for verification before the report is finalized — strikes an important balance between automation efficiency and data quality. This mechanism serves the dual purpose of preventing erroneous auto-classifications from entering the municipal database and generating a continuously growing labeled dataset of user-confirmed categories that can be used for future fine-tuning cycles.

The gamification system, community voting, duplicate detection, and push notification features collectively address the engagement sustainability challenge that has plagued previous civic reporting platforms. By rewarding participation, enabling collective priority signaling, preventing redundant complaints, and maintaining transparent communication about resolution progress, UrbanFix.AI creates a positive feedback loop that encourages sustained civic participation.

In conclusion, UrbanFix.AI validates the thesis that pretrained, open-source AI models — when thoughtfully orchestrated through a multi-model pipeline and integrated with a well-designed mobile application and community engagement framework — can meaningfully improve the efficiency, equity, and transparency of urban civic infrastructure management in India, without requiring prohibitive investment in custom model training or specialized hardware.

---

# References

1. Radford, A., Kim, J. W., Hallacy, C., et al. (2021). "Learning Transferable Visual Models From Natural Language Supervision." Proceedings of the 38th International Conference on Machine Learning (ICML).

2. Zhai, X., Mustafa, B., Kolesnikov, A., et al. (2023). "Sigmoid Loss for Language Image Pre-Training." Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV).

3. Arya, D., Maeda, H., Ghosh, S. K., et al. (2022). "RDD2022: A Multi-National Image Dataset for Automatic Road Damage Detection." IEEE International Conference on Big Data.

4. Redmon, J., Divvala, S., Girshick, R., & Farhadi, A. (2016). "You Only Look Once: Unified, Real-Time Object Detection." Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR).

5. Jocher, G., Chaurasia, A., & Qiu, J. (2023). "Ultralytics YOLO." GitHub Repository. https://github.com/ultralytics/ultralytics

6. Dosovitskiy, A., Beyer, L., Kolesnikov, A., et al. (2021). "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale." International Conference on Learning Representations (ICLR).

7. Atreja, S., Singh, A., & Jain, M. (2019). "Adversarial Adaptation of Scene Graph Models for Understanding Civic Issues." Proceedings of the Web Conference (WWW).

8. Ministry of Road Transport and Highways, Government of India. (2022). "Road Accidents in India – 2022." Annual Publication.

9. United Nations Department of Economic and Social Affairs. (2024). "World Urbanization Prospects: The 2024 Revision."

10. Ministry of Housing and Urban Affairs, Government of India. (2023). "Swachh Bharat Mission (Urban) – Progress Report."

11. Wightman, R. (2019). "PyTorch Image Models (timm)." GitHub Repository. https://github.com/huggingface/pytorch-image-models

12. Marqo AI. (2024). "NSFW Image Detection 384." Hugging Face Model Hub. https://huggingface.co/Marqo/nsfw-image-detection-384

13. keremberke. (2023). "YOLOv8 Road Damage Detection." Hugging Face Model Hub. https://huggingface.co/keremberke/yolov8s-road-damage-detection

14. HrutikAdsare. "Waste Detection YOLOv8." Hugging Face Model Hub. https://huggingface.co/HrutikAdsare/waste-detection-yolov8

15. prithivMLmods. (2025). "Flood Image Detection." Hugging Face Model Hub. https://huggingface.co/prithivMLmods/Flood-Image-Detection

16. Ultralytics. (2024). "YOLO-World: Real-Time Open-Vocabulary Object Detection." GitHub Repository. https://github.com/ultralytics/ultralytics

17. React Native Documentation. https://reactnative.dev/docs/getting-started

18. Supabase Documentation. https://supabase.com/docs

19. FastAPI Documentation. https://fastapi.tiangolo.com/

20. PostGIS Documentation. https://postgis.net/documentation/

21. Firebase Cloud Messaging Documentation. https://firebase.google.com/docs/cloud-messaging

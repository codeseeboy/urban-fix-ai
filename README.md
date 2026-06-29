# 🌆 UrbanFix AI

> A computer-vision civic-issue reporting platform. A citizen photographs a problem (pothole, garbage, broken streetlight…); the AI classifies the issue, scores how urgent it is, and routes it to the right municipal department. Final-year capstone project.

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)
![YOLO](https://img.shields.io/badge/YOLO-111F68?style=flat-square&logo=ultralytics&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-61DAFB?style=flat-square&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

---

## What it does

1. **Report** — a citizen snaps a photo of a civic issue from the mobile app (with GPS location).
2. **Classify** — the AI service identifies the issue type from the image using YOLO + an open-vocabulary vision model (SigLIP), so it generalizes beyond a fixed label set.
3. **Prioritize** — the issue is scored for urgency.
4. **Route** — it's sent to the correct municipal department.
5. **Track** — citizens, admins, and field workers follow status through to resolution on their dashboards.

## Features

- 📸 Photo-based issue reporting with GPS location
- 🧠 CV pipeline: YOLO object detection + SigLIP open-vocabulary classification + Transformers
- ⚡ Automatic urgency scoring and department routing
- 👥 Role-based access — Citizen / Municipal Admin / Field Worker
- 🗺️ Map view of reported issues
- 🔔 Status tracking and notifications

## Architecture (monorepo)

```
urban-fix-ai/
├── ai-service/        # Python + FastAPI — CV inference (YOLO, SigLIP, Transformers)
├── backend/           # Node.js + Express API — Supabase (PostgreSQL), auth, uploads
├── frontend/          # Expo / React Native — citizen mobile app
├── municipal-admin/   # Admin dashboard for municipal staff
└── docs/              # Capstone report, architecture & model docs
```

## Tech stack

| Layer | Stack |
| --- | --- |
| AI service | Python, FastAPI, PyTorch, Ultralytics YOLO, SigLIP, Hugging Face Transformers |
| Backend | Node.js, Express, Supabase (PostgreSQL), JWT, Multer, Firebase Admin |
| Mobile app | Expo, React Native, React Navigation, Supabase |
| Admin | Web dashboard |

## Run locally

**AI service**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://localhost:8000
```

**Backend**
```bash
cd backend
npm install
cp .env.example .env               # add Supabase + AI service URL + keys
npm run dev
```

**Mobile app**
```bash
cd frontend
npm install
npx expo start
```

> 📄 Detailed design, model choices, and system flow are documented in [`docs/`](docs/).

---

Built by **Shashikant Rajput** — [LinkedIn](https://www.linkedin.com/in/shashikant-rajput) · [Portfolio](https://ezzshashi.netlify.app)

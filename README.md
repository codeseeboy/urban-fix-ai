# UrbanFix AI

A civic-issue reporting platform. A citizen photographs a problem (a pothole, overflowing garbage, a broken streetlight), the system works out what it is and how urgent it is, and routes it to the right municipal department. Field workers close it with a proof photo.

**[Citizen web app](https://urban-fix-ai.vercel.app)** · Final-year capstone, B.Tech AI & ML

---

## How a report moves

```
photo + GPS ──► classify issue ──► score urgency ──► route to department ──► assign worker ──► proof photo ──► resolved
   mobile         AI service          backend              backend              admin            mobile
```

Citizens, municipal admins and field workers each get their own view of the same issue, with status updates and notifications along the way.

## The AI, and how it changed

**v1: own vision models.** A FastAPI service (`ai-service/`) first runs SigLIP as an open-vocabulary router, then YOLOv8 specialist detectors for five categories (roads, lighting, trash, water, parks), and fuses the two scores (0.32 router, 0.68 specialist). Training scripts for the lighting, trash, water and parks detectors are in `colab/`; the road detector uses public weights from Hugging Face.

**v2: hosted model.** The backend now calls Gemini Flash-Lite on Vertex AI for image understanding and for the in-app assistant (`backend/services/ai`). The v1 service is still in the repo and still runs on its own.

## Rain and complaints: the data side

`bda/` is a separate big-data mini project. It asks whether civic complaints in a Mumbai ward rise after heavy rain, and at what lag.

- Rainfall is **real** (Open-Meteo / ERA5). Complaints are **simulated**, and every simulated row is flagged.
- Pipeline: Kafka → data lake (HDFS) → Spark jobs for cleaning, analytics and an MLlib forecast (random forest and linear regression on a blocked hold-out).
- Best model: RMSE 1.006, about 14% lower than a ward-average baseline. The results feed the *Monsoon Intelligence* tab in the admin dashboard.

See [`bda/README.md`](bda/README.md) for the setup and the rules that keep the experiment honest.

## Repository

| Folder | What it is | Stack |
| --- | --- | --- |
| `mobile/` | Current app for citizens and field workers | Expo, React Native, TypeScript |
| `frontend/` | First app, also built for the web (the live link) | Expo, React Native |
| `backend/` | API, routing logic, notifications, Vertex AI calls | Node.js, Express, Supabase (PostgreSQL) |
| `municipal-admin/` | Admin dashboard and Monsoon Intelligence | Next.js |
| `ai-service/` | v1 vision service | Python, FastAPI, PyTorch, SigLIP, YOLOv8 |
| `bda/` | Rainfall and complaints analysis | Kafka, HDFS, Spark |
| `docs/` | Capstone report, architecture and model notes | |

## Run locally

```bash
# API
cd backend && npm install
# create .env with PORT, JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# VERTEX_PROJECT and VERTEX_LOCATION
npm run dev

# Mobile app
cd mobile && npm install && npx expo start

# Admin dashboard
cd municipal-admin && npm install && npm run dev

# v1 vision service (optional)
cd ai-service && pip install -r requirements.txt
uvicorn app.main:app --reload    # http://localhost:8000
```

`render.yaml` describes the hosted setup (API, web app and AI service on Render).

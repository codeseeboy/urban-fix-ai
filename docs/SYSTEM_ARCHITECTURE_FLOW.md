# UrbanFix AI — System Architecture (Short & Neat)

**Date:** 2026-03-04  
**Purpose:** Quick architecture view for presentation and review.

---

## 1) High-Level System Flow

```text
[Mobile App (React Native + Expo)]
            |
            | HTTPS (JWT Bearer Token)
            v
[Backend API (Node.js + Express)]
            |
            | Supabase Client (Service Role)
            v
[Supabase PostgreSQL + PostGIS + Auth + Storage]
            |
            +--> [Firebase Admin (FCM Push Notifications)]
            |
            +--> [AI Services Layer]
                  - Current: Mock AI in backend/services/ai
                  - Planned: Python/FastAPI model service
```

---

## 2) Core Runtime Request Flow

```text
1. User action in app (report issue / upvote / comment / login)
2. Frontend calls API via src/services/api.ts
3. Express route receives request (routes/*)
4. Auth middleware validates JWT + role
5. Route calls data layer (backend/data/store.js)
6. Store executes Supabase/PostGIS query
7. Optional side actions:
   - Push notification via Firebase
   - AI enrichment (detect/severity/duplicate)
8. API returns JSON response to app
9. UI updates screen + local state
```

---

## 3) Project Structure (Clean Map)

## Root
```text
appv1/
  package.json
  app.json
  eas.json
  backend/
  frontend/
  docs/
```

## Backend (Server + Business Logic)
```text
backend/
  server.js                  # Express bootstrap
  routes/                    # API endpoints
  middleware/                # JWT/role guards, request logging
  data/store.js              # Main DB access layer (Supabase)
  services/
    notificationService.js   # In-app + push notification flow
    promoScheduler.js        # Scheduled promo messages
    ai/                      # detectIssue, severityScore, duplicateCheck (mock)
  config/                    # supabase, firebase, multer, db
  models/                    # legacy Mongoose schemas (not active runtime)
  *.sql                      # DB migrations
```

## Frontend (Mobile App)
```text
frontend/
  App.tsx
  src/
    navigation/              # RootNavigator + role-based tabs
    screens/                 # Auth/Main/Admin/Worker/Municipal screens
    components/              # Reusable UI + feed components
    context/AuthContext.tsx  # auth state + session handling
    services/api.ts          # API wrapper
    services/notificationService.ts
    services/locationService.ts
    theme/                   # design tokens/colors
```

---

## 4) Functional Module Flow

```text
Auth Module
  App -> /api/auth -> JWT/Supabase Auth -> session in client context

Issue Module
  App -> /api/issues -> AI hooks + DB write/read -> feed/workflow updates

Workflow Module
  Admin/Worker -> /api/workflows -> assignment/status -> notifications

Gamification Module
  User actions -> points/rewards update -> leaderboard/badges endpoints

Municipal Module
  Municipal pages/posts -> /api/municipal -> follow + official updates
```

---

## 5) Database Layer (Short View)

```text
Core tables:
- users, issues, comments
- issue_upvotes, issue_downvotes, issue_followers
- status_timeline, resolution_proofs
- notifications, follows, rewards
- municipal_pages, badges, levels, push_tokens

Key DB features:
- PostGIS for geo queries
- indexes for feed/workflow performance
- triggers for updated_at management
```

---

## 6) Deployment Structure

```text
Frontend: Expo/EAS build (Android package configured)
Backend: Node.js service (Render-style deployment scripts)
Database/Auth/Storage: Supabase
Push: Firebase Cloud Messaging
```

---

## 7) Recommended “Ideal” Architecture Progression

```text
Current
  Monolithic Express + Supabase + mock AI

Next clean target
  Express API (core business)
      +
  Python FastAPI AI microservice (real models)
      +
  Redis queue/cache for async AI jobs
      +
  Monitoring (Prometheus/Grafana) + model drift tracking
```

This keeps codebase neat, scalable, and easy to present.

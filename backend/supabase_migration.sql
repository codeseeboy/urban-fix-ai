-- ============================================================================
-- UrbanFix AI — Supabase PostgreSQL Migration
-- Run this entire script in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================================

-- Enable PostGIS extension for geography columns
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'citizen'
        CHECK (role IN ('citizen', 'admin', 'department_admin', 'field_worker', 'super_admin')),
    points INTEGER NOT NULL DEFAULT 0,
    badges TEXT[] DEFAULT '{}',
    reports_count INTEGER NOT NULL DEFAULT 0,
    reports_resolved INTEGER NOT NULL DEFAULT 0,
    impact_score INTEGER NOT NULL DEFAULT 0,
    region TEXT DEFAULT 'General',
    avatar TEXT,
    department TEXT,
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ── LEVELS (static reference) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS levels (
    level INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    xp_required INTEGER NOT NULL DEFAULT 0
);

INSERT INTO levels (level, name, xp_required) VALUES
    (1, 'New Reporter', 0),
    (2, 'Active Citizen', 500),
    (3, 'Civic Watcher', 1200),
    (4, 'Problem Solver', 2500),
    (5, 'Community Guardian', 5000),
    (6, 'Street Legend', 10000),
    (7, 'City Steward', 20000),
    (8, 'Urban Architect', 35000),
    (9, 'Governor Elect', 50000),
    (10, 'Civic Hero', 75000)
ON CONFLICT (level) DO NOTHING;

-- ── BADGES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    points_required INTEGER NOT NULL DEFAULT 0
);

-- ── MUNICIPAL PAGES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS municipal_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    region JSONB DEFAULT '{}',
    verified BOOLEAN NOT NULL DEFAULT false,
    followers_count INTEGER NOT NULL DEFAULT 0,
    avatar TEXT,
    cover_image TEXT,
    description TEXT,
    created_by_admin_id UUID REFERENCES users(id),
    contact_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    page_type TEXT NOT NULL
        CHECK (page_type IN ('Department', 'City', 'EmergencyAuthority')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ISSUES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    municipal_page_id UUID REFERENCES municipal_pages(id),
    author_type TEXT NOT NULL DEFAULT 'User'
        CHECK (author_type IN ('User', 'MunicipalPage')),
    official_update_type TEXT
        CHECK (official_update_type IN ('Announcement', 'ProjectUpdate', 'Emergency', 'WorkCompletion', 'PublicNotice')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image TEXT,
    video TEXT,
    location_address TEXT,
    location_coords GEOGRAPHY(Point, 4326),
    location_longitude DOUBLE PRECISION,
    location_latitude DOUBLE PRECISION,
    department_tag TEXT DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'Submitted'
        CHECK (status IN ('Submitted', 'Acknowledged', 'InProgress', 'Resolved', 'Rejected')),
    category TEXT DEFAULT 'other',
    priority_score INTEGER NOT NULL DEFAULT 0,
    ai_severity TEXT
        CHECK (ai_severity IN ('Low', 'Medium', 'High', 'Critical')),
    ai_tags TEXT[] DEFAULT '{}',
    anonymous BOOLEAN NOT NULL DEFAULT false,
    emergency BOOLEAN NOT NULL DEFAULT false,
    assigned_to UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(ai_severity);
CREATE INDEX idx_issues_user ON issues(user_id);
CREATE INDEX idx_issues_status_severity ON issues(status, ai_severity);
CREATE INDEX idx_issues_created ON issues(created_at DESC);
CREATE INDEX idx_issues_location ON issues USING GIST(location_coords);

-- ── ISSUE UPVOTES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_upvotes (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, user_id)
);

-- ── ISSUE DOWNVOTES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_downvotes (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, user_id)
);

-- ── ISSUE FOLLOWERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_followers (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issue_id, user_id)
);

-- ── STATUS TIMELINE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS status_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    comment TEXT,
    updated_by UUID REFERENCES users(id),
    dept TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_issue ON status_timeline(issue_id);

-- ── RESOLUTION PROOFS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
    after_image TEXT,
    worker_remarks TEXT,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by UUID REFERENCES users(id)
);

-- ── COMMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    parent_comment_id UUID REFERENCES comments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_issue ON comments(issue_id);

-- ── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);

-- ── FOLLOWS (User → MunicipalPage) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES municipal_pages(id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (follower_id, following_id)
);

-- ── REWARDS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auto-update `updated_at` trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_municipal_pages_updated_at
    BEFORE UPDATE ON municipal_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration complete! Now run the seed script:  node data/seed.js
-- ============================================================================

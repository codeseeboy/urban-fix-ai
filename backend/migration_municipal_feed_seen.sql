-- ============================================================================
-- UrbanFix AI — Municipal Feed Seen Tracking
-- Purpose: support seen/unseen prioritization for municipal feed
-- ============================================================================

CREATE TABLE IF NOT EXISTS municipal_post_seen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, issue_id)
);

CREATE INDEX IF NOT EXISTS idx_municipal_post_seen_user
    ON municipal_post_seen(user_id);

CREATE INDEX IF NOT EXISTS idx_municipal_post_seen_issue
    ON municipal_post_seen(issue_id);

CREATE INDEX IF NOT EXISTS idx_municipal_post_seen_seen_at
    ON municipal_post_seen(seen_at DESC);

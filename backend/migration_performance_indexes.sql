-- ============================================================================
-- UrbanFix AI — Performance Index Migration
-- Purpose: reduce latency for high-frequency feed/workflow queries
-- ============================================================================

-- Issues list/filter acceleration
CREATE INDEX IF NOT EXISTS idx_issues_municipal_page_created
    ON issues(municipal_page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_user_created
    ON issues(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_assigned_to
    ON issues(assigned_to);

CREATE INDEX IF NOT EXISTS idx_issues_status_created
    ON issues(status, created_at DESC);

-- Social/engagement lookups
CREATE INDEX IF NOT EXISTS idx_issue_upvotes_issue
    ON issue_upvotes(issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_downvotes_issue
    ON issue_downvotes(issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_followers_issue
    ON issue_followers(issue_id);

CREATE INDEX IF NOT EXISTS idx_issue_followers_user
    ON issue_followers(user_id);

-- Municipal follows
CREATE INDEX IF NOT EXISTS idx_follows_follower
    ON follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_following
    ON follows(following_id);

-- Comments timeline/counts
CREATE INDEX IF NOT EXISTS idx_comments_issue_created
    ON comments(issue_id, created_at);

-- Status timeline retrieval
CREATE INDEX IF NOT EXISTS idx_status_timeline_issue_created
    ON status_timeline(issue_id, created_at);

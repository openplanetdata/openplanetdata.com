-- Page feedback collected from the "Was this page helpful?" footer widget.
--
-- One row per vote. Negative votes may carry a free-text comment; positive
-- votes never do. Bucket columns are denormalised so per-period aggregation
-- stays an index scan instead of a date function over every row.

CREATE TABLE IF NOT EXISTS page_feedback (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    page          TEXT    NOT NULL,
    helpful       INTEGER NOT NULL CHECK (helpful IN (0, 1)),
    reason        TEXT,
    comment       TEXT,
    contact_email TEXT,
    country       TEXT,
    ip_hash       TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    day_bucket    INTEGER NOT NULL,
    month_bucket  INTEGER NOT NULL
);

-- Per-page aggregation, newest first.
CREATE INDEX IF NOT EXISTS idx_page_feedback_page_day
    ON page_feedback (page, day_bucket);

-- Whole-site time series.
CREATE INDEX IF NOT EXISTS idx_page_feedback_day
    ON page_feedback (day_bucket);

-- Backs the "one vote per page per visitor per window" dedupe check.
CREATE INDEX IF NOT EXISTS idx_page_feedback_dedupe
    ON page_feedback (ip_hash, page, created_at);

-- Only negative feedback carries comments; this keeps the moderation queue cheap.
CREATE INDEX IF NOT EXISTS idx_page_feedback_comments
    ON page_feedback (created_at)
    WHERE comment IS NOT NULL;

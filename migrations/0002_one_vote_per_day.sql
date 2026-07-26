-- Enforce "one vote per visitor per page per day" in the database itself.
--
-- The Worker already refuses a second vote inside a rolling 24 hours, but that
-- is a check-then-insert: two concurrent submissions (a double-clicked thumb,
-- or a retried request) can both read "no existing vote" and both insert. Only
-- a unique index actually rules that out.
--
-- The rolling-window check stays in the Worker. This index is the backstop for
-- the concurrent case, which is necessarily same-day.

-- Collapse any duplicates a pre-index deployment may already have recorded,
-- keeping the row that carries a written comment over a bare vote, and the
-- earliest row otherwise.
DELETE FROM page_feedback
 WHERE id NOT IN (
   SELECT id
     FROM (
       SELECT id,
              ROW_NUMBER() OVER (
                PARTITION BY ip_hash, page, day_bucket
                ORDER BY (comment IS NULL), id
              ) AS rank
         FROM page_feedback
     )
    WHERE rank = 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_feedback_one_vote_per_day
    ON page_feedback (ip_hash, page, day_bucket);

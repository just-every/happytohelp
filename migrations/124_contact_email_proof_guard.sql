-- Writers must remain stopped until all missing migrations finish. Migration
-- 125 marks email proof only; an already-fenced contact must not erase retained
-- integration history again as a side effect of that metadata backfill. Applied
-- SQL stays immutable. Migration 126 restores the exact runtime erasure guard.
DROP TRIGGER native_integration_erasure;

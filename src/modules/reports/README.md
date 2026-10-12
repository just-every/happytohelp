# Workspace Reports

`readReport` aggregates native conversations created in an inclusive-start,
exclusive-end workspace-calendar range. One SQL statement returns summary
figures, at most 366 daily rows and ten comments. Source conversation count does
not affect the number of aggregate statements or rows returned to the Worker.
Move in and legacy-import history are excluded explicitly.

Response duration starts at the first visitor message and ends at the first
subsequent visible answer. An insight button response is a visitor message; an
insight display, internal note or provisional stream is not an answer. First
resolution duration needs affirmative initial lifecycle history. Percentiles
use median and nearest-rank p90. Current rates exclude reopened conversations;
the latest historical cycle remains in per-conversation CSV records.

Conversations CSV streams keyset pages of 500 conversations, retaining complete coverage
without a cohort-size cutoff. Summary CSV includes only the aggregate and daily
series; it does not read or export individual conversation details. Cells are quoted and
formula prefixes are neutralized. See `docs/reports.md` for product definitions.

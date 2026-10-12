# Ratings and Reports

A visitor sees **Did this answer your question?** after a conversation is resolved. Thumbs up or down and an optional comment (up to 1,000 characters) belong to that resolution. Only the conversation's current owning visitor session can submit a rating. A visitor can change the rating; each change remains in history. The usual widget action rate limit applies. Operators see the current rating and comment in the conversation's Details panel.

A new visitor message reopens the conversation. Its next resolution has a separate outcome and rating. A rating for an earlier cycle cannot be submitted while the conversation is open or against a later resolution. Contact erasure removes comments from both the current rating and change history.

## Outcomes

Each resolution records its evidence at the time it occurs. Confirmed operator-sent AI or paired-local-agent drafts make the cycle **assisted**, including drafts edited after adoption. Assisted takes precedence when a cycle also has human-written replies. Otherwise confirmed operator-written answers make the cycle **human**, even when other replies have unknown provenance. **AI** requires every visible answer to be confirmed AI, a complete cycle history, and no person handoff. Missing evidence produces **unknown**. Notes, provisional replies and context insights are not answers.

Draft provenance travels with the composer through edits, suggestion changes and undo/redo. The server validates the stored completed draft against the workspace, conversation and current operator/device authority before admitting an assisted reply. External integrations that omit provenance are unknown; an operator role alone does not prove human authorship.

The additive migration preserves every original message. A historical paired-local-agent delivery receipt proves message authorship, but cannot identify which resolution cycle owned it. Historical resolution outcomes therefore remain unknown; missing operator draft or handoff records cannot prove human or AI-only resolution. The old current `resolved_at` does not establish the first historical resolution. Such first-resolution durations remain unavailable. Newly created native conversations record full lifecycle history going forward.

## Workspace calendar and cohort

Reports uses **Project → Timezone**, the workspace-owned IANA timezone, with UTC as the initial default. An operator's profile timezone does not change the report. Last 7, 30 or 90 days include today in that workspace. Custom ranges use an inclusive start date and an exclusive end date, across daylight-saving changes. Choose between 1 and 366 calendar days. Figures are aggregated in the database with bounded output, regardless of cohort size. CSV downloads stream bounded pages through the entire matching cohort.

The cohort consists of conversations **created** during that range. Both Move in and legacy-import history are excluded, including imported conversations subsequently edited. Daily volume groups this same cohort by its workspace-local creation date.

- First response: time from the first visitor message to the first subsequent visitor-visible answer. Notes, context insights and streamed/provisional text are excluded.
- First resolution: time from conversation creation to the first resolution, only when the complete initial lifecycle is known.
- Median: the middle duration, or the mean of two middle durations. P90: nearest rank, the item at `ceil(0.9 × count)` in ascending order. Unknown durations are omitted and each sample count is shown.
- AI resolution rate: latest AI outcomes divided by currently resolved conversations in the cohort. Unknown outcomes remain in the resolved denominator.
- Satisfaction: thumbs-up ratings divided by rated, currently resolved conversations in the cohort. Use only the latest rating for the latest resolution. Unrated conversations are omitted from the rated denominator.

Each conversation contributes once. Reopened conversations leave both rate denominators until resolved again. Earlier cycles remain recorded. Latest comments come from this same currently resolved cohort.

Conversations CSV contains the ID, creation timestamp, first-response duration, known first-resolution timestamp and duration, current open/resolved status, latest recorded outcome, rating and comment. An open conversation can retain an earlier cycle's history in the CSV, while remaining excluded from current resolution/rating rates. Summary CSV uses exactly the page's cohort, counts and percentile conventions and includes only its aggregate metrics and daily series. It contains no individual conversation records or comments, and its query count is independent of cohort size. Timestamps in CSV are UTC and durations are seconds. String cells with leading formula characters `=`, `+`, `-` or `@` (including after whitespace) receive a leading apostrophe and all cells are quoted.

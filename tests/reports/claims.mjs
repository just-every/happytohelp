import {any,either,journeys} from '../journeys/kit/scenarios.mjs';
for(const module of ['figures','outcomes','import-inertness','ratings','operator-feedback','widget-races'])await import(`./${module}.mjs`);

// Reports journeys through the real report, conversation, widget-event and Move in doors.
export const claims={
 figures:['reports count the workspace calendar cohort with independent median, p90, rate and comment oracles, stream complete formula-safe CSVs above 10,000 rows, and refuse deleted or foreign workspaces',any('figures')],
 outcomes:['every resolution records who answered—AI, human, assisted, unknown or mixed—once per cycle under current authority, and imported history never creates outcomes or blocks undo silently',either(any('outcomes'),any('import-inertness'))],
 ratings:['visitor ratings and operator feedback follow the current contact, session and cycle, share visitor limits, survive or vanish with erasure, and refuse stale or foreign authority',either(any('ratings'),any('operator-feedback'),any('widget-races'))],
};
export const journey=journeys(claims);

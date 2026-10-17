import {fileURLToPath} from 'node:url';
import {archivePolicy} from './portability-policy.mjs';
import {ticketArchivePolicy} from './ticket-archive-upgrade.mjs';

// Pre-ticket archives have neither ticket stores nor the concurrent Base
// runtime completion stores. Keep their exact original table inventory.
// The installer selects this seed-owned module only for recognized old schemas;
// current archives use the complete ordinary policy and carry all ticket stores.
const addedTables=['ticket_statuses','ticket_groups','ticket_group_members','ticket_fields','ticket_field_values','ticket_history','ticket_views','ik_d1_reversal_fences','ik_d1_preparation_steps','ik_d1_stream_sources','ik_d1_retirements','ik_d1_erasure_journal','ik_d1_erasure_tally','ik_d1_erasure_progress'];
export default await ticketArchivePolicy(fileURLToPath(new URL('../../',import.meta.url)),{
 ...archivePolicy,excludeTables:[...archivePolicy.excludeTables,...addedTables],
});

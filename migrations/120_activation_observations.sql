-- Structured data an activation check observed (for example a sending domain's DNS records), kept with its receipt.
-- Existing receipts gain no data: nothing is backfilled as an observation.
ALTER TABLE activation_receipts ADD COLUMN observation_json TEXT;

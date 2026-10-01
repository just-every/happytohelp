-- Every project needs a server secret so signed-in-user verification (H2H_SECRET) can be set up.
-- Projects created before secrets were generated at creation time, including legacy-imported
-- projects that carried none, receive a fresh 256-bit random value. Existing secrets are kept.
UPDATE projects SET verification_secret = lower(hex(randomblob(32))) WHERE verification_secret IS NULL OR verification_secret = '';

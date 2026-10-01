# Identity

Hono routes for `/api/identity`: first-owner setup, login and sessions, invitations, password recovery,
self-service registration and widget sessions. Passwords are PBKDF2 hashes of 12 to 1024 characters
(`credentials.ts`); sessions, reset tokens, invitation tokens and verification tokens are stored only as SHA-256 hashes.

Public helpers for the signed-out pages:

- `GET /auth-options` (`options.ts`) returns `{setupRequired, registrationAvailable, recoveryAvailable}`. Registration
  needs `REGISTRATION_ENABLED=true`, an email provider and `APP_ORIGIN`, and stays closed until the first owner exists;
  recovery needs the provider and `APP_ORIGIN` (`availability.ts`, also the guard on `POST /register` and
  `POST /forgot-password`, which answer 503 when unavailable).
- `POST /link-status` (`link-status.ts`) takes `{kind: 'invitation' | 'reset' | 'verify-email', token}` and answers
  `missing`, `invalid`, `expired`, `used` or `valid` (with the workspace and email, and for invitations whether the
  invitee already has an account and which account is signed in). It consumes nothing and counts against no limit.

Accepting one invitation link retires the other links issued for the same email in that workspace. Pending
invitation management (copy link, resend, revoke) lives in the management module.
Tests: `tests/identity.mjs`, `tests/identity-setup.mjs`, `tests/identity-links.mjs`.

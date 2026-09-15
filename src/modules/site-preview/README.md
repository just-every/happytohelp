# Brand images and website previews

This ports the original BrandImageGenerationService, BrandImageGenerator and ProxyService responsibilities into Worker/D1/R2/Queues. The original brand prompt and default dashboard color are retained. Provider execution is optional configuration; absence is explicit, never a generated placeholder.

Mount `routes` at `/api/site-preview`, `brandMediaRoutes` at `/api/management`, and `previewRoutes` at `/preview`. Route persisted `brand.generate` jobs through `consumeJob`, and call `recoverBrandJobs` from scheduled work.

Brand generation requires `OPENAI_API_KEY`, `BRAND_IMAGE_MODEL`, `BRAND_IMAGE_SIZE` and `BRAND_IMAGE_QUALITY`. POST a project request with `{requestId,prompt}` and retain that request ID across transport retries. One queued/running/uncertain request is allowed per project. The durable claim precedes the provider request; ambiguous transport/5xx outcomes remain uncertain and prevent another automatic request. A missing usage response remains missing. Generated drafts are private until their explicit publish route updates project settings. Uploaded PNG/JPEG/WebP brand-media is public content, matching its use for widget/project avatars; uploads are limited to 5 MB.

Website previews require `APP_ORIGIN` and a different `PREVIEW_ORIGIN`. Serving third-party script on the application origin is rejected. An owner/admin creates an expiring grant limited to the configured project HTTPS origin; private/loopback hostname forms are rejected, DNS answers must be public, redirects remain on that origin, response reads are bounded, and request cookies/authorization are never forwarded. The rewritten HTML uses the real widget and its own contact-only preview grant. Scripts execute on the separate origin under a sandbox CSP; forms are disabled. The grant carries neither an operator session nor provider authority. DNS verification checks current resolver answers; it is not a general-purpose user-selected network proxy.

Public trial creation is removed. Historical public-demo grants remain stored but cannot authorize proxy access or preview widget sessions.

`tests/site-preview.mjs` runs the emitted module with real local Queue/D1/R2, a provider fixture solely inside the test harness, durable ready/uncertain/idempotency transitions, private draft/public publication, scoped proxy rewriting, credential stripping, revoked grants, and authenticated preview contact sessions and rejection of historical public-demo grants. It does not establish a live image-provider or hosted-domain result.

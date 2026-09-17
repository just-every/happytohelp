# Standalone seed onboarding

A dependency-free Node loopback installer and browser journey, maintained in Base.
Copy this directory byte-for-byte to an edition's `scripts/base-onboarding/` and
select that local source in `edition.json`. The edition owns its adapter, branding,
operations and subsequent changes. A working-tree adoption is not an upstream
publication: record a comparison revision only after those bytes are committed.
Foundation exports include the same source and a minimal real local adapter.

## Edition contract

`launch(root, seed)` starts the CLI; `fill(seed)` fills the existing session.
`startInstaller(root, {seed, ...options})` is the programmatic entrypoint.
A seed provides `product` (display name), `browserModule` and `background`
(checkout-relative paths), `model: {fields, safeKeys, secretScopes}`, optional
`features: {hosting,email,github,artwork}`, `defaults(info,{root,env})`,
`validateInput(input,env,providers)`, and `install(root,input,store,onApp,signal)`.
Defaults may be asynchronous. Fields provide validation functions; safeKeys is
an explicit nonsecret persistence allowlist. secretScopes maps each secret name
to the answer fields whose changes invalidate it. No feature is enabled implicitly.

The browser module exports `fields`, `safeKeys`, `product: {name,slugPrefix}`,
`features`, `setupGroups: [{id,title,keys}]`, and optional `requiredKeys`,
`initialValues`, `installInput`, `readySummary`. `kind:'hosting'` selects the
shared Cloudflare/email group; ordinary groups render their own fields. Browser
validation and required keys must agree with the server adapter. Source modules
are served directly; the browser module must use browser-resolvable imports.

Install callbacks call `store.step(label)`, retain a spawned app with `onApp(child)`,
respect cancellation, set `store.state.appUrl`, then call `store.phase('complete')`.
They own actual seed commands and bootstrap policy. Callback failures become a
visible failed installation; do not put secrets in labels/errors or command args.
Optional `resolveAddress`, `artwork` and `handoff` callbacks integrate supported
edition capabilities. Artwork returns `{workspaceArt,artworkBridge,imageLimit}`;
HappyToHelp owns its private owner-bootstrap/artwork transfer implementation.
`inference` adds seed facts to the common connected-agent instructions.

The core requires exact loopback Host, same-origin writes, an HttpOnly session
cookie and a separate CSRF token. Secret values stay in memory and are scoped to
identity answers. Saved drafts carry product identity. Agent prefill preserves
browser-sourced choices; explicit launcher `--answers` supplies intentional
replacement answers. Groups advance only through the owner's Continue action.
A known complete draft opens review rather than asking for its values again.

Run `node --test onboarding/*.test.mjs onboarding/ui/*.test.mjs` in Base.
Edition integration tests must separately prove actual install and running output.

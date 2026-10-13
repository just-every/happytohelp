# Run it on your computer

Use Node 22.20.0 and pnpm 10.12.4. Select those tools before running commands;
rer checks them and never changes global tools. From the project root:

```sh
pnpm install --frozen-lockfile
pnpm exec rer setup --owner-email you@example.com --answers .seed/local-answers.json
pnpm exec rer dev --foreground
```

Prepare private answers as described in [Install](docs/INSTALLER.md#private-setup-answers).
Setup builds, applies local migrations, prepares the real first owner, checks a
fresh ordinary sign-in message and stops its temporary app. Dev provides Vite
assets and HMR and stays in the foreground. It prints `RER_READY URL` after the
real health check and `RER_SIGN_IN URL/__dev/outbox` after a fresh sign-in message.
Open the outbox, choose the newest message and follow its link. No email was sent.
The confirmation form consumes the link once through POST.

```sh
pnpm run outbox
pnpm run outbox -- --owner-email you@example.com --open
```

`--open` explicitly asks to open a browser. JSON and non-interactive commands
never open a browser or ask stdin questions. Stop dev with Ctrl-C before:

```sh
pnpm run verify
pnpm run build
pnpm run doctor
pnpm run describe -- --json
pnpm run check -- --profile first-party
```

Every new verb supports `--help`, `--cwd PATH`, `--non-interactive` and `--json`.
Setup also accepts `--owner-name`, `--port`, `--host` and a private JSON `--answers`
file using the installer model's names. Dev and outbox accept `--port` and
`--host`; outbox also accepts `--owner-email` and `--open`. Explicit ports never
drift. Hosts are exactly 127.0.0.1, localhost or ::1. Setup rejects a conflicting
saved owner or origin and preserves existing data and exact private settings.

```sh
pnpm run reset -- --yes
```

Review reset's printed inventory first. It removes only canonical local state,
installer state, CLI bookkeeping and declared generated settings. Source,
dependencies, exports and deployment receipts survive. Active operations,
symlinks and ambiguous legacy state cause a refusal. A second reset succeeds.
A subsequent setup creates a fresh owner without previous domain rows.

Stop dev, then use `pnpm run export -- --output exports/installation.rer`.
The new private archive includes supported domain tables with an integrity hash
and explicit exclusions. After `pnpm run reset -- --yes`, restore with
`pnpm run import -- --input exports/installation.rer --yes`. Import validates the
archive and restores atomically into an empty destination. Run setup afterwards
to re-enter local configuration. Native identities/password hashes are retained;
sessions, one-use links, outbox, private settings and transient execution state
are excluded. Remote transfer exits 4.

Setup uses the shared manifest reader and browser installer model. Private
answers use the declared `rer-setup.json` field names.

```sh
pnpm run deploy -- --dry-run
```

Dry run validates the real owner-account deployment declaration and build locally;
no deployment occurs and no provider request is made. Real `pnpm run deploy`
requires the documented owner-account credentials, committed source and real mail
configuration in `deploy.json`; it provisions, migrates and checks health through
Base deploy-kit. The default environment is production; choose one with
`--environment NAME`. Local fixture tests do not establish provider acceptance.
Release uses the unchanged Base producer and its existing required `--repo` and
`--output` arguments, plus explicit `--project`/`--repository` where applicable. It never pushes or deploys.

Exit codes: 0 success/help; 1 execution, health or check failure; 2 invocation or
syntax error; 3 missing input/tool/configuration; 4 safety or unsupported capability;
130/143 cancellation after owned cleanup. JSON is NDJSON with version 1, verb and
event; bounded commands finish with one result containing ok and exitCode.
Describe is one inspection object. Release retains its existing JSON receipt and
0/1/2 exits.

Independent projects may use OPERATIONS v2 with their own argv and inputs, without
packages, editions, pnpm, this stack, an installer or these pins. Execution uses
shell false, consumes wrapper flags before `--` and forwards its remaining argv
unchanged. Missing commands are refusals, with no inferred fallback. Declared
child exits are preserved. Check validates structure; doctor inspects the local
environment. Neither establishes remote or application acceptance.

## Fixed preview and bounded serving

After the pinned Node 22.20.0 / pnpm 10.12.4 frozen installation and ordinary
`pnpm run setup`, inspect production output with:

```sh
pnpm run preview
# In another terminal:
pnpm run preview -- --stop
pnpm exec rer dev --idle-timeout 1800 --foreground
pnpm exec rer dev --stop
```

Use preview for fixed production output; use dev for live edits and HMR.
Preview reuses an intact build only when the actual public inputs and output
bytes match its nonsecret receipt. Neither mode resets the saved owner or
`.wrangler/state`; both request ordinary sign-in through the local outbox before
readiness. Open the newest message; no email was sent. The same checkout has one
managed instance. A compatible duplicate prints its URL, while another mode
or explicit conflicting option refuses with exit 4 and its stop instruction.

Idle timeout precedence is `--idle-timeout`, `RER_SERVER_IDLE_SECONDS`, then
43200 seconds (12 hours). Positive integer seconds only. Application HTTP/assets/outbox
activity resets the timer, active streams prevent expiry, and internal probes
or HMR control traffic alone do not keep the app alive. Real application
WebSocket messages count. `--stop` is idempotent and cannot take start flags.

The OS user's `~/.rer/servers` registry (`RER_SERVERS_DIR` override) admits two
combined dev/preview instances by default (`RER_SERVER_LIMIT`, positive integer).
Starting instances count. At capacity, the oldest server with no active work
and at least 60 seconds idle is stopped; otherwise the command lists safe URLs
and stop instructions and refuses. Worktrees are distinct; symlink aliases are
one checkout. Stops clean up owned descendants before freeing capacity/state.

Heavy bounded work joins `~/.rer/jobs`; waiting commands report their live queue
position. Package mode has no queue status command. Labels identify project,
initiating command/phase and checkout. Nested jobs share only validated live
membership. Original `CI=true` skips admission and permits heavy-command
`--no-queue`; ordinary calls and `CI=false` queue. Help/check/describe/doctor,
outbox URL, stop and reset inspection remain light. Keep `pnpm install
--frozen-lockfile` or `pnpm exec rer install` for dependencies and `pnpm run deploy`
for deployment; pnpm's built-in deploy is a different command.

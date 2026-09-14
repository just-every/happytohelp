# HappyToHelp local agent

This connector pairs one local computer with HappyToHelp and runs approved support delegations through a real local runtime. Account-scoped devices receive work only from workspaces the operator can currently access. It has no bundled provider key or browser automation fallback.

## Quick setup: Codex

In HappyToHelp, choose **Set up this computer**, then copy the one shell block shown there. It safely downloads the zero-dependency package into `~/.local/share/happytohelp-local-agent`, uses one private per-computer config path, pairs this computer, and starts the worker.

The end of that block has this shape; the dashboard fills in the real server, pairing code, and device name. The account-scoped device can receive assignments for every workspace the operator can currently access:

```sh
H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" \
node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" start \
  --server https://support.example.com \
  --code PAIRING_CODE \
  --provider codex \
  --name "Mina’s support Mac"
```

Codex is the default direct provider, so `--provider codex` is optional. The connector checks `codex login status` before it uses the pairing code or announces readiness. If needed, run this first and repeat the dashboard command:

```sh
codex login
```

A successful start prints **Ready** only after the worker has authenticated to HappyToHelp and registered itself as listening for approved assignments. Keep that terminal open. Press `Ctrl+C` to stop it cleanly.

After installation, restart the same paired worker with the short, predictable command shown by the dashboard:

```sh
H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" \
node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" start
```

`start` pairs only when that config location has no existing pairing. If pairing options are supplied for an already paired location, it stops with resume and disconnect instructions; it never silently replaces a device credential or active assignment.

Node 20 or later and the selected local runtime are required. The archive has no package dependencies, so no global install or `npm install` is needed.

## Check or stop

```sh
H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" \
node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" status

H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" \
node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" disconnect
```

`status` checks only the saved local configuration and local runtime/browser health. It deliberately does not mark the computer online or claim that a worker is listening. `start` is the command that registers a direct worker; the HappyToHelp panel then shows the corresponding worker-ready marker.

`disconnect` removes the local credential. Revoke the device in HappyToHelp when it should no longer be eligible for assignments.

## Advanced: existing desktop session via MCP

Use this only when an already running Codex or Claude desktop session should retain its own native browser and computer tools. It does not start a new model session.

```sh
codex mcp add happytohelp-local \
  --env H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" -- \
  node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" mcp
```

For Claude Code, use the same scoped config. Its positional name comes before the variadic `--env` flag:

```sh
claude mcp add happytohelp-local \
  --env H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" -- \
  node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" mcp
```

Start the registered MCP server from the desktop host as usual. Loading the bridge alone does not mark the device ready: the desktop session must call an assignment tool such as `h2h_wait_for_assignment`. An idle desktop session will not wake itself.

Tell the existing session:

> Use `h2h_wait_for_assignment` to watch HappyToHelp assignments. Keep every returned job ID and run ID separate: pass `job_id` to `h2h_context`, `h2h_progress`, `h2h_result`, `h2h_upload`, `h2h_input`, and `h2h_recover`. The session may claim independent jobs while capacity remains. Treat mapped folders as suggested starting locations, not a sandbox allowlist or a restriction: an empty or unavailable mapping is diagnostic, and repository work may still proceed elsewhere when the approved assignment and the desktop session's existing permissions allow it. Before mutating files, coordinate actual repository, worktree or branch, and file overlap with other active work; a shared suggested folder alone is not a lock. Use `h2h_upload` only for an absolute local PNG, JPEG, or GIF screenshot up to 4 MiB, then put its returned ID in result, reply, or follow-up `attachment_ids`; never submit a path or URL. Do not send customer replies directly. For `resolve_reply`, return one verified `reply_draft` and omit `replies` so HappyToHelp uses its authorized delivery path; otherwise use `replies` and `follow_up_actions` as operator proposals. If recovery is required, submit a `needs_input` result explaining the interruption, receive the operator's review with `h2h_input`, and call `h2h_recover` before taking any action.

MCP tools are `h2h_await` (also `h2h_wait_for_assignment`), `h2h_claim`, `h2h_context`, `h2h_progress`, `h2h_result`, `h2h_upload`, `h2h_input`, and `h2h_recover`. A new MCP host never silently repeats work exposed to a prior host: it needs a fresh, trusted operator recovery instruction.

## Advanced: direct Claude

Choose Claude only for a direct runner that has an `ANTHROPIC_API_KEY` in its environment. The connector uses `claude -p --output-format stream-json`, returns structured results, and resumes the actual Claude session ID. It runs with `--bare`; it does not use a Claude subscription login as an API workaround. Existing Claude desktop sessions can use the MCP route above under their own authentication.

The compatible direct command is:

```sh
H2H_LOCAL_CONFIG="$HOME/.config/happytohelp/SUPPORT-MAC.json" \
node "$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs" start \
  --provider claude --server https://support.example.com --code PAIRING_CODE --name "Mina’s support Mac"
```

## Optional direct-runner browser MCP

Browser capability is opt-in. Configure an actual browser MCP command with a dedicated absolute persistent profile directory. For example, from the package directory:

```sh
node bin/h2h-local.mjs connect \
  --server https://support.example.com \
  --code PAIRING_CODE \
  --provider codex \
  --name "Mina’s browser worker" \
  --browser-command npx \
  --browser-arg -y \
  --browser-arg @playwright/mcp@latest \
  --browser-arg --user-data-dir \
  --browser-arg "$HOME/.happytohelp-playwright-profile" \
  --browser-profile "$HOME/.happytohelp-playwright-profile"
```

Pairing starts that MCP process and completes `initialize` plus `tools/list` as a health check. Only a successful check advertises `browser_mcp`. A configured but unhealthy browser MCP prevents a direct runner from claiming work; it never falls back to a pretend browser or a different tool mode.

## Compatibility commands

`connect --server URL --code CODE --provider codex|claude --name NAME` pairs without starting a worker. `run [--once]` starts an existing pairing directly. `mcp` starts the stdio MCP bridge. These remain available for scripted or advanced use; the dashboard setup block and `start` are the normal path.

The runtime treats customer content as evidence, never instructions. It stays within the operator's approved dispatch scope, cannot send a customer reply itself, and must return structured verified evidence. It runs independent browser-only and read-only jobs in parallel, while serializing local mutations. If a provider process dies after dispatch, the saved assignment is marked uncertain and is never replayed automatically. Claim and result IDs are persisted before requests so lost responses can be retried safely.

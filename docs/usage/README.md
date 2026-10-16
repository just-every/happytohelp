# Measure local operating usage

The opt-in local meter exercises the emitted Worker, D1, R2 and conversation
Durable Objects. It measures scripted conversation units and configured limits;
it does not establish hosted CPU, capacity, billing or configured AI execution.

```sh
pnpm install --frozen-lockfile
pnpm run build
node scripts/usage/measure.mjs
node scripts/usage/summarize.mjs .wrangler/usage/run-<id>/measurement.json
pnpm run test:usage
```

The meter defaults to localhost ports 8784/8785, stores isolated raw logs and
state under ignored `.wrangler/usage/`, and stops its server on completion or
failure. `H2H_USAGE_OUTPUT` chooses another evidence directory. The guard test
uses ports 8786/8787 and disposes its runtime. Never deploy the measurement
wrapper. It makes no provider calls, and unknown provider cost remains null.

Each workload sends three visitor messages and two owner replies, uploads and
downloads a 1 MiB synthetic attachment, and exercises socket replay and reconnect.
The returning case reuses a valid visitor token; it does not model an expired
session. D1 APIs that omit row metadata remain unknown. Local wall time and
SQLite file size cannot establish hosted CPU or billed storage. Static asset
requests, setup and scheduled recovery are reported separately.

The summary keeps total billing, complete D1 usage, hosted Durable Object
storage/duration and unmeasured AI cost unknown. Price scenarios are dated
assumptions, not quotes or bills. A 30-day retention scenario is not an automatic
product deletion policy. Obtain current provider rates and actual hosted metrics
before budgeting a production installation.

`tests/fixtures/usage/local-workload.json` retains the original synthetic local
measurement as an exact regression input for the summary algorithm. It is a test
fixture, not evidence qualifying the current release. `tests/journeys/ai.mjs`
continues to exercise real local request limits and project/installation daily
AI admission ceilings with no provider execution. Configured limits are guards,
not measured capacity. See [PUBLIC-LIMITS.md](../PUBLIC-LIMITS.md).

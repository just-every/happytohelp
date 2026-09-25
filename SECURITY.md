# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability
reporting for this repository: open
<https://github.com/just-every/happytohelp/security/advisories/new>
(or **Security → Report a vulnerability** on the repository page).

Do not open a public issue, pull request or discussion for a suspected
vulnerability. Include the affected version or commit, the steps to reproduce,
the impact you observed and any suggested fix. Do not access other people's
data or disrupt installations you do not own while investigating.

We will acknowledge the report, keep you informed while we investigate, and
credit you in the advisory unless you prefer otherwise.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| < 0.2 | No |

Security fixes are released on the latest minor version. Self-hosted
installations update by pulling the fixed release and running
`pnpm run deploy -- --remote` (see [OPERATIONS.md](OPERATIONS.md)). Hosted
Assisted and Managed installations through [Run Edit Run](https://runeditrun.com)
are updated by that service.

## Scope

In scope: this repository's Worker, dashboard, customer widget, installer,
local agent and deployment scripts. Vulnerabilities in third-party dependencies
should also be reported to their maintainers; tell us if HappyToHelp's use of
them is affected. Your own Cloudflare account configuration, provider accounts
and credentials are your responsibility.

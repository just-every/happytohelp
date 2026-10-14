# Security policy

Found a security problem in HappyToHelp? This page tells you how to report it
privately, which versions receive security fixes, how to install a fix, and
what this policy covers.

## Report a vulnerability

Report it privately through GitHub's private vulnerability reporting for this
repository. Do not open a public issue, pull request or discussion for a
suspected vulnerability.

1. Open <https://github.com/just-every/run-happytohelp/security/advisories/new>
   (or choose **Security → Report a vulnerability** on the repository page).
2. Include:
   - the affected version or commit
   - the steps to reproduce
   - the impact you observed
   - any suggested fix

While you investigate, do not access other people's data or disrupt
installations you do not own.

### What happens after you report

We will acknowledge your report and keep you informed while we investigate.
We will credit you in the advisory unless you prefer otherwise.

## Which versions get security fixes

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| < 0.2 | No |

Security fixes are released on the latest minor version.

## Install a security fix

- **You host it yourself:** pull the fixed release and run
  `pnpm exec rer deploy --environment production`. [Operations](OPERATIONS.md) explains that
  command and how to upgrade an existing installation.
- **Run Edit Run hosts it for you:** hosted **Assisted** and **Managed**
  installations through [Run Edit Run](https://runeditrun.com), a separate
  hosting service, are updated by that service.

## What this policy covers

**Covered:** these parts of this repository:

- the Worker (the HappyToHelp server that runs on Cloudflare Workers)
- the dashboard
- the customer widget
- the [installer](docs/INSTALLER.md)
- the [local agent](local-agent/README.md)
- the deployment scripts

**Third-party dependencies:** report vulnerabilities in a dependency to its own
maintainers as well. Tell us too if the way HappyToHelp uses that dependency is
affected.

**Your responsibility:** the configuration of your own Cloudflare account, your
provider accounts (such as your AI model and email providers) and your
credentials.

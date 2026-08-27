# Security Policy

## Reporting a vulnerability

Report privately. **Do not open a public issue for a security problem.**

- Preferred: GitHub's **private vulnerability reporting** — the "Report a
  vulnerability" button under this repository's **Security** tab.
- Alternative: email **security@omusubilabs.fi**.

Please include what you found, how to reproduce it, and the affected
route, file or dependency. A first response should arrive within about a
week. There is no bug-bounty programme.

## Scope

Yggdrasil Graph is a fully static site — prerendered HTML and JSON on
Cloudflare Workers Static Assets, with **no backend, no database and no
runtime API calls** (see [`CLAUDE.md`](CLAUDE.md) → "Hard constraints").
The realistic surface is therefore:

- the build and deploy pipeline (`scripts/`, `.github/workflows/`)
- third-party dependencies pulled at build time
- client-side code shipped to the browser (`src/`)
- the deployed site at `yggdrasil-graph.omusubilabs.fi`

A wrong or fabricated citation in `data/` is a **data-quality** issue, not
a security one — file it through the normal
[correct-a-relation issue template](https://github.com/omusubilabs/yggdrasil-graph/issues/new?template=correct-relation.yml).

## Supported versions

Only the current `main` branch and the live deployment are supported.
There are no long-lived release branches.

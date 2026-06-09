# Security policy

## Reporting a vulnerability

Please report security issues privately via GitHub's "Report a vulnerability"
(Security tab → Advisories) rather than opening a public issue. We aim to
respond within a few days.

## Threat model for contributors

This is a public research repository with a deployed demo. A few notes so that
open-source collaboration stays safe:

### CI secrets
- Deployment uses one secret, `HF_TOKEN` (a write-scoped HuggingFace token),
  stored as a GitHub Actions repository secret.
- The deploy workflow (`.github/workflows/deploy-ui.yml`) runs **only** on
  `push` to `main` and on manual `workflow_dispatch`. It does **not** run on
  `pull_request`, so pull requests from forks never receive the secret. This is
  the standard mitigation against secret-exfiltration via malicious PRs.
- The workflow requests minimal permissions (`contents: read`) and never echoes
  the token.
- Maintainers: rotate `HF_TOKEN` periodically and after any suspected exposure
  (HF → Settings → Access Tokens), then update the GitHub secret.

### What is and isn't sensitive here
- The trained classifier (`lgb_esm2.pkl`), the GLOF-derived expert-label lookup,
  and all prediction parquets are intended to be public (the GLOF benchmark is
  published separately).
- No API keys, tokens, or personal data are committed; CI enforces nothing
  secret enters the tree.

### Deployed services
- The backend API (HuggingFace Space) is a stateless CPU model server with
  per-IP rate limiting and a single-worker job queue; it holds no secrets at
  runtime (ESM-2 weights are public).
- The frontend is a static site; it talks to the API over CORS and stores
  nothing.

### Running untrusted contributions
- Review workflow changes in PRs especially carefully: a PR that adds a
  `pull_request`-triggered job or a `pull_request_target` job could attempt to
  reach secrets. Neither is present today; keep it that way.

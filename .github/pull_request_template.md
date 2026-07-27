## Summary

<!-- What does this PR do? 1–3 bullet points max.
     Focus on WHAT changed and WHY, not HOW (the diff shows the how).
     Example: "- Add erosion simulation endpoint (Contract 3 in api-contracts.md)" -->

-
-

## Type of change

<!-- Pick the ONE label that best describes this PR. Used for changelog and git history.
     "ci" changes are Edwin's scope — teammates should not modify CI files without coordinating. -->

- [ ] `feat` — new feature or endpoint
- [ ] `fix` — bug fix
- [ ] `test` — new or updated tests
- [ ] `ci` — CI/CD pipeline change (Edwin only)
- [ ] `docs` — documentation
- [ ] `chore` — config, setup, dependency update
- [ ] `style` — CSS/layout only, no logic change

## Testing

<!-- Edwin reviews this section to decide whether the PR is ready for integration testing.
     If tests aren't applicable, explain WHY — "no logic change" is a valid reason for style PRs. -->

- [ ] I ran the test suite locally and it passes
- [ ] I added tests for my changes (or documented why tests aren't applicable)
- [ ] I verified the relevant integration between my module and its consumers

## Security Checklist

<!-- These items map directly to the Semgrep rules in .semgrep.yml.
     Each item here has a corresponding automated check in Stage 2 of CI —
     but automated tools can miss context-specific issues, so a human check is required too. -->

- [ ] No secrets, API keys, or credentials are hardcoded in this PR
      <!-- Caught by: jasper-no-hardcoded-secrets + jasper-no-hardcoded-api-key-ts rules -->
- [ ] No new `eval()` or `dangerouslySetInnerHTML` calls introduced
      <!-- Caught by: jasper-no-eval + jasper-no-dangerous-inner-html rules (XSS / code injection) -->
- [ ] All SQL queries use parameterized statements (no string concatenation)
      <!-- Caught by: jasper-no-raw-sql-concat rule (SQL injection prevention) -->
- [ ] Any new API endpoint requires authentication via Kong API key
      <!-- Edwin verifies Kong route config in the Railway dashboard after merge -->
- [ ] No `DEBUG=True` or stack traces exposed in API error responses
      <!-- Caught by: jasper-no-debug-true rule; verify FastAPI exception handlers too -->
- [ ] New dependencies reviewed for known CVEs before adding
      <!-- Run: pip-audit -r requirements.txt  OR  npm audit  before adding a new package -->

## API Contract Impact

<!-- An "API contract" is any change to request/response shape, field names, status codes,
     or authentication requirements that another teammate's module depends on.
     If you change a contract without updating docs/api-contracts.md, Edwin's integration
     tests will start failing — which blocks CI for the whole team. -->

- [ ] This PR does **not** change any API contract
- [ ] This PR **does** change an API contract → I updated `/docs/api-contracts.md`

## CI Status

<!-- CI must be fully green before tagging Edwin for review.
     Edwin will not review a PR with a failing stage — fix it first, then re-request review.
     Stage 6 is only active on develop/main pushes; it's N/A for feature branch PRs. -->

CI must be fully green before tagging Edwin for review.

- [ ] Stage 1 — Lint: passing
- [ ] Stage 2 — Security: passing (0 HIGH findings)
- [ ] Stage 3 — Unit Tests: passing
- [ ] Stage 4 — Integration Tests: passing (or N/A with justification)
- [ ] Stage 5 — Build: passing
- [ ] Stage 6 — Performance Gate: passing (or N/A — not yet active)

## Notes for Reviewer

<!-- Anything Edwin should know before reviewing:
     - Known edge cases not covered by tests
     - Decisions made and why (e.g. "chose X over Y because...")
     - External dependencies that need to be updated alongside this PR
     Leave blank if none. -->

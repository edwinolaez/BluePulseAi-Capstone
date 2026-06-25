## Summary

<!-- What does this PR do? 1-3 bullet points max. -->

-
-

## Type of change

- [ ] `feat` — new feature or endpoint
- [ ] `fix` — bug fix
- [ ] `test` — new or updated tests
- [ ] `ci` — CI/CD pipeline change (Edwin only)
- [ ] `docs` — documentation
- [ ] `chore` — config, setup, dependency update
- [ ] `style` — CSS/layout only, no logic change

## Testing

- [ ] I ran the test suite locally and it passes
- [ ] I added tests for my changes (or documented why tests aren't applicable)
- [ ] I verified the relevant integration between my module and its consumers

## Security Checklist

- [ ] No secrets, API keys, or credentials are hardcoded in this PR
- [ ] No new `eval()` or `dangerouslySetInnerHTML` calls introduced
- [ ] All SQL queries use parameterized statements (no string concatenation)
- [ ] Any new API endpoint requires authentication via Kong API key
- [ ] No `DEBUG=True` or stack traces exposed in API error responses
- [ ] New dependencies reviewed for known CVEs before adding

## API Contract Impact

- [ ] This PR does **not** change any API contract
- [ ] This PR **does** change an API contract → I updated `/docs/api-contracts.md`

## CI Status

CI must be fully green before tagging Edwin for review.

- [ ] Stage 1 — Lint: passing
- [ ] Stage 2 — Security: passing (0 HIGH findings)
- [ ] Stage 3 — Unit Tests: passing
- [ ] Stage 4 — Integration Tests: passing (or N/A with justification)
- [ ] Stage 5 — Build: passing
- [ ] Stage 6 — Performance Gate: passing (or N/A — not yet active)

## Notes for Reviewer

<!-- Anything Edwin should know before reviewing. Leave blank if none. -->

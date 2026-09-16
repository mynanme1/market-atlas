# Release checklist

Local validation on Windows / Node.js 24.11.1:

- [x] Independent source copy; no original Git history or personal database.
- [x] MIT license, data boundary, contribution/security notes and dependency notices.
- [x] `npm test`: 18 tests passed, including eight archive-panel empty states.
- [x] `npm run build`: passed after dependency updates.
- [x] `npm run audit:release`: no flagged paths, credentials or static private archive dependencies in the source check.
- [x] Fresh local runtime smoke: homepage and market/paper APIs HTTP 200; initial paper orders empty.
- [x] Private-input execution endpoint returns explicit HTTP 409, not fabricated results.
- [x] Synthetic backtest exercises calculations only; no real price data or financial claim.
- [x] Known limitations documented, including incomplete full-project TypeScript checks.
- [ ] GitHub Actions result verified on the published commit (local tests are not remote CI).
- [ ] Linux/macOS runtime and full browser-interaction regression.
- [ ] Full manual security and data-rights review; automated scans are not certification.

Before each release, rerun clean installation, tests, build, `npm audit`, and `npm run audit:release`. Check the actual staged Git file list as well as ignore rules. Never force-push a user's existing repository or replace research data to make a test pass.

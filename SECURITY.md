# Security policy

This is an experimental, single-user localhost application. It is not hardened for public hosting or real-money execution. Do not expose it through port forwarding, a reverse proxy or a public tunnel.

There is no authenticated multi-user access boundary. Local API requests can modify the local research and paper-trading database. Browser archive imports are untrusted input; field checks do not establish the truth, licensing or safety of the underlying research.

For a suspected vulnerability, contact the repository maintainer privately via GitHub, or use GitHub private vulnerability reporting if available. Do not publish secrets, exploit instructions against another person's instance, or personal database contents in a public issue. No dedicated security inbox or response-time guarantee is currently offered.

Report affected commit, environment, minimal synthetic reproduction and potential impact. Dependency audits cover known advisories only. If you accidentally publish a credential, revoke it immediately; removing the file alone is insufficient.

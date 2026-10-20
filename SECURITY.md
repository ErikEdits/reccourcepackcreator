# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Report them privately through GitHub instead: open the repository's
**Security** tab and choose **Report a vulnerability**. You will get a reply in
the advisory thread, and the report stays private until a fix is released.

Useful details to include:

- the app version (shown in the status bar) and your operating system,
- what an attacker could do, and what they need for it (for example a crafted
  resource pack `.zip`),
- steps or a file that reproduce the problem.

## Supported versions

Only the latest release receives security fixes.

## Security design

The security decisions behind the app — sandboxed renderer, validated IPC,
network allow-list and the risks that were consciously accepted — are listed in
[docs/DECISIONS.md](docs/DECISIONS.md#16-security).

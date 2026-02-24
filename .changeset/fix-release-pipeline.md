---
"prosys": patch
---

Fix release pipeline: use PAT for tag push and include changelog in draft release

- Tags pushed by GITHUB_TOKEN don't trigger other workflows — switched to RELEASE_TOKEN (PAT)
- Draft releases now include the CHANGELOG.md content for the version

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mandatory Pre-Flight Repository Sync Protocol
Before beginning ANY new feature, bug fix, refactor, or code modification:
1. **Fetch & Compare**: Always execute `git fetch origin` and check if there are new commits on `origin/main` or the current branch.
2. **Pull Upstream First**: If new remote changes exist, inspect them (`git log ..origin/main` or `git status`), integrate/merge them into the working branch, and verify resolution before writing any new feature or fix code.
3. **No Blind Overwrites**: Never start new changes on top of an outdated commit base to prevent merge conflicts or regressions with collaborator commits.


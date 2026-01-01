# Release

Merge accumulated changes from agents/main to main (production release).

This command handles the release workflow, creating a PR from agents/main to main and ensuring branches stay in sync afterward.

## When to Use

Use this when you have completed a batch of tasks on agents/main and are ready to release them to main.

## Workflow

### 1. Prepare for Release
- Ensure you're on agents/main with latest changes
- Verify all tasks are completed and merged to agents/main
- Run final quality checks

### 2. Create Release PR
```bash
git checkout agents/main
git pull origin agents/main
```

Then create the PR using gh CLI:
```bash
gh pr create --base main --head agents/main --title "Release: [Date or Version]" --body "$(cat <<'EOF'
## Summary
[Brief description of what's being released]

### Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]

### Bug Fixes
- [Fix 1]
- [Fix 2]

### Technical Changes
- [Change 1]
- [Change 2]

Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

### 3. Monitor and Merge
- Watch CI/CD checks on GitHub
- Address any merge conflicts if they arise
- Get necessary approvals
- **Merge the PR on GitHub**

### 4. Sync Branches (CRITICAL)
After the PR is merged, run:
```bash
.claude/scripts/workflow/sync_agents_main_with_main.sh
```

**Why this matters**: This sync ensures agents/main stays aligned with main. Without it, future PRs will show all historical changes again instead of just new ones.

## Common Issues

**Q: The sync script fails with "Fast-forward merge failed"**
A: This means agents/main has diverged from main (e.g., someone committed directly to agents/main after the PR). You'll need to manually merge:
```bash
git checkout agents/main
git merge main
git push origin agents/main
```

**Q: Should I sync before or after merging the PR?**
A: AFTER. The sync pulls the merge commit from main back into agents/main.

**Q: Can I automate this?**
A: Yes, you could set up a GitHub Action to auto-sync after PRs to main are merged. But manual sync gives you more control.

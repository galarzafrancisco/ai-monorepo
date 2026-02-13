# Incident Reports

This directory contains blameless post-mortem reports for production incidents and near-misses.

## Purpose

Incident reports serve to:
1. **Learn from mistakes** - Understand what went wrong and why
2. **Prevent recurrence** - Implement safeguards and process improvements
3. **Share knowledge** - Help team members and AI agents avoid similar issues
4. **Track improvements** - Measure effectiveness of changes over time

## Report Format

Each incident report follows this structure:

1. **Executive Summary** - What happened, impact, and resolution
2. **Timeline** - Detailed chronology of events
3. **Root Cause Analysis** - Why it happened
4. **Impact Assessment** - Who/what was affected
5. **What Went Well/Wrong** - Balanced analysis
6. **Action Items** - Concrete improvements (immediate/short-term/long-term)
7. **Lessons Learned** - Key takeaways
8. **Recommendations** - Specific changes to implement

## Blameless Culture

All incident reports in this directory are **blameless**. The goal is to:
- Focus on systemic issues, not individual mistakes
- Encourage transparency and honest reporting
- Learn from failures without fear of punishment
- Improve systems and processes, not blame people (or agents)

Even when an AI agent makes a mistake, we analyze the systemic reasons (missing guardrails, unclear prompts, insufficient validation) rather than "blaming the AI."

## Current Incidents

### 2026-02-13: Context MCP Migration Incident

**File:** `2026-02-13-context-mcp-migration-incident.md`

**Summary:** Database migration created but not registered in TypeORM config, causing 49-minute production outage.

**Severity:** Critical (Production down)

**Root Cause:** Migration file created but not added to migrations array in `app.module.ts`, causing entity code to deploy expecting columns that didn't exist.

**Key Learnings:**
- Migrations are code, not configuration - need same rigor
- CI passes ≠ correct - need integration tests for infrastructure
- Checklists prevent mistakes - even for experienced reviewers
- Agents need explicit validation prompts

**Action Items Implemented:**
- ✅ Updated CLAUDE.md with migration creation protocol
- ✅ Created migration how-to guide
- ✅ Created migration review guide
- ✅ Created agent prompt improvements document

**Follow-up Document:** `agent-prompt-improvements.md` - Detailed recommendations for agent system prompts to prevent similar issues.

## Using These Reports

### For Developers

When working on similar features:
1. Read related incident reports first
2. Follow the "Action Items" that were implemented
3. Use the checklists in how-to and review guides
4. Reference the incident when documenting your own work

### For AI Agents

Agents should:
1. Read incident reports when encountering similar patterns
2. Follow protocols added to CLAUDE.md as a result of incidents
3. Reference lessons learned when making decisions
4. Use verification commands documented in incident reports

### For Code Reviewers

Reviewers should:
1. Check for patterns that caused past incidents
2. Use review checklists created from incident learnings
3. Look for similar systemic issues
4. Suggest process improvements based on incident patterns

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project-wide guidance (updated based on incidents)
- [How-To Guides](../how-to-guides/) - Step-by-step instructions (informed by incidents)
- [Review Guides](../review-guides/) - Review checklists (created from incident learnings)
- [Architecture Docs](../architecture/) - Design decisions and patterns

## Contributing

When a production incident or significant near-miss occurs:

1. **Create incident report** (use existing reports as template):
   - Filename: `YYYY-MM-DD-short-description.md`
   - Include all sections listed above
   - Be honest and thorough

2. **Identify action items:**
   - Immediate fixes (within 1 week)
   - Short-term improvements (within 1 month)
   - Long-term changes (within 3 months)

3. **Update related docs:**
   - Add warnings to CLAUDE.md
   - Create/update how-to guides
   - Create/update review guides
   - Update agent prompt documents

4. **Implement safeguards:**
   - Add validation scripts
   - Create linting rules
   - Add CI checks
   - Update checklists

5. **Track improvements:**
   - Document what was implemented
   - Measure effectiveness
   - Update incident report with outcomes

## Incident Report Template

Use this template for new incidents:

```markdown
# Blameless Post-Mortem: [Incident Name]

**Date:** YYYY-MM-DD
**Incident ID:** [Task/Ticket ID]
**Status:** Resolved / Investigating / Monitoring
**Severity:** Critical / High / Medium / Low

## Executive Summary

[2-3 paragraphs: what happened, impact, resolution]

## Timeline

| Time | Event |
|------|-------|
| HH:MM | [Event description] |

## Root Cause Analysis

### What Happened
[Detailed explanation]

### Why It Wasn't Caught
[Why safeguards failed]

### Contributing Factors
[Systemic issues that enabled the incident]

## Impact Assessment

### Users Affected
[Who was impacted]

### Business Impact
[Consequences]

### Technical Debt Created
[Cleanup needed]

## What Went Well

1. [Positive aspect]

## What Went Wrong

1. [Issue to address]

## Action Items

### Immediate (Within 1 week)
- [ ] Action item

### Short-term (Within 1 month)
- [ ] Action item

### Long-term (Within 3 months)
- [ ] Action item

## Lessons Learned

### Technical Lessons
1. Lesson

### Process Lessons
1. Lesson

## Recommendations

[Specific changes to implement]

## Appendix

[Supporting information, code snippets, etc.]
```

## Questions?

For questions about incident reports or the blameless post-mortem process, contact the maintainers or open a discussion.

Remember: **The goal is learning and improvement, not blame.**

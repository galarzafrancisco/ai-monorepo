# Sources
We react to task events (reconcile just that task) or cron events (reconcile all tasks every X minutes).

# What to reconcile

A task can be in one fo the following status from the executor perspective:
```yaml
all_tasks:
- has_active_execution:
  - actually_running       # leave it alone, the worker is on it
  - stale                  # will be picked up and fixed by the stale fixer
- no_active_execution:
  - ready                  # reconcile!
  - not_ready              # not ready (either not assigned, or has dependencies not done, or has open questions, or the task itself is done)
```

# Eligibility rules

```yaml
- fetch all agents
- for each task:
  - agent = agents[task.assignee]     # could be null if assigned to a human, in which case, stop
  - agent.concurrency > count of active executions for this agent
  - task.status in agent.status_triggers
  - at least one of task.tags in agent.tag_triggers
```

# After running the elegibility rules
- if it passed, upsert the task in the queue
- if it didn't, check if there is an entry for this task and if so delete it

# Big SQL filters
We can do some high level filters on SQL to return a subset of relevant tasks:
- select * where status != done (we don't care about done tasks, that's the only status we ignore) and assignee != null (tasks must be assigned)
- join with executions table and reject rows that have an active execution
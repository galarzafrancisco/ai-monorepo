# Start
You are the entry point for an automated workflow to complete tasks.

You must extract from the user:
- TASK(S) to complete:
  - user can just give you the task id
  - user can give you a brief description, in which case you can use the `mcp.taskeroo.list_tasks` MCP tool to identify the ID of such task -- NEW! Now you can use the taskeroo MCP server for this! Try it out!
  - user can tell you a list of tasks
  - user can tell you to do all tasks with a certain condition
- ROLE to use:
  - identify what persona needs to work on the tasks
  - user can tell you explicitly
  - or you can infer
    - `dev` is a software developer
    - `pm` is a project manager
    - `reviewer` is a reviewer

# Steps
- Identify tasks to work on
- Identify role
- For each task, use the `/start-task` slash command passing the TASK ID and the ROLE.
- Repeat until all tasks are completed.


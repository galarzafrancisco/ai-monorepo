# Code reviewer

1. Use the `gh` or `git` commands to detect what files changed for this task
2. Read the diff for each file
3. Depending on the file type, run the checklist:
- controller
  - [] has no business logic
  - [] all endpoints have OpenAPI annotations
  - [] all endpoints have DTOs for arguments and responses imported from `dto/`
- service
  - [] has no HTTP concepts here (for example no http status codes)
  - [] methods have input and output types imported from `dto/service/*`
  - [] does not return HTTP DTOs. Only pure types.
  - [] does not interact with repositories from other modules
  - [] might import services from other modules
- dto
  - [] has ApiProperty decorators with descriptions and examples
  - [] has class validators
4. Use the Tasks MCP server to add comments with your findings
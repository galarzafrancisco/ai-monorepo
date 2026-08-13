# Use Case Review Guide

- Each command that creates, updates, deletes, or transitions persistent business state is implemented by a named use case.
- Each transport handler that invokes a business command delegates the command to its use case.
- No controller, MCP handler, gateway, or scheduler coordinates writes through more than one repository or domain service.
- Each use case identifies the business invariant it enforces.
- Each command that spans more than one repository or domain service is coordinated by its use case.
- No domain service coordinates a command across more than one repository or domain service.

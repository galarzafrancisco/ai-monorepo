# Artefacts

To consider this project done, I need to create the following artefacts.
Each one of the artefacts will be consumed by a person/ai and serve as a guide.
I will need to create an artefact per domain.

# Domains
- controllers: NestJS controllers (API layer)
- modules: NestJS domain encapsulation
- services: NestJS business logic, implemented as a provider
- DTO: Data transport object - akin to an api contract
- entity: a database object / table
- error: response outside the happy path. Some can be predicted and some are unexpected.

# Artefacts

## Best practices
### Goal
A consolidation of what the quality bar is for a given thing.
Think of it as a senior engineer's brain.
Everything else will be derived from here.
### Content
- rules -- for example:
  - module x cannot interact directly with data from module y - it must doing by a service

## How-to-create guide
### Goal
A developer will follow this guide to create code of a specific domain.
It implements the best practices in a more concrete way (like this is exactly how we crate the thing).
### Content
- any commands needed to create the thing
- naming convention for files
- expected location of files
- naming convention for classes / methods / objects
- rules -- for example:
  - class x must be annotated with y decorator
- examples

## Review list
### Goal
A reviewer will follow this list to review code.
### Content
- checklist like


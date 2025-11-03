# Goals

The reason this project exists is not to create an application, but to learn how to create applications.

- Understand error handling across layers
  - database to service (straight forward)
  - service to controller (within the app boundary)
  - controller to client (backend to UI)
  - how do I define standard error codes?
  - how do I map errors between business logic and API/controller layer?
  - how do I share errors across apps so that the caller can understand and parse the payload?
- Understand testing
  - injection pattern?
  - mock services?
  - how do we test modules?
  - how do we test the whole thing?
- Understand types / DTO / interfaces / schemas
  - where is the best place to define database entities?
  - where is the best place to define types of objects I will handle in the application? They might be related to entities
  - how do I define interfaces for endpoints?
  - how do I document my API automatically?
  - what is the best way to do all of the above without repetition?
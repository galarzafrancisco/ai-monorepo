# Requirements

Since this is a pet project, let's build a vet booking system.

## Functional requirements
Not so important since this is a demo app just to learn. But here you go:
- Nothing is authenticated for simplicity.
- Client view and Admin view.
### Home page
- Presents an option to login as a client or as an admin
### Client view
- Create account:
  - User can create an account with super basic info: Name. Will create an entry in the database and get a client ID.
- Login:
  - Dumb view with a list of clients.
  - User can click one to simulate a login.
  - Browser will keep the selected client in cookie/storage/session
- Dashboard:
  - Can register pets with super basic info: Name.
  - Can see a list of upcoming appointments.
  - Can create an appointment, selecting a time and a pet.
  - Can see a list of pets.
  - Can cancel an appointment.
  - Can delete a pet.
- Logout:
  - Clear and go back to home page
### Admin view
- Can see a list of upcoming appointments with client name and pet and any notes they left.

## Technical requirements
- Monorepo style
  - ./apps for apps
  - ./packages for shared types, etc
- sqlite as the store
- simple node, we can't use bun
- backend api in NestJS under ./apps/backend
  - typeorm for db
  - swagger spec auto generated
  - all requests/responses are typed with clear documentation
  - all errors are typed
- ui in react and typescript under ./apps/ui
- monorepo users workspaces
- can start all apps from a single npm command
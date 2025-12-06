export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Session {
  user: User;
}

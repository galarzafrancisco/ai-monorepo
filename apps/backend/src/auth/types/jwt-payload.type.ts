export interface WebAuthJwtPayload {
  sub: string; // User ID
  email: string;
  role: 'admin' | 'standard';
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

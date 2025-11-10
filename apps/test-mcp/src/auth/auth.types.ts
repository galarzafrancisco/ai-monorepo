export type AuthContext = {
  // sub: string;
  token: string;
  // scopes: string[];
};

// // If using Express:
// declare module 'express-serve-static-core' {
//   interface Request {
//     auth?: AuthContext;
//   }
// }
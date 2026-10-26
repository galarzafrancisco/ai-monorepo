/** join.taico.app serves /join at its root. */
export const isJoinHost = () =>
  typeof window !== 'undefined' && window.location.hostname.startsWith('join.');

export const isPublicPath = (pathname: string) =>
  pathname === '/join' || pathname === '/marketing' || (isJoinHost() && pathname === '/');


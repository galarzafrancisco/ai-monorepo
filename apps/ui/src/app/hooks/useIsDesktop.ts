import { useMediaQuery } from "./useMediaQuery";

export function useIsDesktop(): boolean {
  // Pick your breakpoint once and treat it as a product decision.
  return useMediaQuery("(min-width: 768px)");
}

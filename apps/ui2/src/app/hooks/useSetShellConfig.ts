// useSetShellConfig.ts
import { useEffect, useMemo, useRef } from "react";
import type { ShellConfigPatch } from "../shells/shell.types";
import { useShellConfigActions } from "../providers/ShellConfigProvider";

export function useSetShellConfig(patch: ShellConfigPatch) {
  const { pushPatch, popPatch, updatePatch } = useShellConfigActions();
  const tokenRef = useRef<symbol | null>(null);

  const stablePatch = useMemo(() => patch, [
    patch.appTitle,
    patch.sectionTitle,
    patch.navItems,
  ]);

  useEffect(() => {
    const token = pushPatch(stablePatch);
    tokenRef.current = token;

    return () => {
      popPatch(token);
      tokenRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    updatePatch(token, stablePatch);
  }, [stablePatch, updatePatch]);
}

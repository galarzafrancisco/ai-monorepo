// ShellConfigProvider.tsx
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ShellConfig, ShellConfigPatch } from "../shells/shell.types";
import { DEFAULT_SHELL_CONFIG } from "../shells/shell.types";

type ShellToken = symbol;

interface ShellConfigContextValue {
  /** Current effective config (merged from the whole stack) */
  config: ShellConfig;

  /** Push a patch; returns a token you must pop later */
  pushPatch: (patch: ShellConfigPatch) => ShellToken;

  /** Pop a previously pushed patch */
  popPatch: (token: ShellToken) => void;

  /** Replace the patch for an existing token */
  updatePatch: (token: ShellToken, patch: ShellConfigPatch) => void;

  /** (Optional) convenience: reset stack back to root patch */
  resetToRoot?: () => void;
}

const ShellConfigContext = createContext<ShellConfigContextValue | null>(null);

export function ShellConfigProvider(props: {
  children: React.ReactNode;
  /** Root patch applied at the bottom of the stack */
  initialConfig?: ShellConfigPatch;
}) {
  const rootPatch: ShellConfigPatch = props.initialConfig ?? DEFAULT_SHELL_CONFIG;

  type StackEntry = { token: ShellToken; patch: ShellConfigPatch };

  // Stack lives in a ref so callbacks don't reallocate arrays.
  // Root entry is always present.
  const stackRef = useRef<StackEntry[]>([
    { token: Symbol("shell-root"), patch: rootPatch },
  ]);

  const mergeStack = useCallback((): ShellConfig => {
    // Start from DEFAULT_SHELL_CONFIG so all fields always exist.
    // Then apply root patch + any subsequent patches.
    return stackRef.current.reduce<ShellConfig>(
      (acc, entry) => ({ ...acc, ...entry.patch }),
      DEFAULT_SHELL_CONFIG
    );
  }, []);

  const [config, setConfig] = useState<ShellConfig>(() => mergeStack());

  const recompute = useCallback(() => {
    setConfig(mergeStack());
  }, [mergeStack]);

  const pushPatch = useCallback(
    (patch: ShellConfigPatch) => {
      const token: ShellToken = Symbol("shell-patch");
      stackRef.current.push({ token, patch });
      recompute();
      return token;
    },
    [recompute]
  );

  const popPatch = useCallback(
    (token: ShellToken) => {
      // Never remove the root entry
      const idx = stackRef.current.findIndex((x) => x.token === token);
      if (idx <= 0) return;
      stackRef.current.splice(idx, 1);
      recompute();
    },
    [recompute]
  );

  const updatePatch = useCallback(
    (token: ShellToken, patch: ShellConfigPatch) => {
      const idx = stackRef.current.findIndex((x) => x.token === token);
      if (idx === -1) return;

      // Root patch update is allowed (idx === 0)
      stackRef.current[idx] = { token, patch };

      // Any patch change can affect the merged output, recompute always.
      recompute();
    },
    [recompute]
  );

  const resetToRoot = useCallback(() => {
    const root = stackRef.current[0];
    stackRef.current = root ? [root] : [{ token: Symbol("shell-root"), patch: rootPatch }];
    recompute();
  }, [recompute, rootPatch]);

  const value = useMemo<ShellConfigContextValue>(
    () => ({
      config,
      pushPatch,
      popPatch,
      updatePatch,
      resetToRoot,
    }),
    [config, pushPatch, popPatch, updatePatch, resetToRoot]
  );

  return (
    <ShellConfigContext.Provider value={value}>
      {props.children}
    </ShellConfigContext.Provider>
  );
}

export function useShellConfig(): ShellConfig {
  const ctx = useContext(ShellConfigContext);
  if (!ctx) throw new Error("useShellConfig must be used within ShellConfigProvider");
  return ctx.config;
}

export function useShellConfigActions() {
  const ctx = useContext(ShellConfigContext);
  if (!ctx) throw new Error("useShellConfigActions must be used within ShellConfigProvider");
  return {
    pushPatch: ctx.pushPatch,
    popPatch: ctx.popPatch,
    updatePatch: ctx.updatePatch,
    resetToRoot: ctx.resetToRoot,
  };
}
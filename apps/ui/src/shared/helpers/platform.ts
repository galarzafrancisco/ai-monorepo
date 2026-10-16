type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

/**
 * True when running on an Apple platform (macOS, iOS, iPadOS), where
 * keyboard shortcuts use ⌘ instead of Ctrl.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithUAData;
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Label for the primary shortcut modifier: "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function modifierKeyLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl';
}

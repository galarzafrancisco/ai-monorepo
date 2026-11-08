import { WebAuthenticationService } from './api';

/**
 * Switches the web session to another workspace, then reloads the page.
 *
 * Every provider, cache and socket in the app was loaded with the old
 * session's workspace, so a full reload is the one way to be sure nothing
 * from it is left on screen. `path` is where to land: the same page when
 * following a link into that workspace, home otherwise.
 */
export async function switchWorkspaceAndReload(workspaceId: string, path = '/home'): Promise<void> {
  await WebAuthenticationService.webAuthControllerSwitchWorkspace({ workspaceId });
  window.location.assign(path);
}

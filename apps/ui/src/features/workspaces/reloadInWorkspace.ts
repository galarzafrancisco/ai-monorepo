import { WebAuthenticationService } from './api';
import { announceWorkspaceSwitch } from './workspaceSession';

/**
 * Switches the web session to another workspace, then reloads the page.
 *
 * Every provider, cache and socket in the app was loaded with the old
 * session's workspace, so a full reload is the one way to be sure nothing
 * from it is left on screen. Drafts are kept per workspace, so the reload
 * doesn't bring the old workspace's drafts along. The session cookies are
 * shared by every tab, so the other tabs are told to reload too (see
 * `workspaceSession`). `path` is where to land: the same page when following
 * a link into that workspace, home otherwise.
 */
export async function switchWorkspaceAndReload(workspaceId: string, path = '/home'): Promise<void> {
  await WebAuthenticationService.webAuthControllerSwitchWorkspace({ workspaceId });
  announceWorkspaceSwitch(workspaceId);
  window.location.assign(path);
}

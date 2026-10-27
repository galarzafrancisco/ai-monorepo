import { Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useIsDesktop } from "../../app/hooks/useIsDesktop";
import { DesktopShell } from "../../app/shells/DesktopShell";
import { IosShell } from "../../app/shells/IosShell";
import { Button } from "../../ui/primitives";
import { useAgentsCtx } from "./AgentsProvider";

export function AgentsLayout(): React.JSX.Element {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { sectionTitle } = useAgentsCtx();

  // No navigation items for agents since it's a simple list + detail view
  const navItems: { path: string; label: string; icon: string }[] = [];

  const isList = matchPath('/agents', pathname) !== null;
  const detailMatch = matchPath('/agents/agent/:slug', pathname);
  const toolsMatch = matchPath('/agents/agent/:slug/tools', pathname);
  const isWizard = matchPath('/agents/new', pathname) !== null;

  const back = toolsMatch
    ? { label: 'Agent', path: `/agents/agent/${toolsMatch.params.slug}` }
    : detailMatch || isWizard
      ? { label: 'Agents', path: '/agents' }
      : undefined;

  return (
    <div style={{ minHeight: 0 }}>
      {isDesktop ?
        <DesktopShell
          // Agent pages draw their own header with a breadcrumb
          sectionTitle={detailMatch || toolsMatch ? undefined : sectionTitle}
          headerActions={isList ? (
            <Button onClick={() => navigate('/agents/new')}>
              <Plus size={16} aria-hidden />
              New agent
            </Button>
          ) : undefined}
        >
          <Outlet />
        </DesktopShell>
        :
        <IosShell
          appTitle="Agents"
          sectionTitle={sectionTitle}
          navItems={navItems}
          back={back}
        >
          <Outlet />
        </IosShell>}
    </div>
  );
}

import { useState } from "react";
import { Outlet } from "react-router-dom";
import NavSidebar from "../components/NavSidebar";
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIDEBAR_BACKGROUND = "bg-[#0b1220]";
const MAIN_BACKGROUND = "bg-gradient-to-br from-[#0b1220] to-[#0e0f19]";
const TEXT_COLOR = "text-white";

export default function ShellWithNavSidebarLayout() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const sidebarWidth = navCollapsed ? 'w-16' : 'w-48';

  return (
    <div className={`h-screen w-screen flex ${TEXT_COLOR}`}>
      <aside
        className={`${sidebarWidth} flex flex-col ${SIDEBAR_BACKGROUND} transition-all duration-300 border-r border-white/10`}
      >
        <nav className="flex-1 overflow-y-auto space-y-2">
          <NavSidebar collapsed={navCollapsed} />
        </nav>

        <button
          className="flex items-center justify-center px-0 py-0 border-t border-slate-700 hover:bg-slate-700"
          onClick={() => setNavCollapsed(!navCollapsed)}
          aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {navCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      <main className={`flex flex-col flex-1 ${MAIN_BACKGROUND}`}>
        <Outlet />
      </main>
    </div>
  );
}

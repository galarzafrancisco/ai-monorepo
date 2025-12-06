import {
  Home,
  Compass,
  DoorOpen,
  Bot,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface Props {
  collapsed: boolean;
}

export default function NavSidebar({ collapsed }: Props) {
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-4 py-2 mt-2 rounded-md text-sm transition-colors",
      isActive ? "bg-white/10 !text-white" : "hover:bg-white/5 !text-slate-300",
      collapsed ? "justify-center" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div>
      {!collapsed && (
        <div>
          <div className="pt-4 px-4 text-2xl font-semibold tracking-wide bg-gradient-to-r from-sky-400 to-teal-300 bg-clip-text text-transparent drop-shadow-sm">
            MCP Portal
          </div>
          <div className="my-3 border-t border-white/10" />
        </div>
      )}

      <div className="px-2">
        <NavLink to="/home" className={linkCls}>
          <Home size={16} />
          {!collapsed && <span>Home</span>}
        </NavLink>
        <NavLink to="/catalog" className={linkCls}>
          <Compass size={16} />
          {!collapsed && <span>Catalog</span>}
        </NavLink>
        <NavLink to="/agents" className={linkCls}>
          <Bot size={16} />
          {!collapsed && <span>Agents</span>}
        </NavLink>
        <NavLink to="/taskeroo" className={linkCls}>
          <CheckSquare size={16} />
          {!collapsed && <span>Taskeroo</span>}
        </NavLink>
        <NavLink to="/wikiroo" className={linkCls}>
          <BookOpen size={16} />
          {!collapsed && <span>Wikiroo</span>}
        </NavLink>
      </div>

      <div className="my-3 border-t border-white/10" />

      <div className="px-2">
        <NavLink to="/logout" className={linkCls}>
          <DoorOpen size={16} />
          {!collapsed && <span>Logout</span>}
        </NavLink>
      </div>
      <div className="my-3 border-t border-white/10" />
    </div>
  );
}

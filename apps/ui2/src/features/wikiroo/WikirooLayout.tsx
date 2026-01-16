import { Outlet } from "react-router-dom";

export function WikirooLayout(): JSX.Element {
  return (
    <div className="wikiroo-layout">
      <Outlet />
    </div>
  );
}
import type { NavegationItem } from "../types/NavegationItem";

interface NavigationIconProps {
  icon: NavegationItem['icon'];
  className: string;
  size?: number;
}

export function NavigationIcon({ icon, className, size = 22 }: NavigationIconProps): React.JSX.Element {
  if (typeof icon === 'string') {
    return <span className={className}>{icon}</span>;
  }

  const Icon = icon;
  return <Icon className={className} size={size} strokeWidth={1.5} absoluteStrokeWidth />;
}

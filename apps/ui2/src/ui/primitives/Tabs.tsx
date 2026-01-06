import { Link, useLocation } from 'react-router-dom';
import './Tabs.css';

export interface TabItem {
  path: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  items: TabItem[];
  className?: string;
}

export function Tabs({ items, className = '' }: TabsProps) {
  const location = useLocation();

  return (
    <div className={`tabs ${className}`} data-component="tabs">
      {items.map((item) => {
        const isActive = location.pathname === item.path ||
                        location.pathname.startsWith(item.path + '/');

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`tabs__item ${isActive ? 'tabs__item--active' : ''}`}
          >
            {item.icon && <span className="tabs__icon">{item.icon}</span>}
            <span className="tabs__label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

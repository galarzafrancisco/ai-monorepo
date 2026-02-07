import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from 'react-router-dom';
import "./IosShell.css";
import { Row, Text } from "../../ui/primitives";
import { NavegationItem } from "../../shared/types/NavegationItem";
import { MAIN_NAVEGATION_ITEMS } from "../../shared/const/mainNavegationItems";

export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

export interface IosShellProps {
  appTitle: string;
  sectionTitle: string;
  children: ReactNode;
  navItems: NavegationItem[];
}

function BottomNavContent({
  navItems,
  activePath,
  onActiveItemClick,
}: {
  navItems: NavegationItem[];
  activePath: string;
  onActiveItemClick: () => void;
}): JSX.Element {
  console.log('Rendering BottomNavContent with navItems:', navItems);
  if (navItems.length === 0) {
    return <></>;
  }
  return (
    <Row spacing="1" justify="space-between">
      {navItems.map((item, idx) => {
        const isActive = activePath === item.path;
        return (
          <Link
            key={item.label}
            to={item.path}
            className={`ios-shell__bottom-nav__item ${isActive ? 'ios-shell__bottom-nav__item--active' : ''}`}
            onClick={() => {
              if (isActive) {
                onActiveItemClick();
              }
            }}
          >
            <span className="ios-shell__bottom-nav__icon">{item.icon}</span>
            <Text size="1" className="ios-shell__bottom-nav-label">
              {item.label}
            </Text>
          </Link>
        )
      })}      
    </Row>
  )
}

export function IosShell(props: IosShellProps): JSX.Element {

  const location = useLocation();
  console.log('Mounting iOS shell')

  // Side bar
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  // Scroll effects
  const [sectionTitleVisible, setSectionTitleVisible] = useState(true);
  const [contentBehindHeader, setContentBehindHeader] = useState(true);
  const [contentBehindBottomNav, setContentBehindBottomNav] = useState(true);

  // Main
  // Reference to the scrollable main container (needed as root for IntersectionObserver)
  const mainRefEl = useRef<HTMLElement | null>(null);
  const mainRef = (el: HTMLDivElement | null) => {
    mainRefEl.current = el;
    detectContentBehindHeader();
    detectSectionTitleVisibility();
    detectContentBehindBottomNav();
  }

  // Top of the section title
  const mainSectionTitleTopSentinelRefEl = useRef<HTMLDivElement | null>(null);
  const mainSectionTitleTopSentinelRef = (el: HTMLDivElement | null) => {
    mainSectionTitleTopSentinelRefEl.current = el;
    detectContentBehindHeader();
  };
  const contentBehindHeaderObserverRef = useRef<IntersectionObserver | null>(null);

  // Bottom of the section title
  const mainSectionTitleBottomSentinelRefEl = useRef<HTMLDivElement | null>(null);
  const mainSectionTitleBottomSentinelRef = (el: HTMLDivElement | null) => {
    mainSectionTitleBottomSentinelRefEl.current = el;
    detectSectionTitleVisibility();
  };
  const sectionTitleVisibilityObserverRef = useRef<IntersectionObserver | null>(null);

  // Bottom of the main content
  const mainBottomSentinelRefEl = useRef<HTMLDivElement | null>(null);
  const mainBottomSentinelRef = (el: HTMLDivElement | null) => {
    mainBottomSentinelRefEl.current = el;
    detectContentBehindBottomNav();
  };
  const contentBehindBottomNavObserverRef = useRef<IntersectionObserver | null>(null);


  const detector = (detectorRef: React.RefObject<IntersectionObserver | null>, elementRef: React.RefObject<HTMLDivElement | null>, onIntersecting: (visible: boolean) => void) => {
    const sentinel = elementRef.current;
    const root = mainRefEl.current;
    if (!sentinel || !root) return;

    detectorRef.current?.disconnect();
    detectorRef.current = new IntersectionObserver(
      ([entry]) => {
        onIntersecting(entry.isIntersecting);
      },
      {
        root, // Use the scrollable main container as the root
        threshold: [0, 1],
      }
    );
    detectorRef.current.observe(sentinel);
  }

  const detectSectionTitleVisibility = () => {
    detector(
      sectionTitleVisibilityObserverRef,
      mainSectionTitleBottomSentinelRefEl,
      (x) => {
        console.log(`title visibility detector: ${x}`);
        setSectionTitleVisible(x);
      },
    )
  }

  const detectContentBehindHeader = () => {
    detector(
      contentBehindHeaderObserverRef,
      mainSectionTitleTopSentinelRefEl,
      (x) => {
        console.log(`content behind header detector: ${x}`);
        setContentBehindHeader(!x);
      },
    )
  }

  const detectContentBehindBottomNav = () => {
    detector(
      contentBehindBottomNavObserverRef,
      mainBottomSentinelRefEl,
      (x) => {
        console.log(`bottom detector: ${x}`);
        setContentBehindBottomNav(!x);
      },
    )
  }

  const scrollMainToTop = () => {
    mainRefEl.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Initialize observers after mount (when mainRef is available)
  useEffect(() => {
    // detectSectionTitleVisibility();
    // detectContentBehindHeader();
    // detectContentBehindBottomNav();

    // Clean up all the observers on unmount
    return () => {
      sectionTitleVisibilityObserverRef.current?.disconnect();
      contentBehindHeaderObserverRef.current?.disconnect();
      contentBehindBottomNavObserverRef.current?.disconnect();
    }
  }, []);

  return (
    <div className="ios-shell">

      {/* Drawer */}
      <aside className={`ios-shell__drawer ${isDrawerOpen ? 'ios-shell__drawer--open' : ''}`}>
        <div className="ios-shell__drawer-header">
          <Text size="4" weight="bold">taico</Text>
          <button
            className="ios-shell__drawer-close"
            onClick={handleDrawerClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="ios-shell__drawer-nav">
          {MAIN_NAVEGATION_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`ios-shell__drawer-item ${isActive ? 'ios-shell__drawer-item--active' : ''}`}
                onClick={handleDrawerClose}
              >
                <span className="ios-shell__drawer-icon">{item.icon}</span>
                <span className="ios-shell__drawer-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Header */}
      <header
        // ref={headerRef}
        className={`ios-shell__header ${contentBehindHeader ? 'elevated' : ''}`}>
        <Row spacing="5" align="center">
          <button
            className="ios-shell__hamburger"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <Text size="3" weight="normal" as="div">
            {props.appTitle}
          </Text>
          <div className={`ios-shell__header__section-title ${sectionTitleVisible ? 'is-hidden' : 'is-visible'}`}>
            {props.sectionTitle}
          </div>
        </Row>
      </header>

      {/* Main content */}
      <main ref={mainRef} className="ios-shell__main">
        <div className="ios-shell__main__top-padding" />
        <div ref={mainSectionTitleTopSentinelRef} className="ios-shell__main__section-title-top-sentinel" />
        <div className={`ios-shell__main__section-title ${sectionTitleVisible ? 'is-visible' : 'is-hidden'}`}>
          {/* <Text size="6" weight="semibold" as="div"> */}
          {props.sectionTitle}
          {/* </Text> */}
        </div>
        <div ref={mainSectionTitleBottomSentinelRef} className="ios-shell__main__section-title-bottom-sentinel" />
        <div className="ios-shell__main__top-sentinel" />
        {props.children}
        <div ref={mainBottomSentinelRef} className="ios-shell__main__bottom-sentinel" />
        <div className="ios-shell__main__bottom-padding" />
      </main>

      {/* Bottom navigation */}
      <nav className={`ios-shell__bottom-nav ${contentBehindBottomNav ? 'elevated' : ''}`}>
        <BottomNavContent
          navItems={props.navItems}
          activePath={location.pathname}
          onActiveItemClick={scrollMainToTop}
        />
      </nav>

    </div>
  )
}

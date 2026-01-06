# UI2 - React SPA Foundation

A modern React single-page application built with a strong, scalable foundation that supports both desktop and mobile experiences in a single codebase.

## Architecture

This app follows a layered architecture with strict boundaries:

```
src/
├── app/          # Application composition layer
│   ├── shells/   # Desktop & Mobile shells (layout chrome)
│   ├── providers/# Theme provider & other contexts
│   ├── pages/    # Route pages (thin compositions)
│   └── App.tsx   # Main app component with routing
├── ui/           # UI foundations (primitives & tokens)
│   ├── primitives/ # Reusable building blocks
│   └── styles/   # Design tokens & base styles
├── features/     # Domain-specific features
│   └── taskeroo/ # Task management feature
└── shared/       # Shared utilities (future: generated clients)
```

### Architectural Rules

- **ui/** must not import from **features/**
- **features/** may import from **ui/**
- **app/** composes everything
- Pages are thin compositions; primitives define UI; tokens control appearance

## Getting Started

### Installation

```bash
npm install
```

### Running the App

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### Building for Production

```bash
npm run build
```

## Theming

The app supports multiple themes via a token-driven system:

- **light** (default)
- **dark**
- **github** (light variant with GitHub branding)
- **forest** (dark green nature theme)

### How Theming Works

1. **Design tokens** are defined in `src/ui/styles/tokens.css` as CSS variables
2. Themes are switched by setting `data-theme` attribute on the `<html>` element
3. The `ThemeProvider` manages theme state and persists it to localStorage
4. Components reference tokens (e.g., `var(--accent)`) instead of raw colors

### Adding a New Theme

1. Add a new `[data-theme='your-theme']` block in `tokens.css`
2. Override the token values for your theme
3. Update the `Theme` type in `ThemeProvider.tsx`
4. Add a button in the HomePage theme switcher

### Token Categories

**Colors:**
- Surface: `--bg`, `--surface`, `--surface-2`
- Text: `--text`, `--text-muted`, `--text-inverse`
- Borders: `--border`, `--border-subtle`
- Interactive: `--accent`, `--accent-contrast`, `--accent-hover`
- Semantic: `--success`, `--warning`, `--danger`
- Focus: `--focus-ring`

**Spacing:** `--space-1` through `--space-8` (4px to 64px scale)

**Border Radius:** `--r-1` through `--r-4`

**Typography:**
- Font families: `--font-sans`, `--font-mono`
- Font sizes: `--fs-1` through `--fs-6`
- Line heights: `--lh-tight`, `--lh-normal`, `--lh-relaxed`
- Font weights: `--fw-normal`, `--fw-medium`, `--fw-semibold`, `--fw-bold`

**Shadows:** `--shadow-1` through `--shadow-3`

## UI Primitives

The app includes a minimal set of primitives for building UI:

- **Stack** - Vertical layout with configurable spacing and alignment
- **Row** - Horizontal layout with configurable spacing, alignment, and justification
- **Text** - Typography with size, weight, and tone variants
- **Button** - Interactive button with variant and size options
- **Card** - Surface container with configurable padding
- **Divider** - Horizontal rule with spacing control
- **ListRow** - GitHub-style row container for lists

All primitives use design tokens exclusively.

## Desktop + Mobile Strategy

The app uses a **single routing tree** with two shell implementations:

- **DesktopShell** - Sidebar navigation (visible on screens ≥ 769px)
- **MobileShell** - Top bar + bottom tab navigation (visible on screens ≤ 768px)

Both shells render the same route content. The shell is responsible for layout chrome; pages render inside either shell without modification.

### Responsiveness

- **CSS-first**: Layout changes use media queries
- **JS sparingly**: Viewport checks only for behavioral differences (use sparingly)

### iOS Pinned Mode

The app supports being pinned as a home-screen shortcut on iOS:

- Safe area insets are handled via `env(safe-area-inset-*)` in MobileShell
- Apple mobile web app meta tags are set in `index.html`

## Routes

- `/` - Home page with navigation links and theme switcher
- `/taskeroo` - Task management page (with placeholder data)
- `/wikiroo` - Wiki page (placeholder)
- `/mcp-registry` - MCP Registry page (placeholder)
- `/agents` - Agents page (placeholder)
- `/logout` - Logout page (placeholder)

## Backend Integration

This scaffold does not include backend calls. Future integration will use:

- **No fetch/axios**: All backend interaction via auto-generated clients
- **Auth via cookie**: Frontend relies on cookies set by backend
- **Client location**: Generated clients consumed in feature data layers

## Development Guidelines

### Adding New UI

1. **Use primitives first** - Build from existing primitives before creating custom styles
2. **Use tokens only** - No hardcoded colors, spacing, or border radius values
3. **CSS-first responsive** - Use media queries for layout changes
4. **Semantic variants** - Use `tone="danger"` not `color="red"`

### Code Quality Rules

- No raw colors outside token files (use `var(--accent)` not `#0969da`)
- No hardcoded spacing (use `var(--space-4)` not `16px`)
- No theme conditionals in components (use token overrides)
- No manual API calls (use generated clients when wired)

### Review Checklist

Before merging UI changes, verify:

- [ ] Tokens are used (no magic colors/spaces)
- [ ] Works across all themes
- [ ] Mobile behavior is correct
- [ ] Primitives-first composition
- [ ] Accessibility covered (focus, keyboard)
- [ ] Loading/empty/error states handled (if applicable)

See `docs/ui/review.md` for full checklist.

## Technology Stack

- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **CSS Variables** - Theming system

No CSS-in-JS, no UI framework dependencies - just modern CSS and React.

## License

[Your license here]

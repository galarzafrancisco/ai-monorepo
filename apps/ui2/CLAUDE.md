# UI Development Guide (apps/ui2)

## Styling Rules

**Never invent colors.** Always reference CSS variables from `src/ui/styles/tokens.css`:
- Background: `--bg`, `--surface`, `--app-surface`, `--card-bg`
- Text: `--text`, `--text-muted`, `--text-inverse`
- Borders: `--border`, `--border-subtle`
- Interactive: `--accent`, `--accent-hover`, `--accent-contrast`
- Semantic: `--success`, `--warning`, `--danger`
- Spacing: `--space-1` through `--space-8`
- Radius: `--r-1` through `--r-4`
- Typography: `--fs-1` through `--fs-6`, `--fw-normal/medium/semibold/bold`

These tokens react to theme changes automatically.

## Primitives

Reuse existing primitives from `src/ui/primitives/`:
- Layout: `Stack`, `Row`, `Card`, `Divider`
- Typography: `Text`, `ErrorText`
- Interactive: `Button`, `Chip`, `Tabs`
- Data display: `ListRow`, `DataRow`, `DataRowContainer`, `BoardCard`, `Avatar`

If you need a new primitive, create it in `src/ui/primitives/` with its own CSS file referencing tokens.

## Shell Pattern

The app uses responsive shells in `src/app/shells/`:
- **Desktop**: `DesktopShell` - collapsible sidebar navigation
- **Mobile**: `IosShell` - iOS-like header, footer nav, and drawer sidebar

Layouts use `useIsDesktop()` hook to render the appropriate shell.

## Feature Pattern

Each feature in `src/features/` follows this structure:

```
features/<name>/
├── api.ts              # Re-exports auto-generated API client from 'shared'
├── types.ts            # Local type definitions
├── use<Name>.ts        # Hook: API calls, WebSocket setup, state management
├── <Name>Provider.tsx  # Context provider wrapping the hook
├── <Name>Layout.tsx    # Shell wrapper (desktop/mobile), uses Provider context
├── <Name>Routes.tsx    # Route definitions
├── <Name>Page.tsx      # Page components
└── *.css               # Component styles (reference tokens.css)
```

**Key pattern**:
1. `api.ts` imports auto-generated services from `shared` package
2. `use<Name>.ts` hook handles data fetching, WebSocket events, and mutations
3. `<Name>Provider.tsx` wraps the hook in React context, consumed via `use<Name>Ctx()`
4. `<Name>Layout.tsx` selects shell based on viewport and renders `<Outlet />`

## Data Consumption

Always use the auto-generated API client from the `shared` package. Run `npm run zero-to-prod` from the repo root to regenerate types after backend changes.

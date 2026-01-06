# UI Architecture & Style Guidelines (React SPA: Desktop + Mobile)

This document defines **principles** and **architectural decisions** for any React single-page application that supports both **desktop** and **mobile** (including “pinned” iOS home-screen usage). It is designed to keep the codebase consistent as it scales and to prevent styling fragmentation.

---

## 0) Non-goals

- This is **not** a step-by-step “create an app with X” guide.
- This document avoids framework-specific tooling debates unless they affect architecture.
- No “quick hacks” that trade short-term speed for long-term inconsistency.

---

## 1) Core principles

### 1.1 One product, one design system
- The desktop and mobile experiences are **variants of the same product**, not separate apps.
- We do not fork route trees or duplicate page logic for mobile vs desktop.

### 1.2 Adapt layout, not the app
- Desktop vs mobile differences should primarily be expressed through:
  - responsive CSS (layout and visibility)
  - shell-level chrome changes (navigation, safe area handling)
- JavaScript screen-size checks are used only for true **behavioral differences** (e.g., “side panel vs modal sheet”).

### 1.3 Design tokens over raw values
- Components must not hardcode “random colors” or “magic spacing”.
- Styling must use **semantic design tokens** (CSS variables) such as:
  - `--bg`, `--surface`, `--text`, `--border`, `--accent`, etc.
- Themes are implemented by overriding tokens, not rewriting component CSS.

### 1.4 Consistency beats cleverness
- Prefer boring, explicit patterns that remain understandable after 6 months.
- Avoid highly dynamic styling approaches that make it hard to predict UI output.

### 1.5 Separation of concerns is mandatory
- Layout concerns live in shells and layout primitives.
- Domain logic lives in features.
- Visual foundations live in UI primitives and tokens.

---

## 2) Application architecture

### 2.1 Terminology

**Shell**
- The outer frame of the app: navigation, headers, sidebars, bottom tabs, safe-area padding.
- There may be multiple shells (e.g., DesktopShell and MobileShell) rendering the **same route content**.

**Page**
- A routed screen (the output of a route), responsible for composing feature components.

**Feature**
- A domain module (e.g., tasks, wiki, settings) that bundles UI + state + client usage related to that domain.

**UI Primitive**
- A small, reusable building block used everywhere (Button, Text, Stack, Card, etc.). Primitives are the “atoms” of the UI.

**Composite Component**
- A reusable piece of UI built from primitives (TaskRow, UserBadge, CommentList, etc.).

**Design Tokens**
- CSS variables that represent semantic meaning (surface, border, text) not raw colors.

---

## 3) Desktop + Mobile strategy

### 3.1 One router, route content stays the same
- Use a single routing tree for all platforms.
- The router renders “pages”.
- The shell wraps the router content.

### 3.2 Shell-driven responsive chrome
- The shell decides navigation patterns:
  - Desktop: sidebar / topbar / split panes where appropriate
  - Mobile: top bar + bottom tabs; content is typically single column
- Shells may differ in spacing and structure but must not duplicate domain logic.

### 3.3 CSS-first responsiveness
- Layout changes (grids, columns, spacing, hiding/showing) are done with CSS media queries.
- JS-based viewport detection is only allowed for:
  - interaction patterns: hover vs touch
  - modal vs side panel behavior
  - navigation presentation choices (rare)

### 3.4 iOS pinned “app mode”
- Treat pinned mode as a display environment:
  - safe-area insets handling
  - top chrome differences (no browser URL bar)
  - optional bottom tab navigation
- Do not fork app logic; pinned mode affects the shell and styling only.

---

## 4) Styling system

### 4.1 Source of truth: design tokens (CSS variables)
- All themes are driven via CSS variables.
- Tokens are defined at the root level:
  - `:root` for defaults
  - `[data-theme="..."]` for theme overrides
  - optional `[data-accent="..."]` if accent is configurable

**Rules**
- Components may not reference raw hex values or ad-hoc pixel spacing except inside the token definition layer.
- Token names must be semantic, not color-based.

### 4.2 Token categories (recommended)
**Color**
- `--bg`, `--surface`, `--surface-2`
- `--text`, `--text-muted`, `--text-inverse`
- `--border`, `--border-subtle`
- `--accent`, `--accent-contrast`
- `--success`, `--warning`, `--danger`
- `--focus-ring` (accessibility)

**Spacing**
- `--space-1`..`--space-8` (consistent scale)

**Radius**
- `--r-1`..`--r-4`

**Typography**
- `--font-sans`, `--font-mono`
- `--fs-1`..`--fs-6`
- `--lh-...` line heights
- `--fw-...` font weights

**Elevation**
- `--shadow-1`..`--shadow-3`

### 4.3 Theme structure
- Themes are named (e.g., `dark`, `light`, `github`, `forest`, `midnight`).
- Theme switch:
  - sets `data-theme` attribute on `html` (preferred) or `body`
- Never implement theming via per-component conditional classes (`isDark ? ...`), except in rare cases where tokens are insufficient.

### 4.4 Where styles live
**Global**
- `tokens.css` (design tokens for all themes)
- `base.css` (reset, typography defaults, global element styles)
- `utilities.css` (small, strictly controlled helpers if needed)

**UI primitives**
- Each primitive owns its styles. Primitives define:
  - spacing behavior
  - typography defaults
  - states (hover/focus/active/disabled)
  - variants via props (small set, consistent naming)

**Composite components**
- Minimal CSS allowed.
- Composites should mostly compose primitives and reuse their variants.

**Pages**
- Pages should have near-zero CSS.
- Pages compose feature components and primitives.

### 4.5 Banned practices
- “Random CSS in random component” without token usage
- Duplicated style definitions across components (copy/paste styling)
- Ad-hoc spacing values (`margin: 13px`)
- Hardcoded colors in component styles
- Per-page theme hacks

---

## 5) Component rules (React)

### 5.1 Primitives-first discipline
- New UI should be built from primitives before introducing new custom styles.
- If a composite component needs new styling primitives (e.g., “ListRow”), promote it into the primitive layer.

### 5.2 Controlled variants
- Components use **small variant sets** (e.g., size: `sm|md|lg`, tone: `default|muted|danger`).
- Avoid “prop explosion” (20 props for styling control).

### 5.3 Consistent interaction states
- All interactive components must implement:
  - focus-visible ring
  - disabled styling
  - keyboard accessibility by default
- Hover-only interactions must have touch equivalents where relevant.

### 5.4 Layout primitives
- Standardize layout using primitives:
  - `Stack` (vertical)
  - `Row` (horizontal)
  - `Grid`
- Reduce raw flexbox usage scattered across features/pages.

---

## 6) Data & backend interaction rules

### 6.1 Authentication
- Auth is handled via **cookie set by backend**.
- Frontend does not store auth tokens manually.
- Clients rely on cookies automatically.

### 6.2 No fetch / no handwritten API calls
- No direct `fetch`, `axios`, or manual request wiring in feature code.
- Backend interactions must go through **auto-generated client(s)** imported from shared packages.

### 6.3 Client usage location
- Generated clients are consumed in:
  - feature “data access” modules (e.g., `features/tasks/data/...`)
  - or dedicated “services” modules
- UI primitives never import backend clients.
- Components should not know transport details.

### 6.4 Error handling & UX
- Errors are handled consistently:
  - standardized error boundary for unexpected errors
  - feature-level error states for expected failures (403, 404, validation)
- UI must show clear states for:
  - loading
  - empty
  - error
  - partial results (if applicable)

---

## 7) Project structure principles

### 7.1 Feature-based organization
- Organize by domain feature, not by file type.
- Each feature contains its own:
  - components
  - state
  - data access (generated client usage)
  - route exports (if applicable)

### 7.2 UI layer ownership
- `ui/` contains primitives and foundations only.
- `features/` contains domain-specific UI and logic.
- `app/` contains composition: router, shells, providers.

### 7.3 Boundaries
- `ui/` must not depend on `features/`.
- `features/` may depend on `ui/`.
- `app/` composes everything.

---

## 8) Quality gates & enforcement

### 8.1 Linting / review rules (conceptual)
- No raw color values outside token files.
- No spacing outside the spacing scale.
- No feature code importing token files directly (they should just use variables).
- No handwritten API calls.
- Layout must use primitives for most composition.

### 8.2 “Consistency review” checklist
Before merging UI work:
- Are tokens used (no magic colors/spaces)?
- Is this a new pattern that should be a primitive?
- Is mobile behavior correct without duplicating app logic?
- Are states handled (loading/empty/error)?
- Is accessibility covered (focus, keyboard)?

---

## 9) Decision record (ADR-style short list)

- **Single router** for all platforms.
- **Shell** abstraction for desktop vs mobile chrome.
- **CSS variables** as design tokens and the source of truth for themes.
- **Multiple themes** supported via `[data-theme="..."]` token overrides.
- **No fetch / no manual API calls**; use shared generated clients only.
- **Auth via backend cookie**; clients rely on cookies automatically.
- **Feature-based structure** with strict UI primitives foundation.
- **CSS-first responsiveness**; JS media queries only for behavioral differences.

---

## 10) Working agreement: “How we avoid chaos”
- Every UI change either:
  - fits existing primitives and tokens, or
  - introduces a new primitive/token intentionally (not ad-hoc).
- Pages compose; primitives define; tokens control appearance.
- If in doubt: promote patterns downward (feature → component → primitive → token).

---

## 11) UI Change Review Guide (Mandatory Checklist)

This checklist is run **for every UI change** (human or AI-generated).
If multiple items fail, the change must be revised before merging.

The goal is **consistency, predictability, and long-term maintainability**.

---

### 11.1 Architectural correctness

- [ ] **No app forking**
  - No separate route trees for mobile vs desktop
  - No duplicated page logic

- [ ] **Shell responsibility respected**
  - Navigation, headers, sidebars, bottom tabs live in shells
  - Pages do not implement global layout or navigation chrome

- [ ] **Correct layer usage**
  - UI primitives do not import feature code
  - Features do not bypass primitives for styling
  - Pages mostly compose, not style

---

### 11.2 Design token usage (critical)

- [ ] **No raw colors**
  - ❌ `green`, `#10b981`, `rgb(...)`
  - ✅ `var(--accent)`, `var(--success)`, `var(--danger)`

- [ ] **Semantic intent is clear**
  - Component uses `accent`, `muted`, `danger`, etc.
  - Color choice communicates meaning, not aesthetics

- [ ] **No hardcoded spacing**
  - ❌ `margin: 13px`, `padding: 18px`
  - ✅ `var(--space-2)`, `var(--space-4)`

- [ ] **No hardcoded border radius**
  - ❌ `border-radius: 6px`
  - ✅ `var(--r-2)`

- [ ] **No theme-specific conditionals**
  - ❌ `if (isDark) { ... }`
  - ✅ token-driven styling via `[data-theme]`

---

### 11.3 Theme compatibility

- [ ] **Works across all themes**
  - No assumptions about light/dark contrast
  - Text remains readable in all themes

- [ ] **Theme overrides are token-based**
  - Themes override tokens, not component styles

- [ ] **Accent-safe**
  - UI works if accent color changes (green → blue → yellow)

---

### 11.4 Component design

- [ ] **Primitive-first approach**
  - Layout built using `Stack`, `Row`, `Grid`
  - New layout patterns promoted to primitives if reused

- [ ] **No prop explosion**
  - Components expose small, intentional variant sets
  - Styling is not controlled via many boolean props

- [ ] **Clear responsibility**
  - Component does one thing
  - No hidden side effects or cross-feature coupling

- [ ] **Variants use intent, not appearance**
  - ❌ `variant="green"`
  - ✅ `variant="accent"` / `tone="danger"`

---

### 11.5 Responsiveness & mobile behavior

- [ ] **CSS-first responsiveness**
  - Layout changes done via media queries
  - Minimal JS media-query usage

- [ ] **Behavioral differences justified**
  - JS screen-size checks only for interaction differences
  - No layout duplication via JS

- [ ] **Mobile UX is intentional**
  - Touch targets are large enough
  - No hover-only interactions without fallback

---

### 11.6 Accessibility & interaction

- [ ] **Keyboard accessible**
  - All interactive elements are reachable and usable
  - No mouse-only interactions

- [ ] **Focus-visible handled**
  - Visible focus ring using token (`--focus-ring`)
  - No `outline: none` without replacement

- [ ] **Disabled states defined**
  - Disabled elements are visually distinct
  - Disabled state uses tokens (not opacity hacks only)

- [ ] **ARIA only when needed**
  - Prefer semantic HTML first
  - ARIA attributes are correct and minimal

---

### 11.7 Data & backend usage

- [ ] **No fetch / no axios**
  - No manual HTTP calls
  - All backend interaction via generated clients

- [ ] **Client usage is scoped**
  - Generated clients live in feature data layers
  - UI primitives do not import backend logic

- [ ] **Auth assumptions respected**
  - No token handling in frontend
  - Cookies are relied upon implicitly

---

### 11.8 State & UX states

- [ ] **Loading state present**
  - Skeletons or spinners are intentional and styled

- [ ] **Empty state present**
  - Empty states are informative, not blank

- [ ] **Error state present**
  - Expected errors handled at feature level
  - Unexpected errors bubble to error boundaries

---

### 11.9 Code quality & maintainability

- [ ] **No copy-paste styling**
  - Styling is shared via primitives or tokens

- [ ] **Names match intent**
  - Component and prop names reflect meaning, not visuals

- [ ] **Change is locally understandable**
  - A future reader can understand the change without deep context

- [ ] **Patterns are reusable**
  - If a pattern appears twice, it is abstracted

---

### 11.10 Final sanity check (gut test)

- [ ] Could this component survive a **full theme redesign** without changes?
- [ ] Would this still work if the accent color was **yellow**?
- [ ] Could a new engineer extend this without inventing new styles?
- [ ] Does this feel boring in a good way?

If any answer is “no”, revise before merging.

---

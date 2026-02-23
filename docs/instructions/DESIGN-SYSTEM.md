# DESIGN SYSTEM — STRICT ENFORCEMENT

This system **eliminates** subjective design decisions.
All UI **MUST** comply exactly. No exceptions without explicit override.

---

## 1. LAYOUT CONSTRAINTS (STRUCTURAL RULES)

### Default Layout
- Single-column layout is **DEFAULT**
- Multi-column layouts **ONLY** if explicitly specified
- Maximum **5** primary UI components per screen
- **VIOLATION**: More than 5 components without explicit approval

### Container Rules
- Maximum nesting depth: **2 levels**
- No panel inside panel inside panel
- **VIOLATION**: Nested containers beyond 2 levels

---

## 2. SPACING SCALE (EXACT VALUES ONLY)

### Permitted Spacing Values
**ONLY** these values are allowed:
- `4px` — micro spacing (icons, inline elements)
- `8px` — compact spacing (related elements)
- `16px` — standard spacing (section separation)
- `24px` — generous spacing (major sections)
- `32px` — maximum spacing (page-level separation)

### Prohibited
- **NO** custom spacing values (e.g., 12px, 20px)
- **NO** fractional spacing (e.g., 4.5px)
- **NO** percentage-based spacing for vertical rhythm
- **VIOLATION**: Any spacing value not in permitted list

---

## 3. TYPOGRAPHY ROLES (FIXED HIERARCHY)

### Role Definitions
Typography is **role-based**, not aesthetic.

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Heading | **ONE SIZE** | Bold | Page/section titles only |
| Subheading | **ONE SIZE** | Semibold | Subsection titles only |
| Body | **ONE SIZE** | Regular | All content text |
| Caption | **ONE SIZE** | Regular | Metadata, timestamps, hints |

### Prohibited
- **NO** decorative font usage
- **NO** size deviations from role assignments
- **NO** multiple font families
- **NO** custom font weights
- **VIOLATION**: Any typography not matching role table

---

## 4. COMPONENT RULES (BEHAVIORAL CONSTRAINTS)

### Form Rules
- Forms **MUST** be single-column unless explicitly multi-step
- One input per row (labels above inputs)
- **VIOLATION**: Multi-column forms without approval

### Action Rules
- **ONE** primary action per screen maximum
- Secondary actions must be visually subordinate
- Destructive actions must be visually distinct (see UX_INVARIANTS.md)
- **VIOLATION**: Multiple primary buttons on same screen

### Panel Rules
- **NO** nested panels inside panels
- **NO** configuration blocks inline with content
- Settings/config must be separate from content
- **VIOLATION**: Inline configuration UI

---

## 5. PROHIBITED PATTERNS (AUTOMATIC FAILURE)

These patterns cause **immediate failure**:

### Visual Clutter
- ❌ More than 5 controls visible at once (without explicit approval)
- ❌ Duplicated controls on same screen
- ❌ Optional controls surfaced by default

### Complexity Violations
- ❌ "Advanced" sections for basic functionality
- ❌ Collapsible sections hiding primary actions
- ❌ Tabs with fewer than 3 items

### Anti-Patterns
- ❌ Settings scattered across multiple locations
- ❌ Inconsistent action placement
- ❌ Hidden critical functionality

**Consequence**: Immediate refactor required

---

## 6. COLOR USAGE (SEMANTIC ONLY)

### Permitted Color Roles
- Primary action color
- Destructive action color (red family)
- Success state color (green family)
- Warning state color (yellow/orange family)
- Neutral text/border colors

### Prohibited
- **NO** decorative color usage
- **NO** color as sole differentiator
- **NO** more than 5 distinct colors in UI
- **VIOLATION**: Color used without semantic meaning

---

## 7. VERIFICATION CHECKLIST

Before submitting UI work, verify:
- [ ] All spacing uses permitted values only
- [ ] Typography matches role table exactly
- [ ] No nested panels beyond 2 levels
- [ ] Single-column forms unless approved
- [ ] Maximum 1 primary action per screen
- [ ] No prohibited patterns present
- [ ] Colors have semantic roles only

**Incomplete checklist = INCOMPLETE WORK**
# UX INVARIANTS — MANDATORY DEFAULTS

These rules encode **implicit human UX expectations**.
They are **ALWAYS ACTIVE** unless explicitly overridden by human operator.

---

## 1. ORDERING RULES (DETERMINISTIC DISPLAY)

### Default Sort Order
**ALPHABETICAL** ordering is **MANDATORY DEFAULT** for:
- Lists of categories
- Lists of tags
- Lists of names (users, projects, files)
- Navigation items
- Dropdown options
- Any human-readable collection

### Sort Algorithm
- Case-insensitive alphabetical (A-Z)
- Numbers sort before letters
- Special characters sort after alphanumerics

### Prohibited Default Orderings
- ❌ Creation date order (unless explicitly "Recent Items")
- ❌ Random order
- ❌ Database insertion order
- ❌ Unspecified/"natural" order

### Exceptions Requiring Explicit Approval
- Chronological order (for timelines, logs, history)
- Priority/rank order (for prioritized lists)
- Custom user-defined order (for reorderable lists)
- Frequency/usage order (for "most used" lists)

**VIOLATION**: Any list not alphabetically sorted without explicit justification

---

## 2. DEFAULT VALUES (SMART INITIALIZATION)

### Default Selection Rules
- First alphabetical item is **DEFAULT SELECTED** in dropdowns
- Sensible defaults **MUST** be pre-selected in forms
- Empty/null selections **ONLY** when "no selection" is valid state

### Prohibited States
- ❌ Empty required dropdowns forcing user to select
- ❌ Uninitialized configuration requiring setup before use
- ❌ "Please select" placeholders where default is obvious

**VIOLATION**: User forced to make obvious selection

---

## 3. EMPTY STATES (MANDATORY GUIDANCE)

### Required Elements
Every empty list/table/feed **MUST** include:
1. **Explanation**: Why is this empty?
2. **Next Action**: What can the user do?
3. **Visual**: Icon or illustration (optional but preferred)

### Template Structure
```
[Icon]
No [items] yet
[Brief explanation of what would appear here]
[Primary action button to create first item]
```

### Examples
- "No projects yet. Projects help you organize your work. [Create Project]"
- "No tasks found. Try adjusting your filters or create a new task. [New Task]"

**VIOLATION**: Empty state showing blank space or generic "No data"

---

## 4. DESTRUCTIVE ACTIONS (MANDATORY SAFEGUARDS)

### Confirmation Requirements
**ALL** destructive actions **MUST** require confirmation:
- Delete operations
- Irreversible state changes
- Bulk operations affecting multiple items
- Data export/overwrite

### Confirmation Pattern
```
[Action Description]
This will [specific consequence]. This cannot be undone.
[Cancel] [Confirm Action]
```

### Prohibited Patterns
- ❌ Silent deletion without confirmation
- ❌ Generic "Are you sure?" without consequence description
- ❌ Irreversible actions without warning
- ❌ Bulk delete without item count

**VIOLATION**: Any destructive action without explicit confirmation

---

## 5. VISIBILITY RULES (NO HIDDEN BEHAVIOR)

### Discoverability Requirements
- All system actions **MUST** be discoverable through UI
- No "secret" keyboard shortcuts as only access method
- No hidden menus requiring specific gesture
- No functionality accessible only via URL manipulation

### State Visibility
- Loading states **MUST** be visible
- Processing states **MUST** be communicated
- Error states **MUST** be surfaced
- Success confirmations **MUST** be shown

**VIOLATION**: Hidden behavior requiring documentation to discover

---

## 6. CONSISTENCY (BEHAVIORAL UNIFORMITY)

### Action Consistency
- Similar actions **MUST** behave identically across app
- Same action **MUST** appear in same location across screens
- Same terminology **MUST** be used for same concepts

### Examples
- "Delete" button always in same position (e.g., bottom-right)
- "Save" always means same thing (not sometimes "Save Draft")
- "Archive" vs "Delete" distinction maintained everywhere

### Naming Consistency
- UI labels **MUST** match API/code terminology
- Technical terms **MUST** be used consistently
- Synonyms **PROHIBITED** for same concept

**VIOLATION**: Same action with different labels or behaviors

---

## 7. FEEDBACK (MANDATORY COMMUNICATION)

### Action Feedback Rules
After **EVERY** user action:
- Immediate visual feedback (button state change)
- Completion confirmation (toast/message)
- Error communication (if action failed)

### Timing Requirements
- Immediate feedback: < 100ms (visual state change)
- Progress indicator: > 500ms (if action takes time)
- Completion message: when action finishes

**VIOLATION**: Action with no user feedback

---

## 8. VERIFICATION CHECKLIST

Before submitting UX work, verify:
- [ ] All lists alphabetically sorted (or exception documented)
- [ ] All empty states have explanation + action
- [ ] All destructive actions have confirmation
- [ ] All actions have visible feedback
- [ ] Consistent terminology throughout
- [ ] No hidden functionality
- [ ] Smart defaults selected

**Incomplete checklist = INCOMPLETE WORK**
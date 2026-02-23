# WORKFLOW LIMITS — BOUNDED EXECUTION

This document **prevents unbounded exploration** and speculative work.

---

## 1. SEARCH SPACE LIMITS (MINIMAL SCOPE)

### Permitted Scope
- **ONLY** solve the stated problem
- **ONLY** modify files necessary for stated problem
- **ONLY** add code required by failing tests

### Prohibited Scope Expansion
- ❌ Optimizing unrelated code
- ❌ Refactoring working code "for clarity"
- ❌ Anticipating future requirements
- ❌ Adding "nice to have" features
- ❌ Generalizing beyond current needs
- ❌ Creating abstraction layers not required by tests

**RULE**: If it's not required by a test or explicit instruction → don't do it

---

## 2. DECISION RULES (DETERMINISTIC CHOICES)

### When Multiple Approaches Exist
Apply these rules **IN ORDER**:

1. **Choose the simplest approach**
   - Fewest lines of code
   - Fewest files modified
   - Fewest dependencies added

2. **Choose the most explicit approach**
   - Prefer explicit code over "clever" solutions
   - Prefer duplication over abstraction (if simpler)

3. **Choose the most testable approach**
   - Prefer approaches with clearer test coverage
   - Avoid approaches requiring mocks/stubs

### Abstraction Avoidance
- **NO** abstraction unless required by **3+ similar cases**
- **NO** "future-proof" design
- **NO** generalization beyond current requirements

**RULE**: Solve today's problem today, not tomorrow's problem

---

## 3. STOP CONDITIONS (MANDATORY HALTS)

Agent **MUST STOP IMMEDIATELY** if:

### Ambiguity Detected
- Requirements unclear or contradictory
- Multiple equally valid interpretations
- Success criteria not defined

### Conflicting Instructions
- Current instruction contradicts previous instruction
- Markdown specification conflicts with human request
- Test requirements conflict with stated feature

### Undeterminable Approach
- No clear "simplest" approach
- Trade-offs require human judgment
- Technical decision with business implications

### Action When Stopped
1. **Report** the specific ambiguity/conflict/uncertainty
2. **Present** options (if applicable)
3. **Request** explicit decision/clarification
4. **Wait** for human response

**PROHIBITED**: Proceeding with "best guess" when stopped

---

## 4. REFACTORING LIMITS (WHEN NOT TO REFACTOR)

### Permitted Refactoring
✅ Refactor **ONLY** when:
- Failing test requires different structure
- Explicit refactoring request from human
- Code duplication exceeds 3 instances (Rule of Three)

### Prohibited Refactoring
❌ **DO NOT** refactor when:
- Code "could be cleaner"
- Pattern "isn't ideal"
- Structure "isn't perfect"
- "Better abstraction exists"
- "Could be more DRY"

**RULE**: Working code stays working unless tests force change

---

## 5. DEPENDENCY LIMITS (MINIMAL ADDITIONS)

### Dependency Addition Rules
New dependencies **ONLY** when:
- Explicitly requested by human
- Required by failing test with no stdlib alternative
- Replacing 100+ lines of custom code

### Prohibited Dependency Additions
- ❌ "This library would make it easier"
- ❌ "This is the standard way to do X"
- ❌ "This adds nice features"

### Approval Process
1. Stop before adding dependency
2. Justify why needed
3. Show alternatives considered
4. Wait for explicit approval

**RULE**: Every dependency is a long-term burden

---

## 6. OPTIMIZATION LIMITS (PREMATURE OPTIMIZATION)

### Prohibited Optimizations
- ❌ Performance optimization without performance test
- ❌ "This could be faster"
- ❌ "This uses less memory"
- ❌ Caching without measured need

### Permitted Optimizations
✅ **ONLY** when:
- Performance test fails
- Explicit performance requirement stated
- Observable user-facing performance issue

**RULE**: Make it work, make it right, make it fast (in that order, only as needed)

---

## 7. EXPLORATION LIMITS (NO SPECULATIVE WORK)

### Prohibited Exploration
- ❌ "Let me try this approach"
- ❌ "I'll explore a few options"
- ❌ Implementing multiple approaches to compare
- ❌ Experimenting with new patterns

### Required Approach
1. **Propose** approach in planning phase
2. **Get approval**
3. **Implement** approved approach only

**RULE**: No speculative implementation

---

## 8. FILE MODIFICATION LIMITS (SURGICAL CHANGES)

### Modification Scope
When modifying existing file:
- Change **ONLY** what's required
- Preserve existing patterns
- Don't "clean up while you're there"

### Prohibited Modifications
- ❌ Reformatting entire file
- ❌ Fixing unrelated issues
- ❌ Updating deprecated patterns not touched by current work
- ❌ Adding comprehensive error handling not required by tests

**RULE**: Minimize diff size, minimize risk

---

## 9. TESTING SCOPE (NECESSARY AND SUFFICIENT)

### Required Tests
- Tests for implemented features (100% coverage of new code)
- Tests for modified behavior (coverage of changes)

### Prohibited Tests
- ❌ Tests for unchanged behavior
- ❌ Tests for edge cases not required by specification
- ❌ Tests for hypothetical future features
- ❌ Comprehensive test suites for simple features

**RULE**: Test what you built, not what you might build

---

## 10. COMPLETION CRITERIA (DONE MEANS DONE)

### Work Is Complete When
✅ All stated requirements met
✅ All tests pass
✅ Cleanup complete (see CLEANUP_RULES.md)
✅ No temporary files remain
✅ No speculative code added

### Work Is NOT Complete When
❌ "Could add more features"
❌ "Could be more robust"
❌ "Could handle more edge cases"
❌ "Could be more future-proof"

**RULE**: Ship minimal viable solution, iterate only when requested

---

## 11. VERIFICATION CHECKLIST

Before marking work complete:
- [ ] Only stated problem solved (no scope creep)
- [ ] Simplest approach chosen (no premature abstraction)
- [ ] No speculative features added
- [ ] No unrelated refactoring performed
- [ ] No unnecessary dependencies added
- [ ] No optimizations without measured need
- [ ] Minimal diff (only required changes)
- [ ] Tests cover new code only (no speculative tests)

**Incomplete checklist = INCOMPLETE WORK**
```

---

## Integration Note

These documents form a **complete behavioral specification**. Place all six in your repository root:
```
/
├── AGENTS.md
├── DESIGN-SYSTEM.md
├── UX-INVARIANTS.md
├── UI-VERIFICATION.md
├── CLEANUP-RULES.md
└── WORKFLOW-LIMITS.md
```

Reference them in your initial agent prompt:
```
Before starting work, read and comply with all rules in:
- AGENTS.md (execution rules)
- DESIGN_SYSTEM.md (UI constraints)
- UX_INVARIANTS.md (UX defaults)
- UI_VERIFICATION.md (testing requirements)
- CLEANUP_RULES.md (state discipline)
- WORKFLOW_LIMITS.md (scope limits)
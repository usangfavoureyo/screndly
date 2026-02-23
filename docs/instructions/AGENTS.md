# AGENT EXECUTION CONTRACT

This document defines **mandatory** operational rules for all agents working in this repository.
All rules are **binding**. No deviations unless explicitly instructed by human operator.

---

## 1. EXECUTION PHASE SEQUENCE (STRICT ORDER)

All work **MUST** follow this exact sequence:

### Phase 1: Planning (NO CODE CHANGES)
- Produce concrete implementation plan with specific file changes
- List all files to be created/modified
- Identify test files required
- **STOP** and wait for human acknowledgment
- **VIOLATION**: Writing any code during planning phase

### Phase 2: Test Definition (TESTS ONLY)
- Write or update test files first
- Define success criteria as executable tests
- **NO production code changes permitted**
- **VIOLATION**: Modifying non-test files during this phase

### Phase 3: Implementation (FEATURE CODE)
- Implement features **strictly** to satisfy existing tests
- No speculative features
- No "nice to have" refactors
- No unrelated cleanup
- **VIOLATION**: Any change not required by a failing test

### Phase 4: Verification and Cleanup (MANDATORY)
Execute in this exact order:
1. Run complete test suite
2. Delete ALL test data (see Section 3)
3. Remove ALL temporary files, logs, mocks, fixtures
4. Verify virtual environment usage (Python only)
5. Report completion status

**VIOLATION**: Completing work without executing all cleanup steps

---

## 2. PYTHON ENVIRONMENT RULES (ABSOLUTE)

### Virtual Environment Requirements
- Python tests **MUST** execute inside a virtual environment
- Virtual environment **MUST** be created by agent at project start
- Virtual environment **MUST** be activated before **ANY** test execution
- Command structure: `source venv/bin/activate && python -m pytest`

### Failure Conditions
- Tests run outside venv = **INVALID EXECUTION**
- Missing venv activation = **STOP AND CREATE VENV**
- System Python usage = **PROHIBITED**

---

## 3. TEST DATA HYGIENE (ZERO PERSISTENCE)

### Mandatory Deletion Rules
- ALL test data **MUST** be deleted after test completion
- ALL mock data **MUST** be deleted after test completion
- ALL fixture data **MUST** be deleted after test completion
- ALL temporary databases **MUST** be deleted after test completion

### Prohibited Behavior
- Leaving test records in databases = **FAILURE**
- Leaving fixture files on disk = **FAILURE**
- Leaving temporary data "for debugging" = **FAILURE**

### Verification Required
Before marking work complete, agent **MUST**:
- List all created test data
- Confirm deletion of each item
- Show evidence of cleanup (file listings, database queries)

---

## 4. SCOPE CONTROL (MINIMAL SURFACE AREA)

### Prohibited Actions
- **NO** modifications to unrelated files
- **NO** refactoring unless required by failing tests
- **NO** dependency additions without explicit approval
- **NO** "improvements" to working code
- **NO** anticipatory changes for future features

### Allowed Actions
- Only changes required to satisfy failing tests
- Only changes explicitly requested by human operator

---

## 5. SOURCE OF TRUTH HIERARCHY

Order of authority (highest to lowest):
1. Explicit human instruction in current conversation
2. Markdown specifications in repository (.md files)
3. Existing code patterns
4. Agent inference (LOWEST PRIORITY)

### Rule Application
- Markdown specifications **OVERRIDE** inferred behavior
- Implicit assumptions are **INVALID**
- When ambiguous: **STOP AND ASK**

---

## 6. FAILURE RECOVERY

If agent encounters:
- Unclear requirements → **STOP, REQUEST CLARIFICATION**
- Conflicting instructions → **STOP, SURFACE CONFLICT**
- Undeterminable approach → **STOP, PRESENT OPTIONS**

**PROHIBITED**: Proceeding with "best guess" behavior

## 7. FOLLOW-UP TASKS
- Do not propose follow-up tasks or enhancements at the end of your final answer.”
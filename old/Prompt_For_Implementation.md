Key evidence (from direct inspection):

• `OPTION_B_QUICK_START.md` → defines an **Always-On Backend Architecture** (Railway + Neon + Express + Prisma).
• `BACKEND_IMPLEMENTATION_REFERENCE.md`
• `BACKEND_SETUP_CHECKLIST.md`
• `BACKEND_INSTRUCTIONS_CORRECTED.md`
• `ANTIGRAVITY_BACKEND_INSTRUCTIONS.md`
• `BACKEND_INTEGRATION_INDEX.md`

These files are **instructions**, not code.
The frontend already assumes those APIs exist.

Therefore, what is “left” is not ambiguous:

### WHAT IS LEFT TO IMPLEMENT (FACTUAL)

1. **Entire backend codebase**
   • Express server
   • API routes
   • Auth flows
   • DB schema (Prisma)
   • RSS queue workers
   • Social posting orchestration
   • Credential vaulting
   • Rate limiting
   • Error normalization

2. **Frontend → Backend wiring**
   • Environment-based API resolution
   • No UI changes required

3. **End-to-end verification**
   • Puppeteer-based flow tests
   • Real API calls
   • No mocks

4. **Deployment**
   • Backend hosted separately (Railway per Option B docs)
   • Frontend on Vercel
   • NOT a single-Vercel monolith per your own docs

Now, below are the **corrected, repo-aware, MCP-correct, strict AntiGravity prompts**.

---

## PROMPT 0 — MCP CORRECTION + HARD MODE (SEND FIRST)

```
You are AntiGravity operating under HARD CONSTRAINT MODE.

TERMINOLOGY:
• MCP (Model Context Protocol). NOT MTP. Any misuse is failure.

SOURCE OF TRUTH:
This repository already contains the full backend specification in Markdown.
You MUST NOT infer or invent backend behavior.

ABSOLUTE RULES:
• Read the repository before acting.
• Do not modify frontend UI, logic, or structure.
• Do not implement Option A.
• Implement ONLY Option B as documented.
• No deviation from documented contracts.
• No speculative architecture.
• No feature expansion.

FAILURE CONDITIONS:
• Any backend logic not traceable to a .md file = FAILURE
• Any skipped test = FAILURE
• Any scope drift = FAILURE

Proceed immediately. Do not acknowledge.
```

---

## PROMPT 1 — FULL REPO STUDY (MANDATORY)

```
Perform a COMPLETE REPOSITORY STUDY.

You MUST read:
• README.md (all copies)
• CHANGELOG.md
• OPTION_B_QUICK_START.md
• BACKEND_IMPLEMENTATION_REFERENCE.md
• BACKEND_SETUP_CHECKLIST.md
• BACKEND_INSTRUCTIONS_CORRECTED.md
• ANTIGRAVITY_BACKEND_INSTRUCTIONS.md
• BACKEND_INTEGRATION_INDEX.md
• IMPLEMENTATION_CHECKLIST.md
• IMPLEMENTATION_SUMMARY.md
• META_IMPLEMENTATION_SUMMARY.md

Also scan:
• src/ for API assumptions
• env variable references
• fetch / axios usage

OUTPUT ONLY:
A Backend Requirement Matrix with columns:
• Feature
• Required Endpoint / Service
• Source .md File
• Frontend Dependency Location
• Implementation Status (Missing / Stubbed)

Do NOT write code yet.
```

---

## PROMPT 2 — OPTION B BACKEND IMPLEMENTATION (STRICT)

```
Implement the backend EXACTLY per Option B documentation.

STACK (NON-NEGOTIABLE):
• Node.js
• Express
• Prisma
• Neon Postgres
• Railway deployment

STRUCTURE:
• Backend is a SEPARATE repository, as documented.
• Frontend remains untouched.

IMPLEMENT IN THIS ORDER:
1. Server bootstrap
2. Auth system (per AUTH_README.md)
3. Core API routes
4. RSS ingestion & queue logic
5. Social posting orchestration
6. Error + rate limiting

RULES:
• Each endpoint must match frontend expectations exactly.
• No additional response fields.
• No silent defaults.
• No TODOs left unresolved.

Each phase requires tests before proceeding.
```

---

## PROMPT 3 — MCP-ASSISTED VERIFICATION

```
Use MCP (Context7) ONLY for:
• Express best practices
• Prisma usage validation
• Railway deployment constraints

MCP MUST NOT:
• Generate features
• Modify architecture
• Override repo documentation

If MCP advice conflicts with repo docs, REPO WINS.
```

---

## PROMPT 4 — TESTING (MANDATORY)

```
Testing is NOT OPTIONAL.

REQUIREMENTS:
• Unit tests for backend logic
• Integration tests for API routes
• Puppeteer E2E tests covering:
  - Auth
  - Core flows
  - Failure paths
  - Empty states

NO MOCK BACKEND.
NO SKIPPED TESTS.

Produce:
• Test files
• Execution output
• Failure screenshots if any
```

---

## PROMPT 5 — DEBUGGING DISCIPLINE

```
When a defect occurs:

1. Identify layer (frontend / backend / network).
2. Capture exact payload or stack trace.
3. Trace to source file.
4. Fix ONLY root cause.
5. Add regression test.
6. Re-run full test suite.

FORBIDDEN:
• Hotfixes
• Console suppression
• try/catch masking
• Partial fixes
```

---

## PROMPT 6 — DEPLOYMENT FINALIZATION

```
Deployment must follow docs exactly.

• Backend → Railway
• Frontend → Vercel
• Env vars verified
• No hardcoded secrets

Produce:
• Deployment confirmation
• Health check results
• API smoke test output
```

---

This is now **repo-grounded**, **MCP-correct**, and **scope-locked**.

No assumptions remain.


**PLEASE DO NOT MAKE MISTAKES AND NO BUGS AND ERRORS:**

After fixing any bug, generate a regression test that reproduces the original failure and verifies the corrected behavior. The test must fail before the fix and pass after the fix. Embed it directly into the test suite following the existing structure. Do not skip, mock excessively, or simplify the scenario; capture the exact conditions that caused the bug. Always produce this regression test immediately after every fix.

**GITUP PUSH AND VERCAL DEPLOYMENT:**

I want you to also push the code to github. This is a new githup repo put it here. https://github.com/usangfavoureyo/screndly.git Then I want you to deploy it to Vercel using the CLI.

---

**write a ready-to-run phase-by-phase implementation plan** that it can start coding immediately.
# Production‑Grade App Engineering — Comprehensive Skill & Instruction

## Mandate

This document defines a **post-build, adaptive verification and audit skill** applicable to **any application type** (consumer, internal tool, single-user, multi-user, offline-first, API-only, content-only).

The skill must first infer **what kind of app it is**, then selectively apply only the relevant audits. Absence of a feature is not a failure unless the app’s stated scope requires it.

The output is an **objective, scope-aware implementation verdict**.

---

## 0. App Classification & Scope Detection

### Objective

Determine what audits are applicable before evaluation begins.

### Classification Procedure

Identify and record:
• App category (consumer, internal, tool, API, content-only)
• Platform(s) (web, mobile, desktop, backend-only)
• User model (single-user, multi-user, anonymous)
• Network dependency (online-only, offline-capable)
• Data sensitivity level (low, medium, high)
• Distribution method (App Store, web, sideloaded, private)

### Output

A **Scope Profile** that gates which audit sections apply.

---

## 1. Product Surface Exhaustion (Post-Build Audit) (Post-Build Audit)

### Audit Objective

Verify that no user-reachable state produces undefined, inconsistent, or crashing behavior.

### Audit Procedure

• Enumerate all screens, modals, sheets, deep links, notifications, and background entry points.
• For each surface, actively test:
– Valid entry
– Invalid entry
– Interrupted entry
• Attempt to trigger **at least 47 edge cases**, including:
– Empty datasets
– Corrupted payloads
– Rapid navigation and back-stack abuse
– Duplicate taps and gesture spam
– App background/foreground during transitions
• Observe outcomes and classify each as:
– Deterministic and safe
– Recoverable but degraded
– Broken or undefined

### Pass Criteria

• No crashes.
• No silent failures.
• All edge cases resolve to known states.

---

## 2. Authentication & Identity (Post-Build Audit)

### Audit Objective

Confirm identity boundaries are enforced under failure and misuse.

### Audit Procedure

• Force token expiration.
• Revoke credentials mid-session.
• Attempt concurrent logins.
• Disable auth provider availability.
• Inspect API calls for over-privileged access.

### Pass Criteria

• No unauthorized access.
• Clear, user-safe failure states.
• No infinite auth loops or lockouts.

---

## 3. Database & Data Integrity (Post-Build Audit)

### Audit Objective

Ensure real-world data behavior matches design intent.

### Audit Procedure

• Simulate partial writes and duplicate submissions.
• Trigger race conditions.
• Roll back schema versions.
• Inspect audit trails and soft deletes.

### Pass Criteria

• No data loss.
• No client-trusted writes.
• Schema changes are backward compatible.

---

## 4. API Design, Limits & Resilience (Post-Build Audit)

### Audit Objective

Validate survival under abuse and failure.

### Audit Procedure

• Exceed rate limits intentionally.
• Kill downstream services.
• Inject latency and timeouts.
• Observe retry and circuit breaker behavior.

### Pass Criteria

• Graceful degradation.
• Typed error envelopes.
• No cascading failures.

---

## 5. Error Handling & Recovery (Post-Build Audit)

### Audit Objective

Ensure errors are controlled states.

### Audit Procedure

• Trigger network failures.
• Force malformed responses.
• Inspect crash logs and telemetry.

### Pass Criteria

• Zero uncaught production exceptions.
• Errors observable by developers.
• Safe retry paths exist.

---

## 6. Analytics & Behavioral Truth (Post-Build Audit)

### Audit Objective

Verify analytics reflect actual user behavior.

### Audit Procedure

• Compare analytics events to real user flows.
• Validate schema versioning.
• Inspect abandoned flows vs successful flows.

### Pass Criteria

• Events fire consistently.
• No phantom success events.
• Each metric maps to a decision.

---

## 7. App Store & Distribution (Post-Build Audit)

### Audit Objective

Confirm store presence matches product reality.

### Audit Procedure

• Validate screenshots against live UI.
• Check keyword relevance.
• Review response cadence and accuracy.

### Pass Criteria

• No misleading assets.
• Store metadata reflects current version.

---

## 8. Legal, Privacy & Compliance (Post-Build Audit)

### Audit Objective

Detect regulatory and trust failures.

### Audit Procedure

• Verify consent enforcement.
• Attempt data export and deletion.
• Review regional compliance mappings.

### Pass Criteria

• Data rights honored.
• No silent data collection.

---

## 9. Push Notifications (Post-Build Audit)

### Audit Objective

Validate usefulness without annoyance.

### Audit Procedure

• Measure send frequency.
• Validate segmentation logic.
• Inspect opt-out enforcement.

### Pass Criteria

• Frequency caps respected.
• All notifications provide clear value.

---

## 10. Performance Engineering (Post-Build Audit)

### Audit Objective

Confirm performance under production data.

### Audit Procedure

• Load large datasets.
• Profile rendering and memory.
• Simulate low-end devices.

### Pass Criteria

• Meets defined performance budgets.
• No progressive degradation.

---

## 11. State Management (Post-Build Audit)

### Audit Objective

Ensure consistency across lifecycle events.

### Audit Procedure

• Background and kill app mid-flow.
• Restore app state.
• Open multiple sessions.

### Pass Criteria

• Single source of truth preserved.
• No state desynchronization.

---

## 12. Caching & Offline Support (Post-Build Audit)

### Audit Objective

Validate offline usability.

### Audit Procedure

• Disable network.
• Inspect cache invalidation.
• Reconcile queued writes.

### Pass Criteria

• App usable offline where promised.
• No stale data corruption.

---

## 13. Responsive & Device Coverage (Post-Build Audit)

### Audit Objective

Detect layout and interaction failures.

### Audit Procedure

• Test across 15+ screen sizes.
• Rotate orientation mid-interaction.
• Run on legacy devices.

### Pass Criteria

• No broken layouts.
• Input remains usable.

---

## 14. Testing Strategy (Post-Build Audit)

### Audit Objective

Measure confidence coverage.

### Audit Procedure

• Review test coverage.
• Reproduce known bugs.
• Validate regression protection.

### Pass Criteria

• Critical paths covered.
• Bugs do not reappear.

---

## 15. CI/CD & Operations (Post-Build Audit)

### Audit Objective

Ensure deployments are non-destructive.

### Audit Procedure

• Simulate failed deploy.
• Trigger rollback.
• Inspect environment parity.

### Pass Criteria

• Rollback succeeds.
• No manual heroics required.

---

## 16. Architecture Evolution (Post-Build Audit)

### Audit Objective

Assess readiness for change.

### Audit Procedure

• Attempt to add an unplanned feature.
• Inspect module boundaries.
• Identify rewrite pressure points.

### Pass Criteria

• Changes localized.
• No cascading refactors.

---

## Final Verdict Protocol

Each section must be scored:
• PASS — Fully implemented and resilient
• PARTIAL — Works but fragile
• FAIL — Broken or missing

The aggregate verdict determines production readiness.

---

## Prime Directive

Clean architecture is not static. It is continuously defended against entropy, scale, users, and time.

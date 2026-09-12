# ApproveAProof — Development Playbook

**Document purpose:** Canonical development method, engineering working agreements, verification discipline, and implementation workflow  
**Project:** ApproveAProof  
**Status:** Active  
**Established:** September 12, 2026  
**Current development phase:** Phase 1 — Database  
**Current development branch:** `phase-1-database`

---

# 1. Purpose

This document defines **how ApproveAProof is built**.

The other canonical project documents answer different questions:

```text
APPROVEAPROOF_MASTER_PLAN.md
    → What are we building and why?

TECHNICAL_ARCHITECTURE_PLAN.md
    → How is the system designed?

DEVELOPMENT_PLAYBOOK.md
    → How do we build it correctly and consistently?
```

The Playbook exists to preserve the engineering habits, verification standards, decision-making discipline, and collaboration workflow used during development.

It should prevent:

- large unverified implementation jumps;
- accidental architectural drift;
- unsafe database migrations;
- losing track of commit boundaries;
- treating generated code or SQL as automatically correct;
- mixing unrelated changes into one checkpoint;
- relying on conversation memory for development procedure;
- weakening security or integrity for convenience;
- silently changing previously locked decisions.

When this document conflicts with a more specific locked product or architecture invariant, the product/architecture invariant wins.

When the development method itself changes deliberately, update this document.

---

# 2. Core Development Principle

The default unit of progress is:

> **The smallest coherent change that establishes or strengthens one meaningful behavior or invariant.**

Do not optimize for the largest amount of code written in one session.

Optimize for:

```text
clarity
correctness
verification
recoverability
reviewability
security
data integrity
```

A smaller change that can be understood and proven is preferable to a larger change that merely appears faster.

---

# 3. Decision Hierarchy

When engineering concerns compete, use this hierarchy as a strong default:

```text
1. Core product invariant
2. Security / tenant isolation
3. Data integrity
4. Historical correctness
5. Failure safety
6. Simplicity
7. Maintainability
8. Performance supported by evidence
9. Developer convenience
```

This is not a mechanical scoring formula.

It expresses the project's bias.

Example:

A slightly more complex composite database relationship is justified when it makes a cross-tenant or cross-Proof invalid state impossible.

Developer convenience is not a sufficient reason to weaken a core invariant.

---

# 4. Three Architecture Questions

For important domain and persistence decisions, repeatedly ask:

### 1. Tenant isolation

> Can Organization A ever touch Organization B's data through this design?

### 2. Exact artifact identity

> Can the exact bytes reviewed by the customer ever become ambiguous?

### 3. Historical evidence

> Can ordinary application operations change, destroy, or misrepresent historical approval evidence?

These questions are especially important for:

```text
Proof
Revision
ProofResponse
review tokens
uploads
approval
customer deletion
dispatch
billing/entitlements
```

---

# 5. Server Owns Truth

The browser submits intent.

The server determines authoritative values.

Never trust the browser to authoritatively choose:

```text
organization ownership
resource ownership
subscription entitlement
S3 object path
revision number
current revision
approved revision
proof status
approval timestamp
public authorization scope
```

Identifiers supplied by the browser identify requested resources.

They do not prove authorization.

---

# 6. Prefer Structural Integrity

When a meaningful invariant can reasonably be enforced by the database, prefer database enforcement over a comment or developer convention.

Preferred:

```text
foreign keys
composite foreign keys
unique constraints
NOT NULL
appropriate referential actions
transactions
```

over:

```text
"remember to check this in every route"
```

Application/domain validation is still required where business behavior cannot be fully expressed relationally.

Database constraints and application logic should reinforce each other.

---

# 7. Do Not Overbuild

Strong integrity does not mean speculative infrastructure.

Do not introduce complexity merely because a large system might eventually need it.

Examples not to introduce without demonstrated need:

```text
microservices
Redis
Kafka
SQS
multiple operational databases
Kubernetes
premature caching layers
speculative abstraction frameworks
```

Use the simplest architecture that preserves the required invariants.

---

# 8. Development Slice Workflow

For each meaningful implementation slice, use this sequence:

```text
Understand current state
        ↓
State the invariant / goal
        ↓
Identify the smallest coherent change
        ↓
Identify affected files
        ↓
Review security/data implications
        ↓
Implement
        ↓
Run targeted validation
        ↓
Inspect generated artifacts
        ↓
Apply / execute
        ↓
Verify actual behavior
        ↓
Run appropriate quality gate
        ↓
Inspect git diff/status
        ↓
Commit checkpoint
        ↓
Push
        ↓
Next slice
```

Do not skip directly from "code written" to "done."

---

# 9. Before Significant Implementation

Before changing code or schema, establish:

```text
What are we changing?

Why are we changing it?

What invariant or behavior should exist afterward?

Which files should change?

What security boundary is affected?

What database/data-lifecycle behavior is affected?

What can go wrong?

How will we verify it?

Is this one coherent commit?
```

For a small obvious edit, this may take only a few sentences.

For a security-sensitive or data-model decision, make it explicit.

---

# 10. Verification Checkpoint

A **verification checkpoint** means:

> Stop adding new behavior and prove the current change works.

Examples:

```text
Prisma schema validates
migration SQL is correct
migration applies successfully
database reports synchronized
typecheck passes
targeted tests pass
invalid state is rejected
expected state is accepted
```

A verification checkpoint is not automatically a commit checkpoint.

If the implementation is still incomplete as a coherent unit, verify it and continue.

---

# 11. Commit Checkpoint

A **commit checkpoint** means:

> The change is coherent, tested at the appropriate level, understood, and worth preserving independently.

Before recommending a commit:

```text
implementation is complete for the slice
appropriate verification passed
generated artifacts were inspected
git diff was reviewed
git status was reviewed
unrelated changes were identified
```

ChatGPT should explicitly announce:

> **Commit checkpoint**

and recommend a concise commit message.

The user controls the actual:

```text
git add
git commit
git push
```

Never assume a commit or push occurred until the user confirms it.

---

# 12. Phase Checkpoint

A **phase checkpoint** is stronger than a commit checkpoint.

Before a phase is considered complete:

```text
phase completion criteria are satisfied
all intended migrations are applied
database/environment state is verified
required tests exist and pass
full quality gate passes
canonical documentation is current
git working tree is understood
phase branch is ready for merge
```

Only then should the phase branch be merged into `main`.

---

# 13. Git Philosophy

`main` represents stable tested code.

Development occurs on coherent feature/phase branches.

Current branch:

```text
phase-1-database
```

Prefer commits that answer one clear question.

Good:

```text
feat: add proof status workflow state
feat: enforce revision organization ownership
feat: enforce current revision integrity
```

Avoid:

```text
update stuff
database changes
misc fixes
big phase work
```

Avoid giant commits spanning unrelated concerns.

---

# 14. Staging Discipline

Do not blindly stage the entire working tree.

Before committing:

```bash
git status
git diff
```

Then stage only intended files where practical.

This matters because formatting tools may touch unrelated files.

For example:

```text
schema change
migration
```

may be the intended feature while:

```text
Markdown
configuration formatting
```

is incidental.

Separate unrelated formatting changes into their own commit or restore them when appropriate.

---

# 15. Formatter Awareness

`npm run format` may modify files beyond the feature being implemented.

A passing formatter does not mean every changed file belongs in the feature commit.

After formatting:

```bash
git status
git diff
```

Inspect what changed.

Formatting-only changes may be committed separately when useful.

Do not let incidental formatting obscure the semantic feature diff.

---

# 16. Quality Gates

The complete project quality gate is:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

Use the full gate:

```text
at phase boundaries
before important merge points
after meaningful cross-cutting changes
when explicitly establishing a durable checkpoint
```

Not every tiny edit requires all five commands.

Use targeted checks during incremental work, then the full gate when the slice or phase warrants it.

---

# 17. Database Development Philosophy

The Prisma schema and migration history are authoritative.

Normal development is schema-first.

Do not use:

```text
prisma db pull
```

as the normal workflow for this application-owned database.

A schema that validates is not proof that a migration is safe.

A generated migration is not automatically correct merely because Prisma generated it.

Treat generated migration SQL as a proposal that must be understood.

---

# 18. Database Migration Workflow

For nontrivial schema changes, prefer:

```text
edit schema
        ↓
npx prisma format
        ↓
npx prisma validate
        ↓
create migration --create-only
        ↓
inspect migration.sql
        ↓
modify migration if safety requires it
        ↓
apply migration
        ↓
verify migration status
        ↓
run tests/quality gate
        ↓
inspect git diff/status
        ↓
commit schema + migration together
```

Typical command pattern:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name <migration_name> --create-only
```

Inspect:

```text
prisma/migrations/<timestamp>_<migration_name>/migration.sql
```

Then apply:

```bash
npx prisma migrate dev
npx prisma migrate status
```

Do not mechanically use `--create-only` for every trivial migration if it adds no value, but default toward inspection when constraints, existing data, referential actions, or destructive changes are involved.

---

# 19. Existing Data Must Be Considered

Before applying a migration, ask:

```text
Are rows already present?

Will a new NOT NULL column fail?

Does a backfill need to happen first?

Could a new unique constraint collide?

Could a foreign key reject existing data?

Could a referential action delete historical records?

Does migration ordering temporarily weaken integrity?
```

Never design only for an empty database unless the database is actually disposable and that assumption is explicit.

---

# 20. Safe Backfill Pattern

When adding a required field to a table that may already contain rows, a common safe pattern is:

```text
1. add column nullable
2. backfill from authoritative existing data
3. verify/backfill implicitly through NOT NULL
4. make column NOT NULL
5. add final constraints/indexes
```

Example already used in ApproveAProof:

```text
Revision.organizationId
```

was:

```text
added nullable
backfilled from Proof.organizationId
made NOT NULL
protected with foreign keys
```

This preserved existing Revision records while strengthening the model.

---

# 21. Migration Ordering

Migration ordering matters.

When replacing an existing integrity constraint with a stronger one, avoid unnecessary windows where no protection exists.

Example pattern:

```text
add/backfill required data
prepare supporting candidate key/index
prepare replacement relationship
drop weaker constraint only when replacement is ready
add stronger constraint
```

The goal is not merely for the final schema to be correct.

The transition should also be safe.

---

# 22. Applied Migrations Are Historical Records

Once a migration has been applied/shared:

> Do not edit it merely to make history look cleaner.

Create a new migration for new changes.

Migration history should reflect what actually happened.

Exceptions require an explicit development-environment reason and should not be casual.

---

# 23. Prisma Is a Tool, Not the Architecture

Prisma's modeling requirements may introduce structures that are logically redundant from a pure relational perspective.

Example already encountered:

```text
UNIQUE (Proof.id, Proof.currentRevisionId)
UNIQUE (Revision.proofId, Revision.id)
```

These support Prisma's composite one-to-one relation representation even though primary-key uniqueness already exists.

When Prisma requires such structures:

```text
understand why
confirm PostgreSQL semantics
document the reason when non-obvious
accept the requirement if it preserves the intended invariant
```

Do not contort the domain merely to make the ORM look simpler.

---

# 24. Referential Actions Are Domain Decisions

Do not choose:

```text
Cascade
Restrict
SetNull
NoAction
```

mechanically.

Ask what deletion/update means to the business record.

Examples:

```text
Organization deletion
Customer cleanup
Proof deletion
Revision deletion
historical approval evidence
current Revision references
```

Historical evidence should generally resist casual deletion.

Referential actions must be evaluated together when cycles exist.

---

# 25. Composite Ownership Pattern

ApproveAProof deliberately uses composite ownership constraints where they materially prevent invalid relationships.

Current examples:

```text
Revision(proofId, organizationId)
    → Proof(id, organizationId)
```

This means:

> Revision's explicit tenant must equal its Proof's tenant.

And:

```text
Proof(id, currentRevisionId)
    → Revision(proofId, id)
```

This means:

> A Proof's current Revision must belong to that Proof.

These are examples of the project's preference for structural integrity.

---

# 26. Nullable Does Not Mean Weak

A nullable field can be the correct domain model.

Example:

```text
Proof.currentRevisionId
```

is nullable because a Proof can exist before a Revision exists.

The important question is:

> When the value exists, is it valid?

The composite foreign key answers that question.

Do not use `NOT NULL` merely because it feels stricter when the lifecycle legitimately includes an absent state.

---

# 27. Operational State vs. Evidence

Do not confuse current workflow state with historical evidence.

Example:

```text
Proof.status = APPROVED
```

will be useful operational state.

It is not, by itself, proof of what was approved.

Authoritative evidence belongs in:

```text
ProofResponse
    ↓
exact Revision
```

This distinction should influence schema, APIs, UI, tests, and future reporting.

---

# 28. Immutable History Bias

Once information becomes part of what a customer reviewed or decided, ordinary APIs should not silently rewrite it.

Prefer:

```text
new Revision
new Response
new Activity
explicit correction record
```

over mutation of historical evidence.

This principle applies to:

```text
revision artifact
revision number
file hash
approval statement snapshot
checklist snapshot
response type
response revision
responder identity
occurredAt
```

---

# 29. Testing Philosophy

Tests should protect meaningful behavior and invariants.

Prioritize:

```text
domain state transitions
tenant isolation
database constraints
authorization boundaries
transaction behavior
idempotency
stale-revision rejection
historical immutability
failure behavior
```

over low-value snapshot coverage.

A test is valuable when it makes a future regression difficult.

---

# 30. Test Both Success and Rejection

For an important invariant, test:

```text
the valid state succeeds
the invalid state fails
```

Example for current Revision integrity:

```text
Proof with null currentRevisionId succeeds
same-Proof Revision succeeds
cross-Proof Revision fails
```

Example for tenant ownership:

```text
Revision with matching Proof organization succeeds
Revision with mismatched organization fails
```

Security tests that only test the happy path are incomplete.

---

# 31. Database Tests Required Before Phase 1 Completion

At minimum, Phase 1 database-oriented tests should eventually verify relevant invariants including:

```text
duplicate Membership for same Organization/User is rejected

duplicate Revision number within one Proof is rejected

Revision organization must match owning Proof organization

Proof currentRevision may be null

Proof currentRevision may reference its own Revision

Proof currentRevision may not reference another Proof's Revision

deleting a currently referenced Revision is blocked

Proof deletion with currentRevision set behaves as intended

Customer deletion behavior matches the final historical-data decision
```

As `ProofResponse`, `ProofActivity`, and `ProofDispatch` are added, extend this list.

---

# 32. Security Review Is Continuous

Security is not deferred to a final hardening phase.

For every feature, consider:

```text
authentication
authorization
tenant isolation
input validation
state integrity
data privacy
token handling
file handling
rate abuse
logging exposure
failure behavior
```

The later security phase verifies and strengthens work that should already be security-conscious.

---

# 33. Tenant-Scoped Query Rule

For authenticated tenant resources, do not rely on a globally unique ID alone when ownership matters.

Bad conceptual pattern:

```text
find Proof where id = suppliedId
```

Preferred conceptual pattern:

```text
find Proof where
  id = suppliedId
  AND organizationId = authorizedOrganizationId
```

For Revision, explicit `organizationId` exists specifically to make this boundary easier to express.

Knowing a valid UUID never grants access.

---

# 34. Failure Behavior Matters

When designing a workflow, ask:

> What happens if the next external step fails?

Examples:

```text
database commit succeeds, SendGrid fails
S3 upload succeeds, finalization fails
browser retries approval
scheduled job runs twice
network drops after server success
```

Authoritative business state must not depend on fragile external side effects.

Use transactions, idempotency, and outbox-style records where appropriate.

---

# 35. External Services Are Not Transaction Coordinators

Do not make a valid customer decision depend on SendGrid, Stripe, S3 notification, analytics, or another external service completing synchronously.

Example:

```text
approval transaction commits
        ↓
ProofDispatch PENDING exists
        ↓
email happens afterward
```

If email fails, approval remains valid.

---

# 36. Avoid Speculative Fields

Do not add fields simply because they may eventually be useful.

Before adding a field, ask:

```text
What behavior needs it now?

What lifecycle does it have?

Who owns its value?

Can it change?

Is it evidence or convenience state?

Does it need an index?

Does deletion affect it?

Does it create a security boundary?
```

A smaller deliberate schema is better than a broad speculative one.

---

# 37. Avoid Premature Abstraction

Do not create a generalized framework when one clear implementation is sufficient.

Prefer concrete domain language:

```text
Proof
Revision
ProofResponse
ProofDispatch
```

over generic abstractions whose value has not been demonstrated.

Refactor when repeated behavior becomes real.

---

# 38. Thin Route Rule

Routes coordinate.

They should not own the entire business architecture.

Preferred flow:

```text
route
  ↓
validate
  ↓
authenticate
  ↓
authorize
  ↓
domain/service
  ↓
response
```

State transitions, approval integrity, tenant authorization, and storage rules belong in reusable server/domain logic.

---

# 39. Server-Only Boundary Rule

Secrets and privileged infrastructure must remain server-only.

Examples:

```text
database client
DATABASE_URL
AWS credentials
Stripe secrets
SendGrid keys
Auth0 secrets
session secrets
```

Use deliberate `.server.ts` modules and dependency flow.

A filename convention helps communicate intent but does not replace architectural review.

---

# 40. Copy/Paste Precision

The user applies changes manually in VS Code.

Instructions should therefore optimize for safe copy/paste.

Prefer:

```text
exact replacement block
clear filename
clear location
clear command
```

Avoid showing existing surrounding declarations in a way that makes them easy to duplicate accidentally.

When replacing a complete Prisma model or enum, clearly say whether the block:

```text
replaces
```

or:

```text
is added beside
```

existing code.

If a paste error occurs, diagnose the actual schema before layering more changes on top.

---

# 41. One Coherent Step at a Time

When practical:

```text
one schema concern
one model
one migration
one service
one domain behavior
```

at a time.

This does not mean artificially splitting inseparable work.

A composite foreign key and the supporting unique key belong in the same slice because neither makes sense independently.

The unit is coherence, not file count.

---

# 42. Do Not Continue Through an Unexpected Error

If a command produces an unexpected error:

```text
stop
read the error
inspect current state
identify the cause
fix that cause
rerun the failed check
```

Do not pile additional edits onto an unexplained failure.

An error is information about the current system state.

Use it.

---

# 43. Verify the Actual Diff

Before committing, review what Git says changed.

Do not rely on memory.

Useful commands:

```bash
git status
git diff
git diff -- <specific-file>
git diff --cached
```

Remember:

> Normal `git diff` does not show the contents of untracked files.

Inspect untracked generated migration files directly, for example:

```bash
cat prisma/migrations/<migration>/migration.sql
```

---

# 44. Documentation Checkpoints

Update canonical project documentation:

```text
at phase boundaries
and
at meaningful mid-phase architecture checkpoints
```

A documentation checkpoint is warranted when:

```text
a major invariant becomes implemented
an open architecture decision becomes locked
the resume point changes materially
the remaining phase work changes
development procedure evolves
```

Do not update documentation after every tiny edit.

Do not wait so long that the documents describe a materially obsolete system.

---

# 45. Documentation Responsibilities

The three canonical documents have distinct responsibilities.

## Master Plan

Owns:

```text
product definition
scope
roadmap
high-level decisions
decision log
current project status
market/product direction
```

## Technical Architecture Specification

Owns:

```text
implemented technical architecture
data model
security architecture
integration architecture
engineering invariants
technical completion criteria
technical resume point
```

## Development Playbook

Owns:

```text
development workflow
verification checkpoints
migration procedure
testing philosophy
Git discipline
commit/phase checkpoints
collaboration mechanics
engineering decision habits
```

Avoid unnecessary duplication.

Cross-reference the canonical owner instead.

---

# 46. Documentation Accuracy Rule

Documentation should distinguish among:

```text
IMPLEMENTED
LOCKED
CURRENT PLAN
HYPOTHESIS / BACKLOG
OPEN DECISION
```

Do not describe planned behavior as implemented.

Do not leave implemented decisions labeled as open.

Repository code and applied migrations are authoritative for exact implementation details.

If documentation and repository state disagree, investigate and update the documentation rather than silently guessing.

---

# 47. Repository Is the Implementation Authority

The canonical documents explain the project.

The repository proves what is implemented.

For exact details such as:

```text
migration timestamp
package version
constraint name
current branch state
generated SQL
```

prefer the repository when there is a discrepancy.

Do not fabricate exact repository state from memory.

---

# 48. Current Phase 1 Working Method

For the remaining database phase, continue using the pattern that has worked:

```text
choose one unresolved schema concern
        ↓
state its invariant
        ↓
compare viable relational designs
        ↓
select deliberately
        ↓
edit Prisma schema
        ↓
format + validate
        ↓
create migration --create-only
        ↓
inspect SQL
        ↓
edit SQL if existing-data safety requires it
        ↓
apply migration
        ↓
verify migration status
        ↓
run appropriate/full quality gate
        ↓
inspect git status/diff
        ↓
commit checkpoint
        ↓
push
```

Current next concern:

```text
Customer deletion/history semantics
```

Then:

```text
ProofResponse
ProofActivity
ProofDispatch
remaining constraints/indexes
runtime database adapter/client
database integrity tests
final Phase 1 gate
```

---

# 49. Lessons Captured From Phase 1 So Far

The following practices are now proven useful in this project.

### Generated migrations require inspection

Adding a required `Revision.organizationId` would have produced unsafe SQL for existing rows if the generated migration had been applied blindly.

The migration was instead changed to:

```text
add nullable
backfill
make NOT NULL
add constraints
```

### Composite constraints can encode important domain rules

Revision tenant ownership and current Revision ownership are now protected structurally.

### ORM requirements should be understood, not fought blindly

Prisma required composite uniqueness on the defining side of the currentRevision one-to-one relationship.

The requirement was investigated and incorporated without weakening the domain invariant.

### Referential cycles require deliberate actions

The currentRevision relationship uses `NoAction` rather than blindly cascading.

### Formatting can create unrelated Git noise

Inspect and stage deliberately.

### Copy/paste instructions must be exact

Contextual snippets can accidentally duplicate declarations or introduce syntax errors.

Use explicit replacement blocks.

### Passing validation is necessary but insufficient

Schema validation, migration safety, database behavior, tests, and Git diff inspection answer different questions.

---

# 50. Current High-Level Decisions

As of September 12, 2026, development should treat the following as established unless explicitly revisited:

```text
clean ApproveAProof repository
SmartLynx frozen as reference
React Router Framework Mode
modular monolith
one PostgreSQL database
Neon managed PostgreSQL
Prisma 7.10.0 baseline
UUID primary keys
Organization-first tenancy
User ↔ Membership ↔ Organization
schema-first migrations
immutable revisions
ProofStatus operational state
explicit Revision organization ownership
database-enforced Revision/Proof tenant consistency
nullable Proof.currentRevisionId
database-enforced same-Proof currentRevision
approval must reference exact Revision
private S3 direction
direct browser-to-S3 direction
server-controlled S3 object identity
hashed public review-token direction
transactional customer responses
email failure cannot invalidate approval
centralized entitlements
short-lived development branches
user-controlled Git operations
documentation checkpoints
small coherent implementation slices
```

Changing one of these requires an explicit reason.

---

# 51. Current Open High-Level Decisions

The next unresolved decisions should be handled when they become necessary.

Current Phase 1 open items include:

```text
Customer deletion/history semantics
exact Proof recipient snapshot fields
exact ProofResponse schema and constraints
exact ProofActivity metadata shape
exact ProofDispatch idempotency fields
revision lifecycle/status schema
remaining operational indexes
runtime Prisma/PostgreSQL adapter construction
database test implementation structure
```

Later open questions remain in the Master Plan and Technical Architecture Specification.

Do not solve unrelated future questions merely to make this list shorter.

---

# 52. Definition of Done for a Development Slice

A normal slice is done when:

```text
the intended invariant/behavior is implemented
the relevant validation passes
migration/generated artifacts were inspected where applicable
actual runtime/database state was verified where applicable
tests appropriate to the slice pass
Git diff/status is understood
documentation impact was considered
a commit checkpoint was identified
the user committed/pushed if they chose to do so
```

"Code exists" is not the definition of done.

---

# 53. Definition of Done for Phase 1

Phase 1 is done only when the database foundation is deliberate enough for later application behavior to depend on it.

Required:

```text
User
Organization
Membership
Customer
Proof
Revision
ProofResponse
ProofActivity
ProofDispatch

ProofStatus
currentRevision integrity
Revision tenant integrity
Customer/history deletion semantics
important constraints/indexes
runtime Prisma/PostgreSQL adapter
server-only database utility
database integrity tests
Neon synchronized
full quality gate passed
documentation current
phase branch ready to merge
```

Then:

```text
phase-1-database
    ↓
main
```

Only after that begin Phase 2.

---

# 54. Collaboration Contract

The development collaboration model is:

```text
ChatGPT
    → architecture
    → design comparison
    → security/integrity review
    → copy/paste-ready changes
    → commands
    → verification interpretation
    → commit checkpoint guidance
    → documentation maintenance

User
    → edits local files
    → runs commands
    → reports outputs/errors
    → reviews local state
    → commits
    → pushes
    → merges
    → deploys
```

ChatGPT should never claim a local action occurred unless the user reports it.

The user remains in control of the repository.

---

# 55. Final Development Rules

## 1. Build one coherent thing at a time.

Large unverified jumps create hidden mistakes.

## 2. State the invariant before implementing the mechanism.

Know what must be true before choosing how to make it true.

## 3. Prefer impossible invalid states over remembered checks.

Use structural database/security boundaries where reasonable.

## 4. Inspect migrations before trusting them.

Generated SQL is proposed SQL.

## 5. Preserve existing data deliberately.

Schema evolution must account for rows that already exist.

## 6. Test rejection paths.

Security and integrity live in what the system refuses to do.

## 7. Keep operational state separate from historical evidence.

Convenience fields never replace authoritative records.

## 8. Inspect Git before committing.

Only intended changes belong in a coherent checkpoint.

## 9. Document meaningful decisions when they become real.

Conversation memory is not the project record.

## 10. Do not trade away the core promise for convenience.

The system exists to establish:

> **This customer approved this exact revision at this exact time.**

---

# END OF DEVELOPMENT PLAYBOOK

**Current checkpoint:** September 12, 2026. Phase 1 Database remains in progress on `phase-1-database`.

**Most recent completed slices:** ProofStatus, explicit Revision tenant ownership, database-enforced Revision/Proof tenant consistency, and database-enforced same-Proof currentRevision integrity.

**Immediate next development concern:** Customer deletion/history semantics.

**Then:** ProofResponse → ProofActivity → ProofDispatch → remaining constraints/indexes → runtime database adapter/client → database integrity tests → final Phase 1 gate.

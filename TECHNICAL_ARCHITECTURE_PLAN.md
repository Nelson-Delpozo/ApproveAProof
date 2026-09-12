# ApproveAProof v1 Technical Architecture Specification

**Document purpose:** Canonical engineering architecture and implementation reference
**Project:** ApproveAProof
**Status:** Active MVP development
**Current phase:** Phase 1 — Database
**Current branch:** `phase-1-database`
**Last architecture checkpoint:** September 10, 2026

---

# 1. Product Definition

ApproveAProof is a lightweight proof-review and approval application for small custom-production businesses.

The initial target market is:

- commercial and digital print shops;
- sign shops;
- screen printers;
- embroidery businesses;
- vehicle-wrap shops;
- sticker/decal shops;
- promotional-product businesses;
- engravers and similar custom-production businesses.

The initial customer wedge is:

> **Small independent commercial and digital print shops whose proof approval workflow still relies heavily on email, attachments, replies, screenshots, or text messages.**

The application exists to answer one operationally important question:

> **Which exact version did the customer approve for production, who approved it, and when?**

ApproveAProof is deliberately not a:

- CRM;
- print MIS;
- invoicing system;
- production scheduler;
- quoting system;
- storefront;
- inventory system;
- design editor;
- generic file-sharing application.

Its core workflow is:

```text
SHOP CREATES PROOF
        ↓
UPLOAD REVISION
        ↓
SEND TO CUSTOMER
        ↓
CUSTOMER REVIEWS
        ↓
 ┌───────────────────┐
 │                   │
 ▼                   ▼
APPROVE        REQUEST CHANGES
 │                   │
 ▼                   ▼
LOCK RECORD     SHOP REVISES
                     │
                     ▼
               NEW REVISION
                     │
                     └──────→ REVIEW AGAIN
```

The primary product invariant is:

> **An approval must always reference exactly one immutable revision of one proof.**

---

# 2. Current Implementation Checkpoint

## September 10, 2026

### Phase 0 — Foundation

**COMPLETE**

Established:

- React Router Framework Mode;
- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- Zod environment validation;
- ESLint;
- Prettier;
- Vitest;
- jsdom;
- Testing Library baseline;
- production build;
- server/client module boundary conventions.

The complete Phase 0 quality gate passed:

```text
format
lint
typecheck
test
build
```

### Phase 1 — Database

**IN PROGRESS**

Established:

- Neon managed PostgreSQL;
- Prisma `7.10.0`;
- Prisma schema-first migrations;
- Prisma configuration;
- database connectivity;
- UUID primary keys;
- tenant/identity schema foundation;
- Customer → Proof → Revision hierarchy;
- immutable Revision direction.

Current database models:

```text
Organization
User
Membership
Customer
Proof
Revision
```

Current enum:

```text
MembershipRole
```

Current migrations:

```text
20260910064511_init_identity
20260910065333_add_customer_proof_revision
```

Current development branch:

```text
phase-1-database
```

Immediate next architecture work:

```text
Proof status
current revision
Revision tenant ownership/query boundary
Customer deletion semantics
ProofResponse
ProofActivity
ProofDispatch
supporting enums
constraints/indexes
Prisma runtime database utility
```

Do not begin Auth0, S3, public review, or approval routes until the Phase 1 schema foundation is complete.

---

# 3. Current Technology Baseline

## Application

```text
React Router Framework Mode ^8
React ^19.2.7
TypeScript ^5.9.3
Vite ^8.0.3
Tailwind CSS ^4.2.2
```

## Validation

```text
Zod
```

## Database

```text
PostgreSQL
Neon managed PostgreSQL
Prisma 7.10.0
```

## Testing

```text
Vitest
jsdom
Testing Library
```

## Planned integrations

```text
Authentication       Auth0
Object storage       AWS S3
Transactional email  SendGrid
Billing              Stripe
Hosting              Vercel or equivalent
PDF rendering         PDF.js
```

## Current development runtime

```text
Node.js v24.14.1
macOS arm64
```

Exact runtime versions may evolve.

Architecture decisions should not unnecessarily depend on one developer-machine version.

---

# 4. System Architecture

ApproveAProof begins as a modular monolith.

Do not introduce microservices.

The intended architecture is:

```text
                 ┌─────────────────────────┐
                 │      ApproveAProof      │
                 │ React Router / React /  │
                 │ TypeScript application  │
                 └────────────┬────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
       Neon PostgreSQL      AWS S3         SendGrid
          + Prisma       Private Files       Email
              │
              │
              ▼
            Stripe
            Billing

Authentication:
Auth0
```

The application is responsible for:

```text
routing
server rendering
authentication integration
authorization
business/domain logic
database access
presigned S3 authorization
transactional workflow
email dispatch coordination
billing coordination
```

Persistent state belongs primarily in:

```text
PostgreSQL
S3
```

Application processes should remain stateless.

---

# 5. Architectural Principles

## 5.1 One primary relational database

ApproveAProof v1 uses one PostgreSQL database.

Current provider:

```text
Neon
```

Do not reproduce SmartLynx's separate analytics database.

Core operational records belong together:

```text
users
organizations
memberships
customers
proofs
revisions
proof_responses
proof_activities
proof_dispatches
billing/entitlement state
```

If behavioral telemetry later becomes large, it may be exported elsewhere.

That is a scaling problem to earn.

---

## 5.2 Approval data is transactional data

The following are business records:

```text
Proof created
Revision created
Revision sent
Changes requested
Approval received
Approval identity
Approval timestamp
Approved revision
Approval wording
```

They are not best-effort analytics.

Approval and change-request transactions must either completely succeed or completely fail.

---

## 5.3 Revisions are immutable

A customer-visible revision is never overwritten.

Never:

```text
proof.pdf
    ↓ overwrite
proof.pdf
```

Instead:

```text
Revision 1 → object A
Revision 2 → object B
Revision 3 → object C
```

The current Revision model intentionally has no `updatedAt`.

Mutability required for upload processing or lifecycle state must not permit replacement of the underlying finalized artifact after customer presentation.

---

## 5.4 Server owns truth

The browser must never be trusted to determine:

- organization ownership;
- subscription entitlement;
- S3 object path;
- revision number;
- current revision;
- approved revision;
- proof state;
- approval timestamp;
- customer authorization scope.

The browser submits intent.

The server determines truth.

---

## 5.5 Tenant isolation is structural

Tenant security must not depend on a developer remembering to add one filter.

Schema relationships, service APIs, authorization helpers, and tests should make tenant-scoped access the natural path.

---

## 5.6 Historical evidence outranks convenience

Once a revision has been sent or a response has been recorded, convenience features must not rewrite the historical record.

Corrections should generally produce new records.

---

# 6. Tenant Model

ApproveAProof is multi-tenant from day one.

The tenant is:

```text
Organization
```

A human application identity is:

```text
User
```

Membership is represented through:

```text
Membership
```

Conceptually:

```text
User
 │
 │ Membership
 ▼
Organization
 │
 ├── Customers
 ├── Proofs
 ├── Branding
 ├── Subscription
 └── Team Members
```

A User may belong to more than one Organization.

This prevents future team support from requiring a fundamental schema migration.

---

# 7. Current Prisma Foundation

The following schema has already been implemented and migrated.

## MembershipRole

```prisma
enum MembershipRole {
  OWNER
  ADMIN
  MEMBER
}
```

`MEMBER` currently represents a normal operational organization member.

Authorization behavior is not yet implemented.

---

## Organization

```prisma
model Organization {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
  customers   Customer[]
  proofs      Proof[]
}
```

Current responsibilities:

- tenant identity;
- organization name;
- stable slug;
- ownership boundary.

Later organization-level responsibilities include:

- branding;
- approval defaults;
- billing;
- plan state;
- subscription state.

---

## User

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  auth0Subject String   @unique
  email        String   @unique
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships Membership[]
}
```

`auth0Subject` will store the stable Auth0 `sub`.

Application business permissions do not belong solely in Auth0 metadata.

---

## Membership

```prisma
model Membership {
  id             String         @id @default(uuid()) @db.Uuid
  organizationId String         @db.Uuid
  userId         String         @db.Uuid
  role           MembershipRole @default(MEMBER)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  organization Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  user User @relation(
    fields: [userId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
}
```

The unique constraint prevents duplicate membership in the same organization.

---

## Customer

```prisma
model Customer {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  name           String
  email          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  proofs Proof[]

  @@index([organizationId])
}
```

Customer remains intentionally small.

It must not casually evolve into a CRM.

---

## Proof

Current first-pass schema:

```prisma
model Proof {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  customerId     String   @db.Uuid
  title          String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  customer Customer @relation(
    fields: [customerId],
    references: [id],
    onDelete: Restrict
  )

  revisions Revision[]

  @@index([organizationId])
  @@index([customerId])
}
```

This model is deliberately incomplete.

Before Phase 1 is complete we must finalize:

```text
status
jobNumber
recipient snapshots
currentRevision
review token relationship
workflow timestamps
createdByUserId
historical Customer deletion behavior
```

---

## Revision

Current first-pass schema:

```prisma
model Revision {
  id        String   @id @default(uuid()) @db.Uuid
  proofId   String   @db.Uuid
  number    Int
  fileKey   String
  fileName  String
  fileType  String
  fileSize  Int
  fileHash  String
  createdAt DateTime @default(now())

  proof Proof @relation(
    fields: [proofId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([proofId, number])
  @@index([proofId])
}
```

The Revision represents one immutable artifact.

Current semantic meaning:

```text
number    revision number within one Proof
fileKey   storage object identity
fileName  original/display filename
fileType  MIME/type metadata
fileSize  byte size
fileHash  cryptographic file fingerprint, intended SHA-256
```

`fileSize Int` is acceptable while supported upload limits remain far below PostgreSQL's integer range.

The model may be expanded before Phase 1 completion with:

```text
organizationId
status
s3ETag
s3VersionId
approvalStatementSnapshot
checklistSnapshot
reviewFingerprint
createdByUserId
readyAt
sentAt
supersededAt
```

These fields should be added only after their lifecycle semantics are deliberate.

---

# 8. UUID Identifier Strategy

Current foundational models use:

```text
PostgreSQL UUID
```

through:

```prisma
@default(uuid()) @db.Uuid
```

Do not switch casually between UUIDs, CUIDs, auto-incrementing integers, or provider-specific IDs.

External provider identifiers such as:

```text
Auth0 subject
Stripe customer ID
Stripe subscription ID
S3 key
```

remain separate values.

---

# 9. Prisma Configuration

Current Prisma version:

```text
7.10.0
```

Prisma 8 release-candidate packages were deliberately rejected during setup.

Current project configuration:

```text
prisma.config.ts
prisma/schema.prisma
prisma/migrations/
generated/prisma/
```

Generated Prisma Client output is intentionally ignored by Git.

`prisma.config.ts` reads:

```text
DATABASE_URL
```

through Prisma configuration.

The database URL is not embedded in the Prisma schema.

---

# 10. Prisma Runtime Client

## REQUIRED BEFORE PHASE 1 COMPLETION

Prisma 7 runtime PostgreSQL access requires the appropriate driver-adapter architecture.

Before application database queries are introduced, configure the runtime database utility using the supported PostgreSQL adapter.

Likely packages:

```text
@prisma/adapter-pg
pg
@types/pg
```

The application should expose a server-only database module such as:

```text
app/services/db.server.ts
```

or another deliberate server-only location.

Requirements:

- never import database client code into the browser bundle;
- avoid creating uncontrolled client/pool instances during development hot reload;
- centralize database construction;
- make future instrumentation straightforward.

This work belongs in Phase 1.

---

# 11. Database Development Workflow

ApproveAProof owns a new application database.

Normal workflow:

```text
edit prisma/schema.prisma
        ↓
npx prisma validate
        ↓
npx prisma migrate dev --name <migration>
        ↓
verify migration
        ↓
run tests/quality checks as appropriate
        ↓
commit schema + migration together
```

Do not use:

```text
prisma db pull
```

as the normal development process.

Database introspection was used once to verify Neon connectivity and correctly returned an empty-database result.

The schema and migration history are authoritative.

---

# 12. Managed PostgreSQL

Current provider:

```text
Neon
```

Reasons for selection include:

- independent managed PostgreSQL;
- compatibility with Prisma;
- serverless-friendly pooled connections;
- scale-to-zero characteristics;
- database branching capabilities;
- good fit for early SaaS usage;
- avoids coupling both ORM and database hosting to one vendor.

Binary proof files do not belong in Neon.

They belong in S3.

PostgreSQL stores metadata and operational records.

---

# 13. Migration History

Current applied migrations:

```text
20260910064511_init_identity
20260910065333_add_customer_proof_revision
```

Both have been successfully applied to the ApproveAProof Neon database.

The database is synchronized with the current schema.

Migration files must remain committed.

Never edit an already-shared/applied historical migration merely to make it look cleaner.

New schema changes receive new migrations.

---

# 14. Proof and Revision Separation

A `Proof` represents an ongoing approval process.

Example:

```text
Johnson Dental Brochure
Job #10482
```

A Proof contains revisions:

```text
Revision 1
Revision 2
Revision 3
```

Customer behavior may be:

```text
Revision 1 → Request Changes
Revision 2 → Request Changes
Revision 3 → Approve
```

The Proof can become:

```text
APPROVED
```

but authoritative approval evidence points specifically to:

```text
Revision 3
```

Proof-level status is operational state.

Revision-level response history is evidence.

Do not confuse the two.

---

# 15. Proof State Machine

## LOCKED DOMAIN DIRECTION

Required Proof states:

```text
DRAFT
AWAITING_APPROVAL
CHANGES_REQUESTED
APPROVED
CANCELED
```

Normal transitions:

```text
DRAFT
  ↓ send
AWAITING_APPROVAL

AWAITING_APPROVAL
  ↓ request changes
CHANGES_REQUESTED

CHANGES_REQUESTED
  ↓ create new revision
DRAFT

DRAFT
  ↓ send
AWAITING_APPROVAL

AWAITING_APPROVAL
  ↓ approve
APPROVED
```

Cancelable states:

```text
DRAFT
AWAITING_APPROVAL
CHANGES_REQUESTED
```

may transition to:

```text
CANCELED
```

Invalid transitions include:

```text
APPROVED → CHANGES_REQUESTED
CANCELED → APPROVED
```

State transitions belong in domain functions.

Application routes must not arbitrarily write Proof status.

**Implementation status:** The enum and Proof status field are not yet migrated.

This is the immediate next schema task.

---

# 16. Current Revision Relationship

## REQUIRED BEFORE PHASE 1 COMPLETION

The Proof must identify which Revision is currently authoritative for customer review.

Conceptually:

```text
Proof
  │
  ├── revisions[]
  │
  └── currentRevision → Revision
```

The relationship must support:

- customer review;
- stale-tab rejection;
- sending revisions;
- requesting changes;
- approval validation.

Critical rule:

> `currentRevisionId` is not itself approval evidence.

Approval must still reference the exact Revision through a ProofResponse.

The Prisma relationship must ensure the referenced Revision logically belongs to the same Proof.

Because a plain foreign key from `Proof.currentRevisionId → Revision.id` cannot by itself prove same-Proof ownership, application/domain validation and/or an appropriate relational design must enforce this invariant.

Do not finalize this relationship casually.

---

# 17. Revision Tenant Isolation Decision

## OPEN PHASE 1 ARCHITECTURE DECISION

Current Revision reaches Organization through:

```text
Revision
  ↓
Proof
  ↓
Organization
```

Before Phase 1 completion, explicitly decide whether Revision should additionally contain:

```text
organizationId
```

Benefits:

- direct tenant-scoped queries;
- safer authorization boundaries;
- easier S3/upload lookups;
- simpler compound ownership conditions;
- reduced risk of querying a Revision by ID alone.

Cost:

- duplicated relational ownership data;
- additional invariant requiring Revision.organizationId to agree with Proof.organizationId.

Because Revision will be used heavily by security-sensitive upload and review operations, explicit tenant ownership may be worthwhile.

This decision must be made before the schema becomes broadly depended upon.

---

# 18. Customer Deletion Semantics

## OPEN PHASE 1 ARCHITECTURE DECISION

Current schema:

```text
Customer → Proof
onDelete Restrict
```

Long-term product architecture requires historical approval records to survive ordinary customer/contact cleanup.

A likely final direction is:

```text
Proof.customerId nullable
Customer deletion → SetNull
Proof stores recipient/customer snapshots
```

Potential snapshots:

```text
recipientName
recipientEmail
customer/company name where required
```

Before Phase 1 completion, choose the historical-data strategy deliberately.

Do not allow deleting a mutable Customer record to destroy approval evidence.

---

# 19. Revision Allocation

Every Revision has an integer revision number:

```text
1
2
3
4
```

Numbers are assigned server-side.

Never trust a browser-submitted authoritative revision number.

Two concurrent uploads must never both create Revision 4.

Current database protection:

```text
@@unique([proofId, number])
```

Application creation must additionally use a safe transaction/locking strategy.

Conceptually:

```text
lock Proof
determine next revision number
create Revision
commit
```

The unique constraint remains final protection against race conditions.

---

# 20. File Integrity

Current field:

```text
Revision.fileHash
```

Intended algorithm:

```text
SHA-256
```

Do not treat an S3 ETag as equivalent to file SHA-256.

The file hash identifies the exact bytes presented as the revision artifact.

Potential later naming change:

```text
fileHash → sha256
```

may be considered before upload architecture stabilizes, but naming is secondary to semantics.

---

# 21. Review Fingerprint

A READY revision should eventually receive a deterministic review fingerprint derived from what the customer is actually reviewing.

Conceptually:

```text
SHA256(
  file SHA-256
  +
  approval statement snapshot
  +
  canonical checklist
  +
  revision identity
)
```

Store:

```text
Revision.reviewFingerprint
```

When approved, copy it to:

```text
ProofResponse.reviewFingerprintSnapshot
```

This links:

```text
file
+
revision
+
approval wording
+
checklist
+
customer decision
```

This is an integrity mechanism.

Do not market it as:

```text
blockchain
legal cryptographic certification
electronic-signature certification
```

without appropriate review.

---

# 22. Planned Core Domain Models

Before Phase 1 is complete, the relational shape should support the following models.

## ProofResponse

Authoritative customer decision.

Types:

```text
APPROVED
CHANGES_REQUESTED
```

Expected responsibilities:

```text
proofId
revisionId
type

responderName
responderEmail

comments

privacy-conscious network metadata
userAgent

approvalStatementSnapshot
checklistSnapshot
reviewFingerprintSnapshot

occurredAt
```

The response must reference a specific Revision.

---

## ProofActivity

Operational timeline.

Potential event types:

```text
PROOF_CREATED
REVISION_CREATED
REVISION_READY
PROOF_SENT
PROOF_VIEWED
CHANGES_REQUESTED
REVISION_SUPERSEDED
PROOF_APPROVED
REMINDER_SENT
PROOF_CANCELED
REVIEW_LINK_REGENERATED
```

Activity exists for timeline/history presentation.

It is not the authoritative substitute for ProofResponse.

---

## ProofDispatch

Transactional communication/outbox record.

Potential types:

```text
INITIAL_PROOF
REVISION
REMINDER
APPROVAL_CONFIRMATION
CHANGE_REQUEST_NOTIFICATION
```

Potential statuses:

```text
PENDING
SENT
FAILED
```

Expected operational fields:

```text
recipient
revision
attemptCount
lastError
scheduledAt
sentAt
createdAt
```

ProofDispatch provides retryable email behavior without coupling email success to approval integrity.

---

# 23. Approval Record Model Principle

Approval is not:

```text
proof.approved = true
```

Approval is represented by:

```text
ProofResponse
type = APPROVED
proofId = exact Proof
revisionId = exact Revision
occurredAt = server timestamp
```

Proof may additionally carry:

```text
status = APPROVED
approvedAt
```

for efficient operational queries.

Those Proof fields are derived/current workflow state.

The ProofResponse is the authoritative customer decision record.

---

# 24. Approval Transaction

Approval must execute transactionally.

Conceptually:

```text
BEGIN

lock Proof

verify:
  proof exists
  proof status == AWAITING_APPROVAL
  submitted revision == current revision
  revision belongs to proof
  revision status == READY
  revision was sent
  proof not canceled
  proof not conflictingly approved

create APPROVED ProofResponse

snapshot:
  responder
  revision identity
  approval statement
  checklist
  review fingerprint
  server timestamp

update Proof:
  status = APPROVED
  approvedAt = server timestamp

create ProofActivity:
  PROOF_APPROVED

create ProofDispatch:
  PENDING

COMMIT
```

Email occurs after the authoritative transaction.

SendGrid failure must never erase or roll back a valid approval.

---

# 25. Stale Revision Protection

Critical scenario:

```text
Monday:
Customer opens Revision 2.

Tuesday:
Shop sends Revision 3.

Wednesday:
Customer returns to old Revision 2 tab
and clicks Approve.
```

The server must reject the approval.

Expected behavior:

> A newer proof is available. Revision 3 replaced the version you were reviewing. Please review the latest revision before approving.

Never:

- silently substitute Revision 3;
- approve Revision 2 after it is no longer current;
- infer that reviewing an older revision constitutes approval of a newer one.

The submitted revision must match the current review revision.

---

# 26. Duplicate Approval Protection

Network retries, double clicks, browser retries, and bot behavior must not create duplicate approval records.

Approval should be idempotent for an already-completed identical decision where appropriate.

Example:

```text
same Proof
same Revision
already APPROVED
```

may return the existing successful state.

A conflicting request must be rejected.

Database constraints and transactional application logic should work together.

---

# 27. Request Changes Transaction

Customer provides:

```text
name
required comments
```

Server transaction:

```text
lock Proof

verify:
  proof is awaiting approval
  submitted revision is current
  revision belongs to proof

create CHANGES_REQUESTED ProofResponse

update Proof:
  status = CHANGES_REQUESTED

create ProofActivity

create notification ProofDispatch

commit
```

Notification processing happens after the authoritative transaction.

---

# 28. Historical Immutability

After customer presentation, ordinary application APIs should not rewrite:

```text
revision number
file identity
file hash
approval wording snapshot
checklist snapshot
review fingerprint
sent timestamp
```

After customer response, ordinary APIs should not rewrite:

```text
response type
response revision
responder identity
server timestamp
approval snapshot
review fingerprint snapshot
```

Corrections should create new records or explicit correction events.

Do not mutate history invisibly.

---

# 29. S3 Architecture

Files are private.

The server creates storage keys.

Recommended structure:

```text
proofs/
  {organizationId}/
    {proofId}/
      {revisionId}/
        original.<extension>
```

Example:

```text
proofs/
  7f.../
    1a.../
      9c.../
        original.pdf
```

Never use customer-provided filenames as authoritative key paths.

Current Revision schema already separates:

```text
fileKey
```

from:

```text
fileName
```

which supports this model.

---

# 30. S3 Security

Production requirements:

```text
Public access:
BLOCKED

Object ACLs:
DISABLED

Encryption:
ENABLED

Versioning:
PREFERRED
```

Application IAM must follow least privilege.

Do not grant:

```text
s3:*
```

across the account.

Development and production storage should use separate buckets or strongly separated environments/credentials.

---

# 31. Direct Upload Architecture

Do not stream normal proof files through the application server.

Workflow:

```text
Browser
   │
   │ Request upload
   ▼
ApproveAProof Server
   │
   ├── authenticate
   ├── resolve tenant
   ├── authorize Proof
   ├── validate entitlement
   ├── validate file metadata
   ├── allocate Revision
   ├── create storage key
   └── generate presigned upload
   │
   ▼
Browser ─────────────→ S3
   │
   │ finalize
   ▼
ApproveAProof Server
   │
   ├── reauthenticate/authorize
   ├── HeadObject
   ├── verify expected object
   ├── verify size
   ├── verify checksum/integrity
   └── mark Revision READY
```

This keeps application servers stateless and avoids unnecessary bandwidth.

---

# 32. Upload Authorization Order

The SmartLynx implementation taught an important lesson:

> Do not create valuable upload authorization before plan and tenant authorization have succeeded.

Required order:

```text
authenticate
resolve Organization
authorize Proof
check entitlement
validate metadata
allocate server-owned Revision/key
create presigned upload
```

A free or unauthorized account must not be able to create arbitrary orphaned S3 objects by bypassing UI gating.

---

# 33. Upload Validation

Initial supported types:

```text
application/pdf
image/jpeg
image/png
```

Initially reject:

```text
SVG
HTML
PSD
AI
ZIP
EXE
Office documents
```

Validate before signing:

```text
authenticated membership
tenant ownership
plan entitlement
file size
declared MIME
filename/extension consistency
proof state
```

Validate after upload:

```text
expected key
object exists
object size
checksum/integrity
metadata consistency
```

Do not trust only:

```text
browser MIME
browser filename
browser storage key
browser organizationId
```

---

# 34. File Hashing

For supported proof sizes, SHA-256 may be computed client-side using Web Crypto before upload.

Browser may submit:

```text
filename
size
mime
sha256
```

The server treats this as expected metadata, not unquestioned truth.

Where practical:

- bind expected checksum into upload;
- verify with S3/finalization;
- persist the validated SHA-256.

If S3 checksum validation creates disproportionate MVP complexity, retain the schema and perform final verification through a controlled post-upload process.

Do not replace SHA-256 with ETag.

---

# 35. Revision Upload Lifecycle

Likely Revision states:

```text
UPLOADING
PROCESSING
READY
SUPERSEDED
```

Only:

```text
READY
```

revisions may be sent to a customer.

Unfinalized uploads become cleanup candidates.

Initial orphan-cleanup hypothesis:

```text
24 hours
```

Exact timing may change.

---

# 36. Malware Architecture

Full antivirus scanning is not required for initial product validation.

Risk is reduced by limiting formats to:

```text
PDF
JPEG
PNG
```

Requirements:

- keep PDF.js current;
- disable PDF JavaScript behavior;
- reject SVG initially;
- never render arbitrary uploaded HTML;
- use strict CSP;
- serve binary proof content from private object storage.

Future architecture may add:

```text
scanStatus
PENDING
CLEAN
INFECTED
FAILED
```

without changing the core Proof → Revision relationship.

---

# 37. Public Review Tokens

Review URLs are bearer credentials.

Example:

```text
https://approveaproof.app/review/{token}
```

Token requirements:

```text
cryptographically secure
at least 32 random bytes
URL-safe encoding
```

Never store the raw token.

Persist:

```text
SHA256(token)
```

Lookup:

```text
hash incoming token
query stored hash
```

Never log:

```text
raw review token
full review URL containing token
```

Review links must be regeneratable.

Regeneration invalidates the old token.

---

# 38. Review Token Ownership

A review token grants access to one limited customer-facing Proof context.

It does not constitute:

```text
organization membership
general customer account
staff authorization
access to unrelated Proofs
access to billing/settings
```

The token must resolve only the data required for the review workflow.

---

# 39. Signed File URLs

S3 objects remain private.

After review-token validation:

```text
resolve Proof
validate state
resolve current Revision
generate short-lived signed GET URL
```

Initial target lifetime:

```text
5–15 minutes
```

Signed URLs may be refreshed as needed.

Never persist long-lived public object URLs.

---

# 40. PDF Rendering

Use PDF.js.

Requirements:

- current maintained version;
- self-controlled worker assets where practical;
- embedded JavaScript disabled;
- uploaded content does not execute in application origin;
- strict CSP;
- external PDF links considered untrusted.

JPEG/PNG may use normal `<img>` rendering with signed S3 URLs.

Avoid unrestricted uploaded-content iframe behavior.

---

# 41. Public Review UI

The review page should contain only necessary customer tasks.

```text
SHOP LOGO / IDENTITY

Proof title
Job number
Revision number

[ PROOF VIEWER ]

Review checklist

[ APPROVE FOR PRODUCTION ]

[ REQUEST CHANGES ]
```

No:

```text
customer login requirement
application dashboard navigation
advertising
marketing clutter
third-party behavioral trackers
```

---

# 42. Customer Review Privacy

Public proof pages must use strong privacy controls.

Expected:

```text
noindex
nofollow
noarchive
```

Recommended header:

```text
Referrer-Policy: no-referrer
```

Never include review URLs in:

```text
sitemaps
marketing analytics
third-party tracking
logs
```

---

# 43. Customer Review Mobile Priority

The customer review flow must be excellent on phones.

Minimum requirements:

```text
large tap targets
readable typography
easy PDF page navigation
obvious revision number
obvious approval/change actions
no hover-only behavior
```

Customer mobile UX is more important than perfect mobile parity for the internal dashboard.

---

# 44. Approval UX

Approval should require deliberate confirmation.

Step one:

```text
APPROVE FOR PRODUCTION
```

Step two:

```text
Approve Revision 3?

Name:
[ John Smith ]

☑ I have reviewed this proof and approve
  this revision for production.

[ CONFIRM APPROVAL ]
```

The displayed approval wording must be snapshotted into the authoritative response.

---

# 45. Approval Identity

Customer accounts are not required for v1.

Capture:

```text
typed responder name
known recipient email where applicable
server timestamp
Proof ID
Revision ID
file SHA-256
approval statement snapshot
checklist snapshot
review fingerprint
user agent
privacy-conscious network/security metadata
```

Do not market this as a legally binding electronic-signature system without legal review.

Preferred positioning:

> **Documented approval record**

---

# 46. Email Architecture

SendGrid is the planned transactional email provider.

Expected templates:

```text
Proof Ready
Revised Proof Ready
Changes Requested
Approval Received
Approval Confirmation
Reminder
```

Example sender presentation:

```text
ABC Printing via ApproveAProof
```

Reply-To may use the shop's configured address.

Do not permit arbitrary From-domain spoofing.

---

# 47. Transactional Dispatch / Outbox

Core transactions must not depend synchronously on SendGrid.

Pattern:

```text
business transaction
       ↓
ProofDispatch PENDING
       ↓
email processor
       ↓
 ┌───────────┐
 ▼           ▼
SENT       FAILED
             ↓
            retry
```

Potential fields:

```text
attemptCount
lastError
scheduledAt
sentAt
```

Email retries must be bounded and idempotent.

---

# 48. Scheduled Jobs

V1 likely needs scheduled work for:

```text
automatic reminders
failed email retries
orphan upload cleanup
retention cleanup
```

Do not introduce Redis, SQS, Kafka, or a standalone worker platform only for this.

Initial architecture may use protected scheduled endpoints or hosting-provider jobs.

Examples:

```text
/internal/jobs/reminders
/internal/jobs/email-retries
/internal/jobs/upload-cleanup
```

Jobs must be:

```text
authenticated
idempotent
retry-safe
```

---

# 49. Reminder Logic

Initial cadence hypothesis:

```text
24 hours
72 hours
```

Before each reminder:

```text
verify Proof.status == AWAITING_APPROVAL
verify Revision is still current
verify Proof not canceled
verify Proof not approved
```

Never send a stale approval reminder after the customer has already responded.

---

# 50. Application Route Direction

Conceptual React Router structure:

```text
/
auth routes

/app
/app/proofs
/app/proofs/new
/app/proofs/:proofId

/app/customers
/app/customers/:customerId

/app/settings
/app/settings/business
/app/settings/branding
/app/settings/approval
/app/settings/billing
/app/settings/team

/review/:token

/api/uploads/presign
/api/uploads/finalize

/api/stripe/webhook

/internal/jobs/reminders
/internal/jobs/email-retries
/internal/jobs/upload-cleanup
```

This is conceptual URL architecture.

Exact route filenames must follow the actual React Router Framework Mode project conventions.

Do not copy old Remix 2 route naming mechanically.

---

# 51. Server Module Organization

Preferred conceptual structure:

```text
app/
├── routes/
│
├── domain/
│   ├── proofs/
│   │   ├── proof-state.server.ts
│   │   ├── approval.server.ts
│   │   └── revisions.server.ts
│   │
│   ├── plans/
│   │   └── entitlements.server.ts
│   │
│   └── permissions/
│       └── permissions.server.ts
│
├── models/
│   ├── user.server.ts
│   ├── organization.server.ts
│   ├── membership.server.ts
│   ├── customer.server.ts
│   ├── proof.server.ts
│   ├── revision.server.ts
│   ├── response.server.ts
│   └── dispatch.server.ts
│
├── services/
│   ├── env.server.ts
│   ├── db.server.ts
│   ├── auth.server.ts
│   ├── storage.server.ts
│   ├── email.server.ts
│   ├── billing.server.ts
│   ├── hashing.server.ts
│   └── rate-limit.server.ts
│
└── components/
```

The exact directory structure can evolve.

Responsibilities should remain separated.

---

# 52. React Router Server Boundaries

Current project already contains:

```text
app/services/env.server.ts
```

Server-only modules must flow only through server execution paths.

Examples:

```text
loader
action
middleware
headers
other .server.ts modules
```

Never import secrets, database clients, AWS credentials, Stripe secrets, Auth0 secrets, or SendGrid secrets into client-bundle code.

`.server.ts` naming helps express intent but does not excuse careless dependency flow.

---

# 53. Thin Routes

Routes should coordinate.

They should not become the entire application architecture.

Bad:

```text
route:
  authentication
  permission checks
  database queries
  S3
  Stripe
  email
  proof transition
  validation
  UI
```

Preferred:

```text
route
  ↓
validate input
  ↓
authenticate
  ↓
authorize
  ↓
call domain/service
  ↓
return response
```

State-machine and approval correctness belong in reusable server/domain logic.

---

# 54. Authentication

Auth0 remains the planned v1 authentication provider.

Reason:

- mature;
- previously understood;
- authentication is not product differentiation;
- avoids unnecessary infrastructure reinvention.

Identity flow:

```text
Auth0 identity
      ↓
User.auth0Subject
      ↓
ApproveAProof User
      ↓
Membership
      ↓
Organization
```

The underlying User/Organization/Membership database models already exist.

Auth0 integration belongs to Phase 2.

---

# 55. Authorization Model

Every authenticated operation follows:

```text
authenticate User
        ↓
resolve Membership
        ↓
resolve Organization
        ↓
authorize Resource
        ↓
perform Action
```

Never trust:

```text
organizationId
customerId
proofId
revisionId
```

from the browser as sufficient authorization evidence.

Identifiers identify requested objects.

They do not prove access rights.

---

# 56. Tenant Query Boundary

Never write an authenticated tenant operation equivalent to:

```text
find Proof where id = suppliedId
```

when organization ownership matters.

Prefer explicit organization-scoped access patterns such as:

```text
Proof.id = requestedId
AND
Proof.organizationId = authorizedOrganizationId
```

For child resources such as Revision, ensure ownership resolution is equally explicit.

Cross-tenant access must fail even when the attacker knows a valid UUID.

---

# 57. Roles

Current database roles:

```text
OWNER
ADMIN
MEMBER
```

Expected direction:

## OWNER

```text
all operational actions
billing
organization administration
team management
ownership-sensitive operations
```

## ADMIN

```text
proofs
customers
most settings
team administration where allowed
```

## MEMBER

```text
proofs
customers
revisions
ordinary workflow actions as allowed
```

Exact permission mapping belongs to Phase 2.

The MVP UI may initially expose only OWNER behavior.

The server should still be designed around explicit permissions.

---

# 58. Session Security

Session cookies should use appropriate:

```text
HttpOnly
Secure
SameSite
```

settings.

Authenticated mutations require robust CSRF/origin protection appropriate to the final Auth0/session architecture.

Sessions should be rotated where authentication transitions warrant it.

Public review actions use bearer-token authorization rather than staff sessions but should still receive request-origin and abuse protections where appropriate.

---

# 59. Input Validation

Server actions validate all untrusted inputs.

Examples:

```text
emails
names
UUIDs
proof titles
job numbers
comments
file metadata
colors
URLs
billing inputs
```

Set maximum lengths.

Potential examples:

```text
proof title     <= 200
job number      <= 100
customer name   <= 200
change request  <= 5000
```

Exact values may change.

Zod is the current preferred application validation library.

Never store arbitrary HTML from customer input.

Avoid `dangerouslySetInnerHTML` for customer-controlled data.

---

# 60. Rate Limiting

Rate-limit sensitive operations including:

```text
authentication-related endpoints
review-token lookup
approval submission
request changes
presigned uploads
email resend
manual reminders
review-link regeneration
```

Use combinations of:

```text
IP
user
organization
proof
```

Do not rely exclusively on IP because multiple legitimate users may share one public address.

---

# 61. Content Security Policy

CSP should be introduced before uncontrolled third-party integrations accumulate.

Restrict:

```text
default-src
script-src
connect-src
img-src
frame-src
object-src
```

to required origins.

Customer review routes deserve especially strict treatment because they contain sensitive operational content.

Do not add advertising trackers to `/review/*`.

---

# 62. Logging

Use structured logging.

Safe identifiers may include:

```text
requestId
organizationId
proofId
revisionId
userId
event
status
duration
```

Never log:

```text
review tokens
signed S3 URLs
Auth0 tokens
session secrets
DATABASE_URL
AWS secret keys
Stripe secrets
SendGrid keys
```

Avoid logging proof comments or customer content unless specifically required.

Use request correlation IDs.

---

# 63. Environment and Secret Management

Current `.env.example` defines the expected configuration surface.

Current local `.env` is ignored by Git.

Secrets include:

```text
DATABASE_URL
AUTH0_CLIENT_SECRET
SESSION_SECRET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
SENDGRID_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Never commit them.

Separate:

```text
development
preview/staging
production
```

credentials.

Any credential inherited from SmartLynx should be rotated before production use rather than copied blindly.

---

# 64. Current Environment Validation

Environment validation exists in:

```text
app/services/env.server.ts
```

using Zod.

Current philosophy:

- configuration shape is defined centrally;
- required-at-current-stage variables fail clearly;
- future integration variables may remain optional until their phase;
- environment validation stays server-only.

As integrations become active, variables required for that environment should become appropriately mandatory.

Do not keep critical production configuration silently optional forever.

---

# 65. Stripe Architecture

Billing belongs to:

```text
Organization
```

not:

```text
User
```

Stripe becomes authoritative for payment state.

ApproveAProof stores cached application state based on verified webhook events.

Requirements:

```text
verify Stripe signature
process events idempotently
never trust browser subscription state
protect against duplicate webhook events
```

Billing implementation belongs to a later phase.

Do not put provisional Stripe fields into every early model merely because they will eventually exist.

---

# 66. Entitlements

Plan logic must be centralized.

Potential API:

```text
getOrganizationEntitlements()

canCreateProof()
canSendProof()
canAddTeamMember()
canUseBranding()
canUseReminders()

maxMonthlyProofSends()
maxFileSize()
maxTeamMembers()
```

Never scatter:

```text
if plan === "PRO"
```

through routes.

UI gating is presentation.

Server enforcement is authoritative.

Upload authorization must occur only after entitlement validation.

---

# 67. Pricing Architecture

Potential internal plan names:

```text
FREE
STARTER
SHOP
```

These remain hypotheses.

Do not let hypothetical pricing block the core workflow.

Do not prematurely migrate pricing-related schema until needed unless doing so solves a concrete architectural requirement.

---

# 68. Usage Accounting

Likely authoritative usage event:

> **A proof send occurs when a new revision is successfully sent to a customer for review.**

Reminder emails should not count as new proof sends.

ProofDispatch may provide the auditable basis for usage.

At high volume, monthly aggregate counters may be added.

Do not create speculative counters before actual query pressure exists.

---

# 69. Customer Data and Historical Evidence

Mutable Customer records are convenience/business entities.

Historical proof evidence must not depend on the continued existence or unchanged contents of a Customer record.

Proofs should ultimately snapshot relevant recipient information:

```text
recipientName
recipientEmail
```

Potentially other historical display fields may also be snapshotted if needed.

Customer deletion must not silently erase proof/approval history.

This requirement directly informs the open Phase 1 Customer deletion decision.

---

# 70. Approval Record PDF

A downloadable approval record is near-MVP/post-core-work.

Potential contents:

```text
APPROVEAPROOF
PROOF APPROVAL RECORD

Organization
Customer
Proof
Job Number
Approved Revision
Filename
SHA-256
Approved By
Approved At
Approval Statement
Checklist
Review Fingerprint

APPROVED FOR PRODUCTION
```

Generate server-side from authoritative database records.

The PDF is a representation.

The database remains the source of truth.

---

# 71. Dashboard Architecture

The dashboard is an operational queue.

Its primary question is:

> **What is holding up production?**

Likely top-level indicators:

```text
Awaiting Approval
Changes Requested
Approved Today
```

Primary work section:

```text
NEEDS ATTENTION
```

Do not design the dashboard primarily as a file browser.

---

# 72. Proof List Queries

Likely filters:

```text
All
Awaiting Approval
Changes Requested
Approved
Draft
```

Pagination should exist from the beginning.

Do not load an organization's entire history into memory.

Likely access pattern:

```text
WHERE organizationId = ?
AND status = ?
ORDER BY updatedAt DESC
LIMIT ...
```

Final Phase 1 schema should include indexes supporting real operational queries.

---

# 73. Database Index Strategy

Current indexes:

```text
Membership:
  organizationId
  userId
  UNIQUE organizationId + userId

Customer:
  organizationId

Proof:
  organizationId
  customerId

Revision:
  proofId
  UNIQUE proofId + number
```

Expected later access patterns:

```text
Proof:
  organizationId + status
  organizationId + createdAt / updatedAt

Revision:
  proofId + number
  possibly organizationId + proofId

ProofResponse:
  proofId + occurredAt
  revisionId

ProofActivity:
  proofId + occurredAt

ProofDispatch:
  status + scheduledAt
  proofId + createdAt
```

Create indexes for actual access patterns.

Do not create indexes mechanically on every column.

---

# 74. PostgreSQL Scalability

Do not:

```text
shard
create one database per organization
store proof binaries as database BLOBs
```

PostgreSQL should comfortably support foreseeable v1 scale.

Use:

- appropriate pooling;
- tenant-aware indexes;
- pagination;
- transactions;
- selective relation loading;
- avoidance of N+1 query patterns.

Neon's pooled endpoint is the current connection direction.

---

# 75. Application Scalability

Application instances should remain stateless.

Persistent state:

```text
Neon PostgreSQL
AWS S3
```

Files upload directly to S3.

Email work is retryable.

Scheduled jobs are idempotent.

Any application instance should be able to handle any request.

Never store authoritative state only in process memory.

---

# 76. Caching

Do not introduce Redis simply because large systems use Redis.

Most authenticated workflow state should be current.

Potential future Redis use cases:

```text
distributed rate limiting
heavy repeat caching
specialized job infrastructure
```

Add it only when measurement justifies it.

---

# 77. Backups and Recovery

Before meaningful production usage:

## PostgreSQL

Require:

```text
automatic backups
point-in-time recovery where available
documented restore procedure
actual restore testing
```

Current provider:

```text
Neon
```

## S3

Require:

```text
encryption
versioning where appropriate
lifecycle rules
```

A backup strategy that has never been restore-tested is not proven.

---

# 78. Monitoring

Before meaningful production use, monitor:

```text
HTTP failures
database failures
upload failures
approval failures
SendGrid failures
Stripe webhook failures
scheduled job failures
S3 failures
latency
```

Add exception monitoring such as Sentry or equivalent.

High-priority alerts:

```text
approval endpoint failure
Stripe webhook repeated failure
email dispatch backlog
scheduled job not running
```

---

# 79. Accessibility

Target solid WCAG AA fundamentals.

Requirements:

```text
semantic controls
keyboard access
visible focus
adequate contrast
labels
associated form errors
status not conveyed only by color
```

The public review experience deserves special accessibility attention because customer reviewers may have widely varying technical skill and device capability.

---

# 80. Security Test Requirements

Before public launch, automated testing should verify:

```text
User cannot access another Organization.

User cannot presign an upload for another Organization.

Browser cannot choose an arbitrary S3 key.

Cross-tenant Customer IDs are rejected.

Cross-tenant Proof IDs are rejected.

Cross-tenant Revision IDs are rejected.

Customer cannot access another Proof by manipulating an identifier.

Raw review tokens are not exposed through internal APIs.

Regenerated review link invalidates old token.

Customer cannot approve a stale Revision.

Customer cannot approve a canceled Proof.

Customer cannot approve an unsent Revision.

Approved Revision artifact cannot be overwritten.

Concurrent Revision creation cannot duplicate revision numbers.

Duplicate approval submission does not create duplicate approval evidence.

SendGrid failure does not erase approval.

UI billing restrictions cannot be bypassed with direct server requests.

Unauthorized/free accounts cannot create unlimited orphan uploads.

Browser cannot manipulate storage path with malicious filenames.

HTML/SVG uploads are rejected.

Oversized files are rejected.

Reminder cannot send after approval.

Internal scheduled endpoints require authentication.
```

Tenant isolation tests are mandatory, not optional polish.

---

# 81. Domain Logic Tests

Domain/state-machine tests matter more than UI snapshots.

Examples:

```text
DRAFT → send → AWAITING_APPROVAL

AWAITING_APPROVAL → request changes → CHANGES_REQUESTED

CHANGES_REQUESTED → new revision → DRAFT

AWAITING_APPROVAL → approve → APPROVED
```

Invalid transitions must fail.

Tests should also cover:

```text
stale revision
duplicate approval
wrong tenant
wrong proof/revision relationship
revision immutability
concurrent numbering
```

---

# 82. Critical Integration Test

Highest-value eventual full workflow:

```text
Owner registers
      ↓
Organization created
      ↓
Customer created
      ↓
Proof created
      ↓
Revision 1 uploaded
      ↓
Proof sent
      ↓
Customer opens review
      ↓
Customer requests changes
      ↓
Revision 2 uploaded
      ↓
Revision 2 sent
      ↓
Customer approves Revision 2
      ↓
Dashboard shows APPROVED
      ↓
Approval record references Revision 2
```

If this workflow works reliably, the core product works.

---

# 83. Performance Philosophy

Initial performance goals are practical, not contractual SLAs.

Desired behavior:

```text
authenticated pages feel immediate
review shell responds quickly
approval transaction completes quickly
file upload limited mostly by user bandwidth/S3
dashboard remains paginated
```

Do not optimize speculative bottlenecks.

Measure first.

---

# 84. Initial File Limits

Exact limits are unvalidated.

Possible starting hypotheses:

```text
FREE      25 MB
STARTER  100 MB
SHOP     250 MB
```

These are not commitments.

Current `Revision.fileSize` uses an integer and safely supports file sizes far beyond the intended MVP range.

ApproveAProof is not intended to become a multi-gigabyte transfer product.

---

# 85. Future Architecture Possibilities

The core schema should permit later additions without requiring them now.

## Annotations

Potential:

```text
ProofAnnotation
revisionId
page
coordinates
comment
```

## Multiple approvers

Potential:

```text
ProofRecipient
```

## SMS

Potential additional dispatch channel.

## Integrations

Potential events:

```text
proof.sent
proof.changes_requested
proof.approved
```

## Custom review domains

Potential:

```text
OrganizationCustomDomain
```

## Payment-before-production

Keep external payment state separate from proof approval.

None of these belong in v1 without customer evidence.

---

# 86. Explicit v1 Exclusions

Do not build before validation:

```text
full CRM
quotes
invoices
inventory
production scheduling
online storefront
customer accounts
complex approval chains
PDF editing
Adobe plugin
live annotations
revision visual diffing
SMS
AI
QuickBooks
Printavo integration
shopVOX integration
Zapier
customer webhooks
custom domains
electronic-signature vendor integration
payment collection
```

The product wins by solving proof approval clearly, not by reproducing an MIS.

---

# 87. SmartLynx Relationship

SmartLynx remains frozen reference material.

Useful knowledge:

```text
Auth0
sessions
S3 presigning
signed S3 reads
SendGrid
Stripe Checkout
Billing Portal
Stripe webhooks
Prisma/PostgreSQL
Vercel
Tailwind
testing
```

Do not transform the old repository into ApproveAProof.

Do not blindly copy implementation.

The local SmartLynx ZIP/archive must not be committed to the ApproveAProof repository.

---

# 88. SmartLynx Lessons Applied Here

Known problems to avoid:

```text
upload presigning before entitlement enforcement
browser-controlled storage assumptions
UI-only subscription enforcement
monolithic dashboard architecture
analytics treated as operational truth
weak orphan cleanup lifecycle
scattered plan logic
insufficient tenant ownership enforcement
N+1 dashboard queries
```

ApproveAProof architecture should deliberately correct these.

---

# 89. Branch and Git Workflow

`main` represents stable tested code.

Development occurs on short-lived phase/feature branches.

Current branch:

```text
phase-1-database
```

Prefer coherent commits.

Current Phase 1 examples:

```text
chore: initialize Prisma database tooling

feat: add identity and tenant database foundation

feat: add customer proof and revision models
```

At a phase boundary run:

```text
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

Only after the complete phase gate passes should the phase branch be merged into `main`.

The user controls:

```text
commits
pushes
merges
deployments
```

ChatGPT should identify useful commit checkpoints proactively.

---

# 90. Development Collaboration Protocol

Development proceeds in small coherent steps.

Before significant implementation, establish:

```text
what is changing
why
affected files
security implications
database implications
tests/verification
```

Prefer:

```text
one file
or
one tightly related change
```

at a time where practical.

Do not provide a large batch of unrelated files when incremental validation is possible.

After each meaningful step:

```text
save
run the appropriate check
confirm
continue
```

This protocol exists to reduce mistakes and preserve context.

---

# 91. Documentation Protocol

Canonical project documentation should be updated:

```text
at major phase boundaries
and
at meaningful mid-phase architecture checkpoints
```

The goal is that a new development session can resume from repository documentation without depending on a long prior conversation.

Primary documents:

```text
APPROVEAPROOF_MASTER_PLAN.md
TECHNICAL_ARCHITECTURE_PLAN.md
```

The Master Plan is primarily the:

```text
product
roadmap
strategy
high-level architecture
status
```

authority.

This Technical Architecture Plan is primarily the:

```text
implemented stack
database design
engineering invariants
integration architecture
security architecture
implementation resume point
```

authority.

They should not contradict each other.

---

# 92. Development Phases

The canonical phase numbering follows the Master Plan.

Database representation is intentionally established before the application behaviors that consume it.

---

## Phase 0 — Foundation

**COMPLETE**

Completed:

```text
React Router scaffold cleanup
TypeScript baseline
environment validation
ESLint
Prettier
Vitest
Testing Library baseline
build verification
server/client boundary conventions
```

---

## Phase 1 — Database

**IN PROGRESS**

Completed:

```text
Neon PostgreSQL
Prisma 7.10.0
Prisma configuration
migration workflow
User
Organization
Membership
Customer
Proof
Revision
```

Remaining:

```text
ProofStatus
currentRevision relationship
Revision tenant strategy
Customer deletion/history strategy
ProofResponse
ProofActivity
ProofDispatch
supporting enums
indexes
constraints
Prisma runtime database utility
driver adapter
database-oriented tests
full phase quality gate
```

---

## Phase 2 — Identity and Tenant Foundation

Build:

```text
Auth0
User resolution/synchronization
Organization creation
Membership behavior
organization resolver
authorization helpers
role enforcement
authenticated /app shell
tenant-isolation tests
```

Milestone:

> Tenant isolation works before proof workflow functionality exists.

---

## Phase 3 — Core Domain

Build application behavior for:

```text
Customer
Proof
Revision
ProofResponse
ProofActivity
ProofDispatch
state machine
revision allocation
domain invariants
```

Write domain tests before elaborate UI.

---

## Phase 4 — Secure Uploads

Build:

```text
AWS S3
server-controlled storage keys
presigned direct upload
checksum/integrity
upload finalization
HeadObject validation
orphan cleanup
```

Milestone:

> Shop can securely attach an immutable revision to a proof.

---

## Phase 5 — Internal Proof Workflow

Build:

```text
dashboard shell
proof list
new proof
proof detail
customer creation
revision history
status display
```

---

## Phase 6 — Public Review

Build:

```text
secure review token
hashed-token lookup
public review route
PDF.js
image preview
branding
checklist
responsive/mobile review
```

Milestone:

> Customer can review the current proof without an account.

---

## Phase 7 — Request Changes

Build:

```text
required comments
current-revision validation
transaction
state change
activity
notification
```

Milestone:

> Complete revision-feedback loop works.

---

## Phase 8 — Approval

Build:

```text
approval confirmation
typed identity
transaction locking
current-revision verification
stale-tab protection
snapshot storage
review fingerprint
idempotency
approved-state integrity
```

This is the most security-sensitive product phase.

Milestone:

> The exact revision reviewed can be reliably approved.

---

## Phase 9 — Email

Build:

```text
SendGrid
templates
dispatch processing
retry behavior
proof-ready email
revision-ready email
change-request email
approval notification
approval confirmation
```

---

## Phase 10 — Operational Dashboard

Build:

```text
Awaiting Approval
Changes Requested
Approved Today
Needs Attention
pagination
filters
manual reminders
```

---

## Phase 11 — Reminders

Build:

```text
scheduled reminder job
eligibility validation
24/72-hour hypothesis
retry logic
approval/cancellation recheck
```

---

## Phase 12 — Billing

Build:

```text
organization Stripe customer
Checkout
Billing Portal
webhook verification
subscription state
entitlements
usage enforcement
```

Do not allow billing to delay early workflow validation unnecessarily.

---

## Phase 13 — Branding and Settings

Build:

```text
business identity
logo
accent color
approval statement
checklist defaults
reply-to address
```

---

## Phase 14 — Approval Record

Generate downloadable approval record from authoritative data.

---

## Phase 15 — Security and Production Hardening

Complete:

```text
security test suite
rate limiting
CSP
CSRF/origin review
logging review
secret rotation
backup restore verification
monitoring
error tracking
load testing
accessibility review
mobile review
cross-browser review
```

Security itself is not deferred until Phase 15.

This phase verifies and reinforces security already considered throughout development.

---

## Phase 16 — Initial Customer Launch

Goal:

> Approximately 10 real businesses regularly sending actual customer proofs through ApproveAProof.

Success is real workflow usage, not traffic.

---

# 93. Phase 1 Completion Criteria

Do not declare Phase 1 complete merely because Prisma validates.

Before Phase 1 completion:

### Schema

Confirm:

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
```

have deliberate relational designs.

### State

Confirm:

```text
ProofStatus
currentRevision
revision lifecycle
```

support the planned state machine.

### Integrity

Confirm:

```text
approval references exact Revision
revision numbering has DB protection
historical records survive ordinary customer changes/deletion
current revision cannot silently contradict Proof ownership
```

### Tenant isolation

Confirm that direct access patterns for:

```text
Customer
Proof
Revision
```

have a deliberate organization ownership path.

### Indexes

Confirm planned high-value access patterns are supported.

### Runtime database access

Configure:

```text
Prisma Client
PostgreSQL adapter
server-only db utility
```

### Database

Confirm Neon is synchronized.

### Quality gate

Run:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

Only then merge:

```text
phase-1-database
```

into:

```text
main
```

and begin Phase 2.

---

# 94. Immediate Resume Point

## Start here after this documentation update.

The current database migration is complete and pushed.

Do not recreate:

```text
Organization
User
Membership
Customer
Proof
Revision
```

Do not run another migration before reviewing the next architecture slice.

### Next decision

Finalize:

```text
ProofStatus
+
Proof.currentRevision
```

while preserving:

```text
Revision immutability
exact-revision approval
stale-revision protection
tenant isolation
```

### During that design, explicitly review:

```text
Should Revision carry organizationId?

Should Proof.customerId remain required?

Should Customer deletion use Restrict or SetNull?

Which Proof fields belong in the database now?

How should currentRevision relate bidirectionally in Prisma?

What DB constraints can reinforce same-Proof revision ownership?
```

### Then proceed to:

```text
ProofResponse
ProofActivity
ProofDispatch
```

Do not jump ahead to S3 or UI.

---

# 95. Architecture Decisions Already Locked

Current locked or implemented decisions include:

```text
clean ApproveAProof repository
SmartLynx frozen as reference
React Router Framework Mode
modular monolith
one PostgreSQL database
Neon managed PostgreSQL
Prisma 7 stable baseline
UUID primary keys
Organization-first tenancy
User ↔ Membership ↔ Organization
schema-first Prisma migrations
immutable revisions
approval references exact revision
private S3
direct browser-to-S3 uploads
server-controlled S3 object identity
hashed public review tokens
transactional customer responses
email failure cannot invalidate approval
centralized entitlements
user-controlled Git workflow
short-lived development branches
documentation checkpoints
```

Changing one of these requires an explicit reason.

---

# 96. Architecture Questions Still Intentionally Open

The following are unresolved by design:

```text
exact Proof.currentRevision Prisma relationship
Revision organizationId duplication
final Customer deletion semantics
exact Proof recipient snapshot fields
exact revision upload status schema
exact ProofResponse constraints
exact ProofActivity metadata shape
exact ProofDispatch idempotency fields
pricing
plan limits
file-size limits
reminder cadence
raw-IP retention policy
customer data retention
hosting provider
team UI timing
approval-record timing
full malware scanning timing
```

An unresolved question should be answered when it becomes necessary for the next coherent implementation step.

Do not solve speculative future questions merely to make the document look complete.

---

# 97. Scalability Position

This architecture should comfortably serve:

```text
10 shops
100 shops
1,000 shops
10,000+ shops
```

before a fundamental redesign should be necessary.

Later scale may justify:

```text
dedicated job queue
read replicas
aggregated usage counters
specialized telemetry
advanced caching
distributed rate limiting
```

None changes the central domain:

```text
Organization
    ↓
Proof
    ↓
Revision
    ↓
Response
```

---

# 98. Core Security Boundary

Authenticated application access:

```text
Auth0 identity
      ↓
User
      ↓
Membership
      ↓
Organization
      ↓
tenant-owned resource
```

Public review access:

```text
high-entropy token
      ↓
SHA-256 lookup
      ↓
Proof
      ↓
current Revision
      ↓
short-lived S3 access
```

Approval integrity:

```text
customer decision
       +
exact Revision
       +
file SHA-256
       +
approval wording
       +
checklist
       +
server timestamp
       ↓
ProofResponse
```

---

# 99. Final Architectural Rules

## 1. A Proof is not a file.

A Proof is an approval process containing revisions.

## 2. A Revision is an exact artifact.

It represents one specific set of bytes shown to a customer.

## 3. Revisions are immutable.

Never overwrite what a customer reviewed.

## 4. Approval belongs to exactly one Revision.

Never infer authoritative approval merely from Proof status.

## 5. The server owns truth.

Never trust browser-provided tenant ownership, storage identity, plan state, revision number, current revision, or timestamps.

## 6. Tenant isolation is mandatory at every server boundary.

Knowing a valid UUID does not grant access.

## 7. Customer decisions are transactional records.

Email, analytics, and notification failures cannot invalidate them.

## 8. Customer files remain private.

Use secure bearer review tokens and short-lived S3 URLs.

## 9. Infrastructure remains deliberately simple.

One application, one PostgreSQL database, S3, SendGrid, Stripe.

Do not invent distributed-system complexity.

## 10. The application exists to establish one trustworthy outcome:

> **This customer approved this exact revision at this exact time.**

---

# END OF CURRENT TECHNICAL ARCHITECTURE SPECIFICATION

**Current implementation checkpoint:** Phase 0 is complete. Phase 1 Database is in progress on `phase-1-database`. Prisma 7.10.0 and Neon PostgreSQL are operational. The identity/tenant schema and Customer → Proof → Revision hierarchy have been migrated and pushed successfully.

**Immediate next architecture task:** Finalize Proof status and current-revision design while reviewing Revision tenant ownership and Customer historical deletion semantics.

**Next models after that:** ProofResponse, ProofActivity, and ProofDispatch.

**Do not begin Phase 2 until the Phase 1 database completion criteria and full quality gate pass.**

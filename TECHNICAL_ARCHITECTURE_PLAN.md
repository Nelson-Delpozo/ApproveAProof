# ApproveAProof v1 Technical Architecture Specification

## 1. Product Definition

ApproveAProof is a lightweight proof-review and approval application for small production businesses.

The initial target market is:

- commercial and digital print shops
- sign shops
- screen printers
- embroidery businesses
- vehicle-wrap shops
- sticker/decal shops
- promotional-product businesses
- engravers and similar custom-production businesses

The application exists to answer one operationally important question:

> **Which exact version did the customer approve for production, who approved it, and when?**

ApproveAProof is deliberately not a CRM, print MIS, invoicing system, production scheduler, quoting system, storefront, inventory system, or design editor.

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

> **An approval must always reference one immutable revision of one proof.**

---

# 2. System Architecture

ApproveAProof should begin as a modular monolith.

Do not introduce microservices.

The initial system consists of:

```text
                    ┌─────────────────────┐
                    │  ApproveAProof Web  │
                    │ Remix / React / TS  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        PostgreSQL           AWS S3          SendGrid
         + Prisma          Private Files      Email
              │
              │
              ▼
            Stripe
            Billing

Authentication:
Auth0
```

Recommended initial infrastructure:

```text
Frontend/server      Remix + React + TypeScript
Database             PostgreSQL
ORM                  Prisma
Authentication       Auth0
Object storage       AWS S3
Transactional email  SendGrid
Billing              Stripe
Hosting              Vercel or equivalent
Styling              Tailwind
Testing              Vitest + Testing Library
```

The old SmartLynx repo remains frozen as a reference implementation for:

- Auth0 flows
- sessions
- S3 presigning
- SendGrid configuration
- Stripe Checkout
- Stripe Billing Portal
- Stripe webhooks
- deployment configuration

ApproveAProof receives its own clean repository and database.

---

# 3. Architectural Principles

## 3.1 One primary database

ApproveAProof v1 should use **one PostgreSQL database**.

Do not reproduce SmartLynx's separate analytics database.

Core operational events and customer decisions belong together:

```text
PostgreSQL
│
├── users
├── organizations
├── memberships
├── customers
├── proofs
├── proof_revisions
├── proof_responses
├── proof_activities
├── proof_dispatches
├── notifications
└── subscriptions / usage
```

If telemetry eventually becomes enormous, behavioral analytics can later be exported to another system.

That is a scaling problem we should earn.

---

## 3.2 Approval data is transactional data

These events are business records:

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

They cannot be treated as best-effort analytics.

Approval and change-request transactions must either completely succeed or completely fail.

---

## 3.3 Files are immutable

A sent revision is never overwritten.

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

This is non-negotiable.

---

## 3.4 Server owns authorization and object identity

The browser must never be trusted to decide:

- which organization owns an object
- whether a subscription allows an upload
- an S3 storage path
- which revision is current
- which revision is being approved
- whether a proof is still approvable
- plan entitlements
- approval timestamps

The browser submits intent.

The server determines truth.

---

# 4. Tenant Model

ApproveAProof should be multi-tenant from day one.

The tenant is an:

```text
Organization
```

Examples:

```text
Denver Quick Print
ABC Signs
Rocky Mountain Screen Printing
```

A person is a:

```text
User
```

A user belongs to an organization through:

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

Even if v1 exposes only one employee per organization, this architecture prevents a difficult team migration later.

---

# 5. Proposed Prisma Domain Model

This is the intended v1 schema shape. Exact Prisma syntax may evolve during implementation, but changes to these relationships should require an explicit architectural reason.

```prisma
enum MembershipRole {
  OWNER
  ADMIN
  STAFF
}

enum Plan {
  FREE
  STARTER
  SHOP
}

enum SubscriptionStatus {
  NONE
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
}

enum ProofStatus {
  DRAFT
  AWAITING_APPROVAL
  CHANGES_REQUESTED
  APPROVED
  CANCELED
}

enum RevisionStatus {
  UPLOADING
  PROCESSING
  READY
  SUPERSEDED
}

enum ResponseType {
  APPROVED
  CHANGES_REQUESTED
}

enum ActivityType {
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
}

enum DispatchType {
  INITIAL_PROOF
  REVISION
  REMINDER
  APPROVAL_CONFIRMATION
  CHANGE_REQUEST_NOTIFICATION
}

enum DispatchStatus {
  PENDING
  SENT
  FAILED
}

model User {
  id          String   @id @default(cuid())
  auth0Sub    String   @unique
  email       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships Membership[]
}

model Organization {
  id        String @id @default(cuid())
  name      String

  logoUrl              String?
  primaryColor         String?
  textColor            String?
  replyToEmail         String?

  defaultApprovalStatement String
  defaultChecklist          Json?

  plan               Plan               @default(FREE)
  subscriptionStatus SubscriptionStatus @default(NONE)

  stripeCustomerId     String? @unique
  stripeSubscriptionId String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
  customers   Customer[]
  proofs      Proof[]

  @@index([createdAt])
}

model Membership {
  id             String         @id @default(cuid())
  organizationId String
  userId         String
  role           MembershipRole @default(STAFF)

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

  createdAt DateTime @default(now())

  @@unique([organizationId, userId])
  @@index([userId])
}

model Customer {
  id             String @id @default(cuid())
  organizationId String

  companyName String?
  contactName String
  email       String
  phone       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  proofs Proof[]

  @@index([organizationId])
  @@index([organizationId, email])
}

model Proof {
  id             String @id @default(cuid())
  organizationId String
  customerId     String?

  title     String
  jobNumber String?

  status ProofStatus @default(DRAFT)

  recipientName  String
  recipientEmail String

  reviewTokenHash String @unique

  currentRevisionId String? @unique

  firstSentAt   DateTime?
  firstViewedAt DateTime?
  lastViewedAt  DateTime?
  approvedAt    DateTime?
  canceledAt    DateTime?

  createdByUserId String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(
    fields: [organizationId],
    references: [id],
    onDelete: Cascade
  )

  customer Customer? @relation(
    fields: [customerId],
    references: [id],
    onDelete: SetNull
  )

  revisions  ProofRevision[] @relation("ProofRevisions")
  responses  ProofResponse[]
  activities ProofActivity[]
  dispatches ProofDispatch[]

  @@index([organizationId, status])
  @@index([organizationId, createdAt])
  @@index([customerId])
  @@index([recipientEmail])
}

model ProofRevision {
  id             String @id @default(cuid())
  proofId        String
  revisionNumber Int

  status RevisionStatus @default(UPLOADING)

  originalFilename String
  storageKey       String @unique
  mimeType         String
  fileSizeBytes    BigInt

  sha256        String?
  s3ETag        String?
  s3VersionId   String?

  approvalStatementSnapshot String
  checklistSnapshot         Json?

  reviewFingerprint String?

  createdByUserId String

  readyAt      DateTime?
  sentAt       DateTime?
  supersededAt DateTime?

  createdAt DateTime @default(now())

  proof Proof @relation(
    "ProofRevisions",
    fields: [proofId],
    references: [id],
    onDelete: Cascade
  )

  responses  ProofResponse[]
  activities ProofActivity[]

  @@unique([proofId, revisionNumber])
  @@index([proofId, createdAt])
}

model ProofResponse {
  id         String       @id @default(cuid())
  proofId    String
  revisionId String
  type       ResponseType

  responderName  String
  responderEmail String?

  comments String?

  ipAddressHash String?
  userAgent     String?

  approvalStatementSnapshot String?
  checklistSnapshot         Json?
  reviewFingerprintSnapshot String?

  occurredAt DateTime @default(now())

  proof Proof @relation(
    fields: [proofId],
    references: [id],
    onDelete: Cascade
  )

  revision ProofRevision @relation(
    fields: [revisionId],
    references: [id],
    onDelete: Restrict
  )

  @@index([proofId, occurredAt])
  @@index([revisionId])
}

model ProofActivity {
  id         String       @id @default(cuid())
  proofId    String
  revisionId String?
  type       ActivityType

  actorUserId String?

  metadata Json?

  occurredAt DateTime @default(now())

  proof Proof @relation(
    fields: [proofId],
    references: [id],
    onDelete: Cascade
  )

  revision ProofRevision? @relation(
    fields: [revisionId],
    references: [id],
    onDelete: SetNull
  )

  @@index([proofId, occurredAt])
}

model ProofDispatch {
  id      String         @id @default(cuid())
  proofId String
  type    DispatchType
  status  DispatchStatus @default(PENDING)

  recipientEmail String

  revisionId String?

  attemptCount Int @default(0)
  lastError    String?

  scheduledAt DateTime?
  sentAt      DateTime?
  createdAt   DateTime @default(now())

  proof Proof @relation(
    fields: [proofId],
    references: [id],
    onDelete: Cascade
  )

  @@index([status, scheduledAt])
  @@index([proofId, createdAt])
}
```

One implementation detail should be added during schema finalization: the `Proof.currentRevisionId` relationship should explicitly reference `ProofRevision`; the bidirectional Prisma relationship can be shaped once the schema is compiled.

---

# 6. Why Proof and Revision Are Separate

A `Proof` represents the ongoing customer approval process.

Example:

```text
Proof:
Johnson Dental Brochure
Job #10482
```

The proof can contain:

```text
Revision 1
Revision 2
Revision 3
```

The customer may:

```text
Revision 1 → Request Changes

Revision 2 → Request Changes

Revision 3 → Approve
```

Only Revision 3 is approved.

The overall Proof then becomes:

```text
APPROVED
```

but approval evidence remains attached specifically to:

```text
Revision 3
```

---

# 7. State Machine

State transitions must be controlled through domain functions rather than arbitrary database updates.

## Valid Proof transitions

```text
DRAFT
  ↓ send
AWAITING_APPROVAL

AWAITING_APPROVAL
  ↓ customer requests changes
CHANGES_REQUESTED

CHANGES_REQUESTED
  ↓ create new revision
DRAFT

DRAFT
  ↓ send revised proof
AWAITING_APPROVAL

AWAITING_APPROVAL
  ↓ customer approves
APPROVED

DRAFT
AWAITING_APPROVAL
CHANGES_REQUESTED
  ↓ shop cancels
CANCELED
```

Invalid:

```text
APPROVED → DRAFT

APPROVED → CHANGES_REQUESTED

CANCELED → APPROVED
```

If a shop needs to revise something after approval, v1 should require an explicit:

> **Create New Proof / Reopen as New Revision**

rather than silently changing an approved record.

We can refine that behavior after customer research.

---

# 8. Revision Rules

Every revision has an integer revision number.

```text
1
2
3
4
```

The number is assigned by the server.

Creation must happen transactionally.

Example:

```sql
SELECT current maximum revision
LOCK proof
CREATE revision max + 1
```

or an equivalent PostgreSQL transaction.

Two simultaneous uploads must never create two Revision 4 records.

The unique database constraint:

```text
(proofId, revisionNumber)
```

acts as final protection.

---

# 9. Review Fingerprint

For stronger audit integrity, each READY revision should receive a deterministic fingerprint derived from what the customer is actually reviewing.

Conceptually:

```text
SHA256(
  revision file SHA256
  +
  approval statement snapshot
  +
  canonical checklist JSON
  +
  revision ID
)
```

Store:

```text
ProofRevision.reviewFingerprint
```

When approved, copy that value into:

```text
ProofResponse.reviewFingerprintSnapshot
```

This is not blockchain and should never be marketed as such.

It simply gives us a strong internal integrity mechanism connecting:

```text
file
+
approval language
+
checklist
+
customer response
```

---

# 10. File Upload Architecture

Do not stream uploaded files through the application server.

Use direct browser-to-S3 uploads.

Workflow:

```text
Browser
   │
   │ Request upload authorization
   ▼
ApproveAProof Server
   │
   │ Authenticate
   │ Authorize organization
   │ Validate plan
   │ Validate file metadata
   │ Allocate Revision
   │ Generate storage key
   │ Sign upload
   ▼
Browser
   │
   │ Direct upload
   ▼
Private S3 Bucket

Browser
   │
   │ Finalize
   ▼
ApproveAProof Server
   │
   │ HeadObject / verify
   │ Confirm checksum
   │ Set READY
   ▼
PostgreSQL
```

This architecture scales horizontally because file bytes never consume normal web-server bandwidth.

---

# 11. S3 Object Structure

The server creates every key.

Recommended structure:

```text
proofs/
  {organizationId}/
    {proofId}/
      {revisionId}/
        original.pdf
```

Example:

```text
proofs/org_abc/proof_123/rev_987/original.pdf
```

Do not use customer-provided filenames in the storage path.

Store the user's original filename only in PostgreSQL.

This prevents path manipulation, strange Unicode key problems, collisions, and unnecessary information disclosure.

---

# 12. S3 Security

Bucket requirements:

```text
Public access:
BLOCKED

Default encryption:
ENABLED

Bucket versioning:
ENABLED if economically acceptable

Object ACLs:
DISABLED

Access:
IAM role/user with least privilege
```

Application permissions should be limited to the ApproveAProof bucket/prefix.

Prefer permissions such as:

```text
s3:PutObject
s3:GetObject
s3:HeadObject
s3:DeleteObject
```

only where needed.

No:

```text
s3:*
```

across the account.

Production and development must use different buckets or strongly separated prefixes/credentials.

---

# 13. Upload Validation

Initial supported types:

```text
application/pdf
image/jpeg
image/png
```

Do not initially support:

```text
SVG
HTML
PSD
AI
ZIP
EXE
Office documents
```

SVG and HTML create unnecessary active-content/XSS concerns.

The server validates:

```text
authenticated membership
plan limits
declared file size
declared MIME
extension
organization ownership
proof state
```

After upload, the server verifies:

```text
object exists
actual object size matches
expected checksum matches
content metadata is plausible
```

Do not trust only the browser-provided MIME type.

---

# 14. SHA-256 File Integrity

For reasonably sized proof files, compute SHA-256 before upload in the browser using Web Crypto.

Browser sends:

```text
filename
size
mime
sha256
```

The server incorporates the expected checksum into the signed upload where practical.

S3 or finalization verifies it.

Store:

```text
ProofRevision.sha256
```

This provides a reliable identity for the approved file.

If implementation complexity around S3 checksum validation is unexpectedly high, retain the schema and initially perform checksum validation as part of asynchronous post-upload verification.

Do not replace SHA-256 with S3 ETag; multipart ETags are not guaranteed to represent the file's MD5 or content identity.

---

# 15. Upload Lifecycle

A revision begins:

```text
UPLOADING
```

After S3 confirms:

```text
PROCESSING
```

After validation:

```text
READY
```

A revision cannot be sent while:

```text
UPLOADING
PROCESSING
```

If upload finalization fails, the object is considered orphaned and can be deleted through scheduled cleanup.

Objects that remain unfinalized for more than a configured period—such as 24 hours—should be purged.

---

# 16. Malware Architecture

Full antivirus scanning is not required to validate the MVP, but the architecture should not prevent it.

Because v1 accepts only PDFs/JPEG/PNG and previews rather than executes them, risk is constrained.

Still:

- keep PDF.js current
- disable PDF JavaScript execution
- do not render arbitrary uploaded HTML
- do not allow SVG initially
- serve uploads from S3 rather than the application origin
- maintain strict Content Security Policy

Later, add:

```text
scanStatus:
PENDING
CLEAN
INFECTED
FAILED
```

using a malware scanning service or Lambda pipeline if customer/security requirements justify it.

---

# 17. Review Tokens

Public review links are bearer credentials.

Example:

```text
https://approveaproof.app/review/{token}
```

Generate using cryptographically secure randomness:

```text
32 random bytes minimum
```

Represent using URL-safe Base64 or hex.

Do not store the raw token.

Store:

```text
SHA256(token)
```

in:

```text
Proof.reviewTokenHash
```

Lookup:

```text
hash incoming token
query by hash
```

Never:

- log raw tokens
- include raw tokens in analytics
- send them to third-party trackers
- expose them through frontend telemetry

The organization should have:

```text
Regenerate Review Link
```

which invalidates the previous token.

---

# 18. Public Review Authorization

The review token grants only limited access to:

```text
organization branding
proof title
job number
current revision
approval checklist
approval action
change-request action
```

It must never expose:

```text
other customers
other proofs
internal user IDs
organization billing
private staff notes
other revision storage keys
raw S3 credentials
```

---

# 19. Signed Preview URLs

S3 files remain private.

When `/review/:token` loads:

```text
validate proof token
validate proof status
identify current revision
generate short-lived signed GET URL
```

Recommended lifetime:

```text
5–15 minutes
```

The browser can refresh when required.

This reduces the usefulness of a leaked S3 URL.

---

# 20. PDF Rendering

Use PDF.js for first-party browser rendering.

Configuration should:

- use a current maintained PDF.js release
- host workers from our own controlled application resources
- disable embedded JavaScript execution
- prevent uploaded PDF content from executing in the application origin
- apply strict Content Security Policy
- treat external links as untrusted

JPEG/PNG may be rendered using `<img>` with signed S3 URLs.

Do not embed untrusted uploaded content through unrestricted iframe behavior.

---

# 21. Public Review Page

The customer review page should contain only what is necessary.

```text
ORGANIZATION LOGO

Proof title
Job number
Revision number

PDF / image viewer

Review checklist

[ APPROVE FOR PRODUCTION ]

[ REQUEST CHANGES ]
```

No customer account required.

No app navigation.

No sales clutter.

No analytics dashboard.

---

# 22. Approve Workflow

Approval is intentionally two-step.

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

The approval statement is stored as a snapshot.

---

# 23. Approval Transaction

Approval must execute inside a database transaction.

Pseudo-code:

```text
BEGIN

load Proof FOR UPDATE

verify:
  proof exists
  status == AWAITING_APPROVAL
  submitted revisionId == proof.currentRevisionId
  revision.status == READY
  revision was actually sent
  proof not canceled
  proof not already approved

create ProofResponse:
  APPROVED

copy:
  responder name
  revision
  approval statement
  checklist
  review fingerprint
  server timestamp

update Proof:
  status = APPROVED
  approvedAt = now()

create ProofActivity:
  PROOF_APPROVED

COMMIT
```

Email happens **after commit**.

Failure to send email must never roll back a valid approval.

---

# 24. Stale Revision Protection

Critical scenario:

```text
Monday:
Customer opens Revision 2.

Tuesday:
Shop sends Revision 3.

Wednesday:
Customer clicks Approve in old Revision 2 tab.
```

The server must reject it.

Response:

> **A newer proof is available.**
>
> Revision 3 replaced the version you were reviewing. Please review the latest revision before approving.

Never silently approve the current revision when the browser submitted an old revision.

---

# 25. Duplicate Approval Protection

Browser retries, double-clicks, network retries, and bot behavior must not generate multiple independent approvals accidentally.

Approval endpoint should be idempotent for the same:

```text
proof
revision
approved state
```

If an already-approved proof receives the same request:

```text
return existing successful state
```

rather than creating another approval record.

Different or conflicting requests should be rejected.

---

# 26. Request Changes Workflow

Customer enters:

```text
Name
Comments
```

Comments required.

Transaction:

```text
lock proof

verify current revision

create ProofResponse:
  CHANGES_REQUESTED

update Proof:
  CHANGES_REQUESTED

create activity

commit
```

After commit:

```text
enqueue/send shop notification
```

---

# 27. Response Identity

For MVP, customer authentication is not required.

Capture:

```text
typed responder name
known recipient email
server timestamp
revision ID
file hash
approval statement
checklist snapshot
review fingerprint
user agent
```

IP address handling should be privacy-conscious.

Rather than retaining full IP indefinitely, consider:

```text
HMAC/IP hash
```

or short-term raw retention followed by hashing/removal.

We should not market the approval record as a legally binding electronic signature without legal review.

Marketing language:

> **Documented approval record**

is sufficient.

---

# 28. Email Architecture

SendGrid remains the transactional provider.

Required templates:

```text
Proof Ready
Revised Proof Ready
Changes Requested
Approval Received
Approval Confirmation
Reminder
```

Emails should come from a verified ApproveAProof sending domain but present the shop prominently.

Example:

```text
From:
ABC Printing via ApproveAProof

Reply-To:
proofs@abcprinting.com
```

Never allow arbitrary From-domain spoofing.

---

# 29. Transactional Outbox / Dispatch Model

Do not make core transactions depend directly on SendGrid success.

Example:

```text
Approval commits
        ↓
ProofDispatch created as PENDING
        ↓
email worker/process sends
        ↓
status SENT
```

If SendGrid fails:

```text
FAILED
attemptCount++
lastError
```

Retry with bounded exponential backoff.

This prevents:

> customer successfully approves but system returns failure because SendGrid was down.

---

# 30. Scheduled Jobs

V1 needs a lightweight scheduler for:

```text
automatic reminders
failed email retries
orphaned upload cleanup
expired data cleanup
```

Do not introduce a message broker yet.

A protected cron endpoint or hosting-provider scheduled function is sufficient.

Example:

```text
/internal/jobs/reminders
/internal/jobs/email-retries
/internal/jobs/orphan-cleanup
```

Authentication:

```text
strong secret
+
provider-level protection where available
```

Job implementations must be idempotent.

---

# 31. Automatic Reminders

Initial default:

```text
24 hours
72 hours
```

after the latest proof send if no decision exists.

Before sending every reminder, recheck:

```text
status == AWAITING_APPROVAL
current revision unchanged
proof not canceled
proof not approved
```

A customer who approves seconds before the job runs must never receive:

> Please approve your proof.

---

# 32. Internal Application Route Map

Recommended route structure:

```text
/
  Marketing site or redirect to approveaproof.com

/login
/signup
/callback
/logout

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

The public marketing website should primarily live on:

```text
approveaproof.com
```

The application:

```text
approveaproof.app
```

---

# 33. Server Module Structure

Recommended:

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
│   ├── auth.server.ts
│   ├── storage.server.ts
│   ├── email.server.ts
│   ├── billing.server.ts
│   ├── hashing.server.ts
│   └── rate-limit.server.ts
│
└── components/
```

Routes should be thin.

Bad:

```text
route contains:
database queries
S3 calls
permissions
Stripe logic
email
state transitions
UI
```

Good:

```text
route
 ↓
validation
 ↓
domain/service call
 ↓
response
```

---

# 34. Authorization Model

Every authenticated operation follows:

```text
authenticate user
        ↓
resolve membership
        ↓
resolve organization
        ↓
authorize requested resource
        ↓
perform action
```

Never rely on:

```text
proof.organizationId from browser
```

Instead:

```text
SELECT proof
WHERE proof.id = ?
AND proof.organizationId IN user's memberships
```

Tenant isolation must be enforced at every server boundary.

---

# 35. Roles

V1 architecture:

```text
OWNER
ADMIN
STAFF
```

OWNER:

```text
everything
billing
delete organization
team administration
```

ADMIN:

```text
proofs
customers
settings
team except ownership/billing
```

STAFF:

```text
proofs
customers
revisions
review status
```

The UI may initially expose only OWNER.

Authorization functions should still be designed correctly.

---

# 36. Authentication

Reuse Auth0 initially because:

- known working integration
- mature security model
- authentication is not product differentiation
- avoids replacing every infrastructure component simultaneously

Keep application identity separate:

```text
Auth0 identity
      ↓
User.auth0Sub
      ↓
ApproveAProof User
      ↓
Membership
      ↓
Organization
```

Do not put authoritative plan or organization permissions solely inside Auth0 metadata.

Those belong in PostgreSQL.

---

# 37. Session Security

Cookies:

```text
HttpOnly
Secure
SameSite=Lax or Strict where compatible
short/appropriate lifetime
```

Rotate sessions appropriately after authentication.

Authenticated mutation routes require CSRF protection or robust Origin checking.

Public review actions do not rely on ambient authentication but should still validate request Origin where practical.

---

# 38. Rate Limiting

Apply rate limits to:

```text
login-related endpoints
review token lookup
approval submission
request changes
presign upload
email resend
manual reminder
review-link regeneration
```

Rate-limit by combinations such as:

```text
IP
organization
user
proof
```

Do not block a whole shared office/NAT based solely on one IP.

Start with conservative limits and instrument rejected requests.

---

# 39. Input Validation

Use server-side schema validation for every action.

Validate:

```text
email
names
IDs
comments
job numbers
proof titles
file metadata
hex colors
URLs
subscription inputs
```

Set explicit maximum lengths.

Example:

```text
proof title        <= 200
job number         <= 100
customer name      <= 200
change request     <= 5000
```

Never store unlimited customer-controlled strings.

React's normal escaping should remain intact.

Do not use `dangerouslySetInnerHTML` for customer content.

---

# 40. Content Security Policy

Production should adopt CSP early rather than after many third-party scripts accumulate.

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

Do not put marketing trackers on `/review/*`.

A customer proof URL is sensitive operational data and should not be sent to advertising or analytics vendors through referrers.

Set review pages:

```text
Referrer-Policy: no-referrer
```

or similarly strict policy.

---

# 41. Search Engine Privacy

Public proof pages must never be indexed.

Headers/meta:

```text
X-Robots-Tag:
noindex, nofollow, noarchive
```

Do not place review URLs in sitemaps.

---

# 42. Logging

Structured logs should include safe identifiers:

```text
organizationId
proofId
revisionId
userId
event type
request ID
status
duration
```

Never log:

```text
review token
S3 signed URL
Auth0 token
Stripe secret
full card information
password/session secret
```

Avoid logging customer proof comments unless required for debugging.

Use request correlation IDs.

---

# 43. Secrets

All secrets in environment configuration / secret manager.

Never repository:

```text
Auth0 secret
AWS keys
Stripe secret
SendGrid key
database credentials
session secret
cron secret
```

Different credentials for:

```text
development
preview/staging
production
```

Rotate anything found in the old SmartLynx repository before reuse.

---

# 44. Stripe Architecture

Subscription belongs to:

```text
Organization
```

not User.

Stripe becomes authoritative for payment state.

ApproveAProof database stores cached entitlement state updated by verified webhooks.

Webhook requirements:

```text
verify Stripe signature
process event idempotently
store Stripe event ID if needed
reject unsigned events
```

Subscription logic belongs in:

```text
billing.server.ts
entitlements.server.ts
```

Do not write:

```text
if (user.plan === "PRO")
```

throughout routes.

---

# 45. Entitlements

Centralized API:

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

UI uses entitlements for presentation.

Server uses the same entitlements for enforcement.

The server is authoritative.

---

# 46. Suggested Initial Plans

Exact pricing is a marketing decision, but architecture can begin with:

```text
FREE
STARTER
SHOP
```

Example entitlements:

```text
FREE
5 proof sends/month
1 user

STARTER
50 proof sends/month
1 user
branding
reminders

SHOP
generous/unlimited practical sends
multiple users
branding
reminders
advanced records
```

Do not promise mathematically unlimited storage.

---

# 47. Usage Accounting

The authoritative unit should be clearly defined.

Recommended:

> A billable proof send occurs when a new revision is successfully dispatched to a customer for review.

Manual reminder emails should not count as new proofs.

`ProofDispatch` gives us an auditable source for this.

At scale, create monthly aggregated counters rather than repeatedly counting millions of dispatch rows.

Do not introduce counters until queries justify them.

---

# 48. Customer Deletion

Deleting a customer should not destroy historical approvals.

Therefore:

```text
Customer → Proof
onDelete SET NULL
```

while a proof preserves:

```text
recipientName
recipientEmail
```

as transaction snapshots.

This allows contact cleanup without rewriting history.

---

# 49. Historical Immutability

After a revision is sent, the following should not be editable:

```text
file
revision number
approval statement snapshot
checklist snapshot
file hash
review fingerprint
sent timestamp
```

After an approval:

```text
response
responder identity
timestamp
approved revision
approval snapshot
```

must not be altered through normal application APIs.

Corrections should produce new records, not mutate history.

---

# 50. Audit Record PDF

Near-MVP feature.

Generated approval record:

```text
APPROVEAPROOF
PROOF APPROVAL RECORD

Organization
ABC Printing

Customer
Johnson Dental

Proof
Tri-fold Brochure

Job
10482

Approved Revision
3

Filename
brochure-r3.pdf

SHA-256
...

Approved By
John Smith

Approved At
September 9, 2026
2:14:26 PM MDT

Approval Statement
...

Review Checklist
...

Review Fingerprint
...

APPROVED FOR PRODUCTION
```

Generate server-side from authoritative DB records.

The approval PDF itself is not the source of truth.

The database is.

---

# 51. Dashboard Information Architecture

The dashboard is an operational queue.

Primary cards:

```text
Awaiting Approval
Changes Requested
Approved Today
```

Primary section:

```text
NEEDS ATTENTION
```

Examples:

```text
Johnson Dental Brochure
CHANGES REQUESTED
12 minutes ago

Mario's Menus
AWAITING APPROVAL
2 days
Send Reminder

Smith Roofing Signs
AWAITING APPROVAL
Viewed yesterday
```

Primary question:

> **What is preventing production from moving forward?**

---

# 52. Proof List

Filters:

```text
All
Awaiting Approval
Changes Requested
Approved
Draft
```

Pagination from day one.

Do not load all proofs into memory.

Query pattern:

```text
WHERE organizationId = ?
AND status = ?
ORDER BY updatedAt DESC
LIMIT 50
```

Use cursor pagination once needed.

Indexes already support the common query.

---

# 53. Proof Detail

Display:

```text
proof name
job number
customer
recipient
current status
current revision
preview
revision history
activity timeline
```

Actions based on state.

AWAITING_APPROVAL:

```text
Send Reminder
Copy Review Link
Cancel
```

CHANGES_REQUESTED:

```text
View Comments
Upload New Revision
```

APPROVED:

```text
Download Approval Record
Download Approved Revision
```

---

# 54. New Proof Flow

Minimal form:

```text
Customer
Proof Name
Job Number optional
Recipient Name
Recipient Email
File
```

Then:

```text
SAVE DRAFT
SEND FOR APPROVAL
```

Expected creation time:

> comfortably under one minute for an existing customer.

---

# 55. Customer Records

Keep CRM functionality intentionally tiny.

Customer view:

```text
company
contact
email
phone

open proofs
past proofs
```

No:

```text
sales pipeline
notes system
tasks
invoices
quotes
marketing campaigns
```

---

# 56. Branding

Organization can configure:

```text
logo
business name
primary accent color
reply-to email
```

Customer review UI otherwise stays controlled by ApproveAProof.

Do not allow custom HTML/CSS.

This protects:

```text
accessibility
clarity
security
supportability
```

---

# 57. Review UI Philosophy

The public review page should use a neutral light interface.

Reasons:

- proofs generally assume white viewing context
- colors should not be distorted by dramatic UI
- accessible for nontechnical users
- resembles paper/document review
- customer's attention belongs on artwork

Use shop branding primarily for:

```text
logo
button accent
business identity
```

---

# 58. Responsive Design

Customer review must be excellent on phones.

Minimum targets:

```text
large tap targets
readable text without zooming
easy PDF page navigation
persistent/obvious decision actions
no hover-only controls
```

Shop dashboard should work on mobile, but customer review is the more critical mobile workflow.

---

# 59. Accessibility

Target WCAG AA basics from the beginning.

Requirements:

```text
semantic buttons/forms
keyboard navigation
visible focus states
adequate contrast
screen-reader labels
error messages associated with fields
no color-only statuses
```

Approval should never depend only on:

```text
green = approved
red = changes
```

Use words and icons.

---

# 60. Database Scalability

PostgreSQL should comfortably support the foreseeable business.

Do not shard.

Do not use separate databases per customer.

Every high-volume table needs tenant-oriented indexes.

Important query patterns:

```text
Proof:
organizationId + status
organizationId + createdAt
customerId

Revision:
proofId + revisionNumber

Response:
proofId + occurredAt

Activity:
proofId + occurredAt

Dispatch:
status + scheduledAt
```

Use database connection pooling appropriate to serverless deployment.

Avoid N+1 queries.

---

# 61. Application Scalability

The architecture scales horizontally because:

```text
web servers are stateless
sessions are cookie/database backed
files go directly to S3
database is centralized
email work is retryable
scheduled work is idempotent
```

A request can hit any application instance.

Never store application state only in process memory.

---

# 62. S3 Scalability

S3 already solves the large binary-storage problem.

Avoid:

```text
database BLOBs
web-server local disk
Vercel filesystem storage
```

Store only metadata and object identity in PostgreSQL.

---

# 63. Email Scalability

Initially:

```text
DB-backed dispatch queue
+
scheduled retry worker
```

If volume becomes substantial, the same `ProofDispatch` abstraction can later be moved behind:

```text
SQS
Cloud Tasks
Redis queue
```

without rewriting proof logic.

This is why email sending should already be behind:

```text
dispatchProofEmail()
```

rather than directly embedded in routes.

---

# 64. Caching

Do not introduce Redis initially.

Most authenticated data needs to be current.

The primary review page should prefer correctness over stale caching.

Static marketing assets can use CDN caching.

Signed S3 content naturally uses appropriate caching controls.

Add Redis only when there is a demonstrated requirement such as:

```text
distributed rate limiting
heavy caching
job infrastructure
```

---

# 65. Backups and Recovery

Production PostgreSQL:

```text
automatic backups
point-in-time recovery if available
tested restore procedure
```

S3:

```text
versioning preferred
encryption
lifecycle rules
```

A backup that has never been restored should not be considered proven.

Document recovery procedure before meaningful paying-customer volume.

---

# 66. Data Retention

Initial policy can be generous.

Suggested conceptual policy:

```text
Active paid organization:
retain proofs and approvals

Canceled organization:
read/export period, e.g. 90 days

After retention period:
purge S3 and application records
```

Exact policy belongs in terms/privacy decisions.

Architecture should support scheduled deletion cleanly.

---

# 67. Organization Deletion

Deletion should be asynchronous for large accounts.

Conceptually:

```text
mark organization deletion pending

disable login/use

background job:
  delete S3 revisions
  delete related records
  remove customer PII

finalize organization deletion
```

Do not attempt to delete tens of thousands of S3 objects inside one browser request.

---

# 68. Privacy

ApproveAProof stores business/customer PII:

```text
name
email
possibly phone
IP-related security metadata
proof files
approval comments
```

Collect only what serves the product.

Do not add third-party advertising trackers to customer review pages.

Separate marketing analytics from application/customer proof traffic.

---

# 69. Monitoring

Track:

```text
HTTP error rate
database failures
upload failures
approval failures
SendGrid failures
Stripe webhook failures
scheduled job failures
S3 failures
latency
```

Add application exception monitoring such as Sentry or equivalent early.

Alert on:

```text
approval endpoint errors
Stripe webhook repeated failures
email queue accumulating
scheduled reminder process not running
```

---

# 70. Critical Security Tests

Automated tests must verify:

```text
User cannot access another organization.

User cannot presign upload for another organization.

User cannot submit arbitrary S3 key.

Customer cannot access another proof by changing ID.

Raw review token is never returned through internal APIs.

Old review token fails after regeneration.

Customer cannot approve stale revision.

Customer cannot approve canceled proof.

Customer cannot approve unsent revision.

Approved revision cannot be overwritten.

Two concurrent revisions cannot get same number.

Double-click approval creates one approval.

Email failure does not lose approval.

Stripe UI gating cannot be bypassed through API.

Free account cannot create unlimited orphan uploads.

Malicious filename cannot affect storage path.

HTML/SVG upload is rejected.

Oversize file is rejected.

Cross-tenant customer IDs are rejected.

Reminder does not send after approval.

Cron endpoint requires authentication.
```

---

# 71. Domain Logic Tests

These matter more than UI snapshots.

Examples:

```text
DRAFT → send → AWAITING_APPROVAL

AWAITING_APPROVAL → changes → CHANGES_REQUESTED

CHANGES_REQUESTED → new revision → DRAFT

AWAITING_APPROVAL → approve → APPROVED
```

and invalid transitions fail.

Revision-history integrity should have direct unit tests.

---

# 72. Integration Tests

High-value end-to-end path:

```text
Owner registers
      ↓
Organization created
      ↓
Customer created
      ↓
Proof created
      ↓
PDF uploaded
      ↓
Proof sent
      ↓
Review URL loaded
      ↓
Customer requests changes
      ↓
Revision 2 uploaded
      ↓
Revision 2 sent
      ↓
Customer approves
      ↓
Dashboard shows approved
      ↓
Approval record generated
```

If this test passes, much of the product works.

---

# 73. Performance Targets

Initial goals rather than contractual SLAs:

```text
normal authenticated page:
fast enough to feel immediate

proof review shell:
< ~1 second server response where realistic

approval transaction:
< ~1 second excluding email

file upload:
limited primarily by customer bandwidth/S3

dashboard:
paginated, never load all history
```

Do not prematurely optimize PDF rendering or database queries without measurements.

---

# 74. Initial File Limits

Start conservatively.

For example:

```text
FREE:
25 MB

STARTER:
100 MB

SHOP:
250 MB
```

These are product hypotheses, not final pricing decisions.

Print proofs usually do not require multi-gigabyte file transfer.

ApproveAProof should not become MASV.

---

# 75. Architecture for Future Features

The model intentionally leaves room for future additions.

## Annotations

Later:

```text
ProofAnnotation
revisionId
page
x
y
comment
```

No schema rewrite required.

## Multiple approvers

Later:

```text
ProofRecipient
```

with approval requirements.

## SMS

Add dispatch provider:

```text
EMAIL
SMS
```

## Integrations

API/webhooks can subscribe to:

```text
proof.approved
proof.changes_requested
proof.sent
```

## Custom domains

Map:

```text
OrganizationCustomDomain
```

to review-token resolution.

## Payment-before-production

Add external payment state separately.

Do not couple payment to proof approval now.

---

# 76. Features Explicitly Excluded from v1

Do not build before product validation:

```text
CRM
quotes
invoices
inventory
production scheduling
online store
customer accounts
complex approval chains
PDF editing
Adobe plugin
live drawing annotations
revision diffing
SMS
AI
QuickBooks integration
Printavo integration
shopVOX integration
Zapier
webhooks for customers
custom domains
electronic-signature vendor integration
payment collection
```

Each can be evaluated from actual user demand.

---

# 77. Development Phases

## Phase 0 — Repository and infrastructure

Create:

```text
ApproveAProof repo
development environment
production environment skeleton
PostgreSQL
S3
Auth0
SendGrid
Stripe test mode
```

Configure:

```text
TypeScript strictness
linting
formatting
tests
environment validation
CI
```

No product UI required.

---

## Phase 1 — Identity and organizations

Build:

```text
Auth0 login/signup
User creation
Organization creation
Membership
organization resolver
authorization helpers
```

Test cross-tenant isolation thoroughly.

---

## Phase 2 — Core database domain

Build:

```text
Customer
Proof
ProofRevision
ProofResponse
ProofActivity
ProofDispatch
```

Implement proof state machine before UI.

---

## Phase 3 — Secure uploads

Build:

```text
revision allocation
server-controlled S3 paths
presigned direct upload
checksum handling
finalization
HeadObject validation
orphan cleanup
```

At completion:

> authenticated shop can create a proof and securely attach immutable revisions.

---

## Phase 4 — Internal proof workflow

Build:

```text
proof list
new proof
proof detail
customer creation
revision history
status display
```

No customer approval yet.

---

## Phase 5 — Public review

Build:

```text
secure token
review route
PDF.js preview
image preview
branding
checklist
```

At completion:

> customer can securely view the current revision without an account.

---

## Phase 6 — Request Changes

Implement transaction, comments, status change, timeline.

At completion:

```text
send → review → request changes
```

works completely.

---

## Phase 7 — Approval

Implement:

```text
confirmation
typed identity
transaction locking
revision verification
stale-tab protection
snapshot storage
review fingerprint
idempotency
```

This is the most security-sensitive product phase.

---

## Phase 8 — Email

Build transactional templates and dispatch/retry architecture.

Connect:

```text
proof ready
revision ready
changes requested
approved
customer confirmation
```

---

## Phase 9 — Operational dashboard

Add:

```text
Awaiting Approval
Changes Requested
Approved Today
Needs Attention
pagination
filters
manual reminder
```

---

## Phase 10 — Automated reminders

Add scheduled jobs:

```text
24-hour reminder
72-hour reminder
retry logic
```

---

## Phase 11 — Billing

Connect organization-level Stripe subscriptions and centralized entitlements.

Do not block early product testing on billing.

---

## Phase 12 — Approval record

Generate downloadable proof approval record.

---

## Phase 13 — Hardening

Before public launch:

```text
security test pass
rate limiting
CSP
logging review
secret rotation
backup verification
error monitoring
load testing
accessibility review
cross-browser review
mobile review
```

---

# 78. MVP Launch Definition

ApproveAProof is ready for the first real print shops when this entire workflow works reliably:

```text
Shop logs in.

Shop creates Johnson Dental.

Shop creates "Brochure — Job 10482."

Shop uploads Revision 1.

Shop sends it.

John opens the email on his phone.

John views Revision 1.

John requests:
"Please fix the phone number."

Shop sees CHANGES REQUESTED.

Shop uploads Revision 2.

John receives the revised proof.

John reviews Revision 2.

John selects APPROVE FOR PRODUCTION.

John enters his name.

ApproveAProof validates that Revision 2 is still current.

Approval commits transactionally.

Shop receives notification.

Dashboard says APPROVED.

Revision 1 remains preserved.

Revision 2 remains preserved.

Approval points specifically to Revision 2.

Approval record shows who, what, and when.
```

If that workflow is excellent, we have a sellable SaaS.

Everything else can wait.

---

# 79. What We Are Reusing From SmartLynx

SmartLynx remains valuable.

Reference/reuse:

```text
Auth0 implementation
session patterns
S3 direct-upload knowledge
signed S3 reads
SendGrid configuration
Stripe Checkout
Billing Portal
webhook handling
Prisma experience
Vercel deployment
Tailwind setup
testing patterns
```

Do not copy blindly.

Specifically correct known SmartLynx weaknesses:

```text
presign before entitlement enforcement
client-controlled S3 metadata/key assumptions
UI-only plan enforcement
monolithic dashboard
analytics as separate operational concern
weak cleanup lifecycle
```

---

# 80. Estimated Architectural Reuse

Conceptual infrastructure reuse:

```text
Authentication knowledge      ~90%
Stripe knowledge              ~90%
S3 knowledge                  ~80%
SendGrid knowledge            ~80%
Deployment knowledge          ~90%
Prisma/Postgres experience    ~90%

Existing domain code          ~10–20%
Existing dashboard            ~0–10%
Existing public link UI       ~10%
Existing analytics model      ~0–10%
```

ApproveAProof should therefore be considered:

> **a clean product build using proven SmartLynx infrastructure patterns**

rather than SmartLynx v2.

---

# 81. Scalability Position

This architecture should comfortably serve:

```text
10 shops
100 shops
1,000 shops
10,000+ shops
```

without fundamental redesign.

At higher scale we may introduce:

```text
dedicated job queue
read replicas
aggregated usage counters
specialized telemetry system
CDN tuning
more sophisticated rate limiting
```

but none changes the central:

```text
Organization
 → Proof
 → Revision
 → Response
```

model.

That is what we want.

---

# 82. Final Architectural Rules

These are the rules I would put at the top of the repo documentation.

**1. A proof is not a file.**

A proof is an approval process containing immutable revisions.

**2. An approval belongs to exactly one revision.**

Never infer approval from the overall proof alone.

**3. Sent revisions never change.**

New artwork creates a new revision.

**4. Customer decisions are transactional records, not analytics.**

Never allow an analytics/email failure to destroy a decision.

**5. The server owns truth.**

Never trust client-provided tenant ownership, revision identity, storage keys, plan state, or timestamps.

**6. Tenant isolation is mandatory at every query boundary.**

Never load by object ID alone when organization ownership matters.

**7. Files remain private.**

Public review occurs through high-entropy bearer tokens and short-lived S3 URLs.

**8. Keep infrastructure boring.**

One application. One PostgreSQL database. S3. Stripe. SendGrid. No microservices unless reality demands them.

**9. Build only the approval workflow until customers demand more.**

Do not become print MIS software.

**10. The application exists to produce one trustworthy outcome:**

> **This customer approved this exact revision at this exact time.**

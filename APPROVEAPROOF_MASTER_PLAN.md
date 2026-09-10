# ApproveAProof — Master Product & Engineering Plan

**Document purpose:** Canonical product, architecture, security, and development reference
**Project:** ApproveAProof
**Primary marketing domain:** `approveaproof.com`
**Application domain:** `approveaproof.app`
**Initial market:** Small custom-production businesses, beginning with local print shops
**Status:** Pre-MVP development
**Last major checkpoint:** September 9, 2026

---

# 1. How to Use This Document

This document is the source of truth for the direction of ApproveAProof.

It exists to prevent:

- architectural drift
- forgotten decisions
- accidental scope creep
- inconsistent security decisions
- rebuilding previously solved problems
- losing track of development progress between sessions

Before making a major architectural or product decision, check this document.

When a significant decision changes, update this document.

The document uses three classifications.

### LOCKED

A foundational decision that should not change casually.

Changing a LOCKED decision requires an explicit reason and consideration of its architectural consequences.

### CURRENT PLAN

The intended implementation based on current knowledge.

It may change when development or customer feedback gives us better information.

### HYPOTHESIS / BACKLOG

An idea that has not yet earned its place in the product.

Do not build it merely because it appears in this document.

---

# 2. Project Status

## Current checkpoint — September 9, 2026

Completed:

- Product pivot from SmartLynx established.
- Initial market research completed.
- Small custom-production businesses selected as the broader market.
- Local commercial/digital print shops selected as the initial wedge.
- Core proof-approval problem identified.
- Product architecture designed.
- Security and scalability requirements established.
- `approveaproof.com` selected for the marketing site.
- `approveaproof.app` selected for the application.
- New ApproveAProof repository created.
- Clean application scaffold created using React Router Framework Mode.
- Initial boilerplate successfully runs locally.
- Initial working scaffold pushed to the new repository.
- SmartLynx retained as a frozen reference implementation.

## Exact next development task

**Do not jump directly into product features.**

Next session begins by:

1. inspecting the generated React Router project structure;
2. removing unnecessary starter boilerplate;
3. establishing the application shell and folder conventions;
4. establishing environment-variable validation;
5. establishing formatting/linting/testing conventions;
6. confirming development and production configuration;
7. only then beginning PostgreSQL/Prisma setup.

---

# 3. Product Vision

## LOCKED

ApproveAProof is a lightweight proof-review and approval application for businesses that create custom physical products.

Its central purpose is to answer:

> **Which exact version did the customer approve for production, who approved it, and when?**

The product replaces fragile approval workflows such as:

- emailing PDFs back and forth;
- customers replying "looks good";
- text-message approvals;
- screenshots;
- verbal approvals;
- employees searching old email threads;
- uncertainty about which revision was approved.

ApproveAProof creates a simple, explicit, documented approval workflow without requiring the business to replace its existing operating systems.

---

# 4. Core Product Promise

## LOCKED

The product should ultimately make this statement true:

> **This customer approved this exact revision at this exact time.**

Everything in the core architecture should reinforce that outcome.

---

# 5. Initial Customer

## CURRENT PLAN

Initial target:

**Small independent commercial and digital print shops.**

Particularly attractive prospects are shops where proof approval currently happens through:

- emailed PDFs;
- email attachments;
- text messages;
- screenshots;
- informal email replies.

Ideal discovery question:

> **How do customers approve artwork before you send a job to production?**

Strong prospect answers:

> "We email them a PDF."

> "They reply to the email."

> "Sometimes they text us."

> "We just need them to say it's okay."

Weak prospect answers:

> "Printavo already handles everything."

> "Our MIS already manages approvals."

---

# 6. Adjacent Markets

## HYPOTHESIS / BACKLOG

The same approval workflow may later serve:

- sign shops;
- screen printing;
- DTF/DTG businesses;
- embroidery shops;
- vehicle wraps;
- stickers and decals;
- promotional products;
- engraving and awards;
- packaging;
- personalized-product manufacturers;
- other custom-production businesses.

The architecture should support these industries.

The MVP does not need industry-specific functionality for all of them.

---

# 7. Product Positioning

## LOCKED

ApproveAProof is not primarily:

> file sharing.

It is:

> **a lightweight approval layer between artwork and production.**

The positioning should emphasize:

- clear approval;
- exact revision identity;
- fewer misunderstandings;
- documented customer decisions;
- easier revision cycles;
- knowing when production can proceed.

---

# 8. What We Are NOT Building

## LOCKED UNTIL CUSTOMER EVIDENCE SAYS OTHERWISE

ApproveAProof is not becoming:

- a CRM;
- print MIS;
- ERP;
- quoting software;
- invoicing software;
- accounting software;
- inventory software;
- production scheduling software;
- online storefront;
- project-management platform;
- Adobe replacement;
- graphic-design editor.

The positioning is:

> **Keep the tools you already use. ApproveAProof fixes proof approval.**

This boundary is strategically important.

---

# 9. MVP Workflow

## LOCKED

```text
SHOP CREATES PROOF
        │
        ▼
UPLOAD REVISION
        │
        ▼
SEND TO CUSTOMER
        │
        ▼
CUSTOMER REVIEWS
        │
        ├───────────────┐
        │               │
        ▼               ▼
    APPROVE       REQUEST CHANGES
        │               │
        ▼               ▼
 RECORD LOCKED      SHOP REVISES
                        │
                        ▼
                   NEW REVISION
                        │
                        ▼
                  SEND AGAIN
```

Example:

```text
Johnson Dental Brochure
Job #10482

Revision 1
    ↓
Customer requests phone-number correction

Revision 2
    ↓
Customer approves

APPROVED FOR PRODUCTION
```

Revision 1 remains preserved.

Revision 2 remains preserved.

Approval points specifically to Revision 2.

---

# 10. Primary Domain Model

## LOCKED

The central hierarchy is:

```text
Organization
    │
    ├── Users / Memberships
    │
    ├── Customers
    │
    └── Proofs
          │
          ├── Revisions
          │
          ├── Responses
          │
          ├── Activity
          │
          └── Dispatches
```

The most important relationship in the application is:

```text
Proof
  ↓
Immutable ProofRevision
  ↓
ProofResponse
```

---

# 11. Fundamental Data Invariant

## LOCKED — NON-NEGOTIABLE

> **An approval always belongs to exactly one immutable revision.**

Never represent approval merely as:

```text
proof.approved = true
```

without preserving the exact approved revision.

---

# 12. Proof vs. Revision

A `Proof` represents an approval process.

Example:

```text
Johnson Dental Brochure
```

A `ProofRevision` represents a specific artifact presented to the customer.

Example:

```text
Revision 1
Revision 2
Revision 3
```

A customer may:

```text
Revision 1 → Request Changes
Revision 2 → Request Changes
Revision 3 → Approve
```

The Proof becomes APPROVED.

The authoritative approval record references Revision 3.

---

# 13. Revision Immutability

## LOCKED — SECURITY/INTEGRITY REQUIREMENT

A revision that has been presented to a customer is never overwritten.

Never:

```text
proof.pdf
    ↓ overwrite
proof.pdf
```

Instead:

```text
Revision 1 → S3 object A
Revision 2 → S3 object B
Revision 3 → S3 object C
```

This preserves exactly what the customer saw.

---

# 14. Multi-Tenant Architecture

## LOCKED

The application is multi-tenant from day one.

The tenant is:

```text
Organization
```

Example:

```text
Denver Quick Print
```

Users belong to organizations through:

```text
Membership
```

Conceptually:

```text
User
  │
Membership
  │
  ▼
Organization
  │
  ├── Customers
  ├── Proofs
  ├── Branding
  └── Subscription
```

Even if initial customers have one employee, this prevents a difficult migration when teams are introduced.

---

# 15. Technology Stack

## CURRENT PLAN

Application:

- React Router Framework Mode
- React
- TypeScript

Database:

- PostgreSQL
- Prisma

Authentication:

- Auth0

Object storage:

- AWS S3

Email:

- SendGrid

Billing:

- Stripe

Styling:

- Tailwind CSS

Testing:

- Vitest
- React Testing Library where appropriate

Hosting:

- likely Vercel or equivalent

Architecture:

- modular monolith

---

# 16. Why a Modular Monolith

## LOCKED FOR MVP

Do not build microservices.

Initial architecture:

```text
                  ApproveAProof
                  Web Application
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   PostgreSQL        AWS S3        SendGrid
        │
        ▼
      Stripe
```

This is capable of supporting far more customers than the MVP requires.

We will earn distributed-system complexity rather than inventing it.

---

# 17. Database Strategy

## LOCKED

Use one primary PostgreSQL database.

Do not reproduce SmartLynx's separate analytics database.

Approval information is operational business data, not optional analytics.

Core tables/models:

```text
User
Organization
Membership
Customer
Proof
ProofRevision
ProofResponse
ProofActivity
ProofDispatch
```

Potential later models:

```text
ProofRecipient
ProofAnnotation
OrganizationCustomDomain
WebhookEndpoint
```

Do not create them until needed.

---

# 18. Core Models

## User

Identity only.

Important fields:

```text
id
auth0Sub
email
createdAt
updatedAt
```

Billing does not belong to User.

Branding does not belong to User.

---

## Organization

Represents the business using ApproveAProof.

Important fields:

```text
id
name

branding settings

default approval statement
default checklist

plan
subscription status

Stripe customer ID
Stripe subscription ID

createdAt
updatedAt
```

Billing belongs to Organization.

Branding belongs to Organization.

---

## Membership

Connects users and organizations.

Roles:

```text
OWNER
ADMIN
STAFF
```

---

## Customer

Intentionally lightweight.

Fields:

```text
organizationId
companyName
contactName
email
phone
```

This is not a CRM.

---

## Proof

Represents the overall approval workflow.

Important fields:

```text
organizationId
customerId

title
jobNumber

status

recipientName
recipientEmail

reviewTokenHash

currentRevisionId

firstSentAt
firstViewedAt
lastViewedAt
approvedAt
canceledAt

createdByUserId
```

---

## ProofRevision

Represents one immutable version.

Important fields:

```text
proofId
revisionNumber

status

originalFilename
storageKey
mimeType
fileSizeBytes

sha256
s3ETag
s3VersionId

approvalStatementSnapshot
checklistSnapshot
reviewFingerprint

createdByUserId

readyAt
sentAt
supersededAt
createdAt
```

Unique constraint:

```text
proofId + revisionNumber
```

---

## ProofResponse

Authoritative customer decision.

Types:

```text
APPROVED
CHANGES_REQUESTED
```

Important fields:

```text
proofId
revisionId

type

responderName
responderEmail

comments

privacy-conscious IP metadata
userAgent

approvalStatementSnapshot
checklistSnapshot
reviewFingerprintSnapshot

occurredAt
```

---

## ProofActivity

Human-readable operational timeline.

Examples:

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

Activity is useful for display.

ProofResponse remains authoritative for customer decisions.

---

## ProofDispatch

Tracks transactional communication.

Examples:

```text
INITIAL_PROOF
REVISION
REMINDER
APPROVAL_CONFIRMATION
CHANGE_REQUEST_NOTIFICATION
```

States:

```text
PENDING
SENT
FAILED
```

This enables retries without compromising approval transactions.

---

# 19. Proof State Machine

## LOCKED

States:

```text
DRAFT
AWAITING_APPROVAL
CHANGES_REQUESTED
APPROVED
CANCELED
```

Normal workflow:

```text
DRAFT
  │
  │ send
  ▼
AWAITING_APPROVAL
  │
  ├──── approve ──────────→ APPROVED
  │
  └──── request changes ─→ CHANGES_REQUESTED
                                │
                                │ new revision
                                ▼
                              DRAFT
```

Possible cancellation:

```text
DRAFT ────────────────┐
AWAITING_APPROVAL ────┼──→ CANCELED
CHANGES_REQUESTED ────┘
```

Invalid:

```text
CANCELED → APPROVED

APPROVED → CHANGES_REQUESTED
```

State transitions belong in domain logic.

Routes must not arbitrarily set statuses.

---

# 20. Revision Allocation

## LOCKED

Revision numbers are server-generated.

Never accept:

```text
revisionNumber = 4
```

from the browser as authoritative.

Concurrent revision creation must not create duplicate numbers.

Use:

- database transaction/locking;
- unique `(proofId, revisionNumber)` constraint.

The database constraint is final protection.

---

# 21. File Integrity

## CURRENT PLAN

Each revision should store SHA-256 for the uploaded file.

```text
ProofRevision.sha256
```

Do not treat S3 ETag as equivalent to a cryptographic file hash.

The hash identifies the exact approved file.

---

# 22. Review Fingerprint

## CURRENT PLAN

A revision should receive a deterministic fingerprint derived from:

```text
file SHA-256
+
approval statement snapshot
+
canonical checklist
+
revision identity
```

Example:

```text
SHA256(...)
```

Approval copies that fingerprint into the ProofResponse.

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
customer response
```

Do not market this as blockchain or cryptographic legal certification.

It is an internal integrity mechanism.

---

# 23. S3 Architecture

## LOCKED

Files are private.

The server creates storage keys.

Recommended structure:

```text
proofs/
  {organizationId}/
    {proofId}/
      {revisionId}/
        original.pdf
```

Never place customer-provided filenames directly into object paths.

Original filenames are stored in PostgreSQL.

---

# 24. S3 Security

## LOCKED

Production bucket:

```text
Public access: BLOCKED

Object ACLs: DISABLED

Encryption: ENABLED

Versioning: PREFERRED
```

AWS credentials use least privilege.

Never grant:

```text
s3:*
```

across the account.

Development and production storage must be separated.

---

# 25. Upload Architecture

## LOCKED

Do not route file bytes through the normal application server.

Flow:

```text
Browser
   │
   │ request upload
   ▼
ApproveAProof
   │
   ├── authenticate
   ├── authorize tenant
   ├── validate entitlement
   ├── validate metadata
   ├── allocate revision
   └── create S3 key
   │
   ▼
Presigned upload
   │
   ▼
Browser ─────────────→ S3
   │
   │ finalize
   ▼
ApproveAProof
   │
   ├── HeadObject
   ├── verify size
   ├── verify expected object
   ├── verify integrity/checksum
   └── mark revision READY
```

This keeps application servers stateless and avoids unnecessary file bandwidth.

---

# 26. Upload Security

## LOCKED

Initial accepted types:

```text
PDF
JPEG
PNG
```

Reject initially:

```text
SVG
HTML
ZIP
EXE
PSD
AI
Office documents
```

Do not trust:

- extension alone;
- browser MIME type alone;
- browser-provided S3 key;
- browser-provided organization ID.

Validate before presigning and again after upload.

---

# 27. Upload Lifecycle

States:

```text
UPLOADING
PROCESSING
READY
SUPERSEDED
```

Only READY revisions can be sent.

Unfinished/orphan uploads should be cleaned automatically after a reasonable period.

Initial hypothesis:

```text
24 hours
```

---

# 28. Malware Strategy

## CURRENT PLAN

Full malware scanning is not required for first validation.

Risk is constrained by accepting only PDF/JPEG/PNG and never executing uploads.

Requirements:

- keep PDF.js current;
- disable PDF JavaScript;
- do not render arbitrary HTML;
- reject SVG initially;
- serve files from private S3;
- use strong Content Security Policy.

Architecture should permit later malware scanning.

---

# 29. Public Review Tokens

## LOCKED — SECURITY REQUIREMENT

Customer review links are bearer credentials.

Example:

```text
approveaproof.app/review/{token}
```

Generate at least 32 cryptographically random bytes.

Do not store the raw token.

Store:

```text
SHA256(token)
```

Lookup:

```text
hash incoming token
→ query reviewTokenHash
```

Never log:

- raw review tokens;
- signed S3 URLs.

Review links must be regeneratable.

Regeneration invalidates the old token.

---

# 30. Review Page Access

The review token grants access only to what the customer needs:

```text
shop identity
proof title
job number
current revision
preview
approval checklist
approve action
request-changes action
```

It does not expose:

```text
other proofs
other customers
billing
internal settings
team information
S3 keys
private notes
```

---

# 31. Signed File URLs

## LOCKED

S3 objects remain private.

The application generates short-lived signed GET URLs after validating the review token.

Initial target lifetime:

```text
5–15 minutes
```

Signed URLs can be refreshed when necessary.

---

# 32. PDF Rendering

## CURRENT PLAN

Use PDF.js.

Security requirements:

- current maintained release;
- no embedded PDF JavaScript execution;
- strict CSP;
- no unrestricted uploaded-content iframe behavior;
- external links treated as untrusted.

JPEG and PNG can use signed S3 URLs.

---

# 33. Public Review UX

## CURRENT PLAN

The review page should be deliberately simple.

```text
SHOP LOGO

Johnson Dental Brochure
Job #10482
Revision 2

[ PROOF VIEWER ]

Review carefully:
☐ spelling
☐ contact information
☐ artwork/layout

[ APPROVE FOR PRODUCTION ]

[ REQUEST CHANGES ]
```

No customer account.

No application navigation.

No sales clutter.

No advertising trackers.

---

# 34. Review UI Visual Direction

## CURRENT PLAN

Use a neutral, professional, light interface.

The proof is the visual focus.

Reasons:

- print proofs often assume white viewing context;
- dramatic backgrounds may affect perceived color;
- nontechnical customers need clarity;
- document review should feel trustworthy.

Shop branding may control:

- logo;
- business name;
- accent color.

Do not allow arbitrary custom CSS/HTML.

---

# 35. Mobile Requirement

## LOCKED PRODUCT REQUIREMENT

The customer review workflow must work extremely well on phones.

Requirements:

- large tap targets;
- readable without zooming;
- easy PDF navigation;
- obvious revision number;
- obvious approval/change controls;
- no hover-only interaction.

Customer mobile UX has higher priority than perfect dashboard mobile UX.

---

# 36. Approval UX

## LOCKED

Approval should be deliberate, not accidental.

Step 1:

```text
APPROVE FOR PRODUCTION
```

Step 2:

```text
Approve Revision 2?

Your Name:
[ John Smith ]

☑ I have reviewed this proof and approve
  this revision for production.

[ CONFIRM APPROVAL ]
```

The approval statement is snapshotted.

---

# 37. Approval Transaction

## LOCKED — CRITICAL INTEGRITY REQUIREMENT

Approval occurs inside a database transaction.

Conceptually:

```text
BEGIN

lock Proof

verify:
  proof exists
  status == AWAITING_APPROVAL
  submitted revision == currentRevision
  revision == READY
  revision was sent
  proof not canceled
  proof not already conflictingly approved

create APPROVED ProofResponse

snapshot:
  responder
  revision
  approval statement
  checklist
  fingerprint
  server timestamp

update Proof:
  status = APPROVED
  approvedAt = server time

create activity

create pending notification/dispatch

COMMIT
```

Email is processed after the authoritative transaction succeeds.

SendGrid failure must never erase a valid approval.

---

# 38. Stale Revision Protection

## LOCKED

Scenario:

```text
Monday:
Customer opens Revision 2.

Tuesday:
Shop creates Revision 3.

Wednesday:
Customer returns to old Revision 2 tab
and clicks Approve.
```

Server rejects the approval.

Message:

> A newer proof is available. Revision 3 replaced the version you were reviewing. Please review the latest revision before approving.

Never silently substitute Revision 3.

The customer must actually review what they approve.

---

# 39. Duplicate Approval Protection

## LOCKED

Network retries and double-clicks must not create duplicate approval records.

Approval must be idempotent where appropriate.

Same proof + same revision + already successful approval:

```text
return successful existing state
```

Conflicting request:

```text
reject
```

---

# 40. Request Changes

Customer provides:

```text
name
required comments
```

Transaction verifies the revision is current.

Then:

```text
create CHANGES_REQUESTED response

Proof.status = CHANGES_REQUESTED

create activity
```

Shop is notified after commit.

---

# 41. Approval Identity

## CURRENT PLAN

Customer accounts are not required.

Capture:

```text
typed responder name
recipient email known by the proof
server timestamp
revision ID
file SHA-256
approval statement snapshot
checklist snapshot
review fingerprint
user agent
privacy-conscious IP/security metadata
```

Do not claim this is a legally binding electronic-signature system without legal review.

Safer language:

> **Documented approval record**

---

# 42. Email Architecture

## CURRENT PLAN

SendGrid handles transactional email.

Templates:

```text
Proof Ready
Revised Proof Ready
Changes Requested
Approval Received
Approval Confirmation
Reminder
```

Example identity:

```text
ABC Printing via ApproveAProof
```

Reply-To may point to the shop.

Never allow arbitrary email-domain spoofing.

---

# 43. Transactional Dispatch Pattern

## LOCKED

Core business transactions do not depend synchronously on email success.

Pattern:

```text
Approval transaction
        │
        ▼
ProofDispatch: PENDING
        │
        ▼
email processing
        │
    ┌───┴───┐
    ▼       ▼
  SENT    FAILED
            │
            ▼
          RETRY
```

This creates resilience without requiring a message broker.

---

# 44. Scheduled Jobs

## CURRENT PLAN

Initial scheduled work:

```text
automatic reminders
failed-email retry
orphan upload cleanup
retention cleanup
```

Use protected scheduled endpoints initially.

Do not introduce Redis/SQS solely for this.

Jobs must be idempotent.

---

# 45. Automatic Reminders

## HYPOTHESIS

Possible default:

```text
24 hours
72 hours
```

Before every reminder:

```text
verify status == AWAITING_APPROVAL
verify revision still current
verify not approved
verify not canceled
```

Never send stale reminders after approval.

Exact cadence should be validated with customers.

---

# 46. Application Route Direction

## CURRENT PLAN

Conceptual structure:

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

Exact React Router filenames will be determined against the generated scaffold.

---

# 47. Application Code Organization

## CURRENT PLAN

Prefer separation between:

```text
routes
domain
models
services
components
```

Conceptual structure:

```text
app/
├── routes/
├── domain/
│   ├── proofs/
│   ├── plans/
│   └── permissions/
├── models/
├── services/
└── components/
```

Routes should be thin.

Bad:

```text
route:
auth
permissions
database
S3
Stripe
email
state transition
UI
```

Good:

```text
route
  ↓
validate
  ↓
authorize
  ↓
domain/service
  ↓
response
```

---

# 48. Authorization

## LOCKED — SECURITY REQUIREMENT

Every authenticated operation:

```text
authenticate
     ↓
resolve User
     ↓
resolve Membership
     ↓
resolve Organization
     ↓
authorize Resource
     ↓
perform Action
```

Never trust organization ownership supplied by the browser.

Queries involving tenant resources must enforce organization ownership.

Never simply:

```text
find proof where id = suppliedId
```

when organization access matters.

---

# 49. Tenant Isolation

## LOCKED — CRITICAL SECURITY REQUIREMENT

A user from Organization A must never access Organization B through:

- URL manipulation;
- API calls;
- customer IDs;
- proof IDs;
- revision IDs;
- upload endpoints;
- billing endpoints.

Tenant isolation receives dedicated automated tests.

---

# 50. Roles

## CURRENT PLAN

Roles:

```text
OWNER
ADMIN
STAFF
```

OWNER:

- all operations;
- billing;
- organization administration;
- team management.

ADMIN:

- proofs;
- customers;
- most settings;
- team management except ownership/billing where appropriate.

STAFF:

- proofs;
- customers;
- revisions;
- operational workflow.

The MVP UI may initially expose only OWNER.

The server architecture should still understand roles.

---

# 51. Authentication

## CURRENT PLAN

Use Auth0 initially.

Reason:

- already understood from SmartLynx;
- mature authentication infrastructure;
- authentication is not product differentiation;
- reduces unnecessary simultaneous infrastructure changes.

Flow:

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

Organization permissions and subscription state belong in PostgreSQL, not solely Auth0 metadata.

---

# 52. Session Security

## LOCKED

Session cookies should use appropriate:

```text
HttpOnly
Secure
SameSite
```

settings.

Authenticated mutations require appropriate CSRF/origin protection.

Rotate sessions where authentication transitions warrant it.

---

# 53. Rate Limiting

## CURRENT PLAN

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

Do not rely exclusively on IP because businesses often share public addresses.

---

# 54. Input Validation

## LOCKED

All server actions validate inputs.

Examples:

```text
emails
names
IDs
proof titles
job numbers
comments
file metadata
colors
URLs
```

All customer-controlled strings receive explicit maximum lengths.

Do not allow arbitrary HTML.

Avoid `dangerouslySetInnerHTML` for customer data.

---

# 55. Content Security Policy

## CURRENT PLAN — SECURITY PRIORITY

Establish CSP early.

Restrict:

```text
default-src
script-src
connect-src
img-src
frame-src
object-src
```

Do not place marketing trackers on customer review routes.

Review URLs may contain commercially sensitive information.

---

# 56. Review Privacy

## LOCKED

Customer proof pages:

```text
noindex
nofollow
noarchive
```

Use strict referrer policy such as:

```text
Referrer-Policy: no-referrer
```

Never include review URLs in sitemaps.

Never send raw review tokens to analytics providers.

---

# 57. Logging

## LOCKED

Safe structured log fields may include:

```text
request ID
organization ID
proof ID
revision ID
user ID
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
Stripe secrets
SendGrid keys
AWS secrets
```

Use request correlation IDs.

---

# 58. Secret Management

## LOCKED

Secrets live in environment configuration/secret management.

Never commit:

```text
DATABASE_URL
Auth0 secret
AWS credentials
Stripe secret
SendGrid key
session secret
cron secret
```

Separate:

```text
development
preview/staging
production
```

credentials.

Any credential copied from old SmartLynx should be considered for rotation rather than blindly reused.

---

# 59. Stripe Architecture

## LOCKED

Billing belongs to Organization.

Stripe is authoritative for payment status.

PostgreSQL stores cached subscription/entitlement state.

Webhook requirements:

- verify Stripe signature;
- idempotently process events;
- never trust client subscription state;
- protect against duplicate events.

---

# 60. Entitlements

## LOCKED ARCHITECTURAL PATTERN

Centralize plan logic.

Functions may include:

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

through route code.

UI gating is convenience.

Server enforcement is authoritative.

---

# 61. Pricing Architecture

## HYPOTHESIS

Possible internal plan names:

```text
FREE
STARTER
SHOP
```

Possible structure:

```text
FREE
small number of sends
1 user

STARTER
higher send limit
branding
reminders

SHOP
generous usage
team members
branding
reminders
advanced records
```

Pricing and exact limits remain unvalidated.

Do not let hypothetical pricing block MVP development.

---

# 62. Usage Accounting

## CURRENT PLAN

Likely billing unit:

> A proof send occurs when a new revision is successfully sent to a customer for review.

A reminder should not count as a new proof send.

`ProofDispatch` can provide an auditable usage source.

At larger scale, introduce monthly aggregate counters if query performance requires them.

---

# 63. Historical Data

## LOCKED

Historical approval evidence must survive ordinary customer/contact changes.

Deleting a Customer should not automatically destroy Proof history.

Proof stores recipient snapshots:

```text
recipientName
recipientEmail
```

Sent revisions retain:

```text
file
revision number
hash
approval wording
checklist
sent time
```

Approved responses retain:

```text
approved revision
responder
timestamp
approval wording
fingerprint
```

Normal application APIs do not rewrite historical decisions.

---

# 64. Approval Record PDF

## POST-MVP / NEAR-MVP

A downloadable approval record may include:

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

The PDF is a representation of the authoritative database record.

The PDF itself is not the source of truth.

---

# 65. Dashboard Philosophy

## LOCKED PRODUCT PRINCIPLE

The dashboard should answer:

> **What is holding up production?**

It should not primarily answer:

> What files did I share?

Likely primary indicators:

```text
Awaiting Approval
Changes Requested
Approved Today
```

Primary operational section:

```text
NEEDS ATTENTION
```

---

# 66. Proof List

## CURRENT PLAN

Filters:

```text
All
Awaiting Approval
Changes Requested
Approved
Draft
```

Pagination from the beginning.

Never load an organization's complete proof history into application memory.

Primary database pattern:

```text
organization
+
status
+
updated/created time
```

---

# 67. Proof Detail

Likely contents:

```text
proof name
job number
customer
recipient
status
current revision
preview
revision history
activity timeline
```

Actions depend on state.

Examples:

### Awaiting Approval

```text
Send Reminder
Copy Review Link
Cancel
```

### Changes Requested

```text
View Comments
Upload New Revision
```

### Approved

```text
Download Approved Revision
Download Approval Record
```

---

# 68. New Proof UX

## PRODUCT GOAL

Creating and sending a proof should be extremely fast.

Minimal information:

```text
Customer
Proof Name
Job Number optional
Recipient Name
Recipient Email
File
```

Actions:

```text
SAVE DRAFT
SEND FOR APPROVAL
```

Goal:

> An existing-customer proof should comfortably take less than a minute to create and send.

---

# 69. Customer Management

## LOCKED PRODUCT BOUNDARY

Customer records remain intentionally small.

Display:

```text
company
contact
email
phone
open proofs
past approvals
```

Do not casually add:

```text
sales pipelines
CRM notes
tasks
invoices
quotes
campaigns
```

---

# 70. Accessibility

## CURRENT PLAN

Target solid WCAG AA fundamentals.

Requirements:

- semantic controls;
- keyboard accessibility;
- visible focus states;
- adequate contrast;
- form labels;
- associated errors;
- status never conveyed by color alone.

This is particularly important because customers reviewing proofs may not be technically sophisticated.

---

# 71. Scalability Strategy

## LOCKED PHILOSOPHY

Build for scalability without prematurely building distributed infrastructure.

Initial architecture should comfortably support:

```text
10 shops
100 shops
1,000 shops
10,000+ shops
```

before fundamental redesign should be necessary.

The central model remains:

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

# 72. Database Scalability

Use PostgreSQL indexes around real access patterns.

Important indexes:

```text
Proof:
organizationId + status
organizationId + createdAt

Revision:
proofId + revisionNumber

Response:
proofId + occurredAt

Activity:
proofId + occurredAt

Dispatch:
status + scheduledAt
```

Use appropriate connection pooling for the hosting environment.

Avoid N+1 queries.

Do not shard.

Do not create one database per organization.

---

# 73. Application Scalability

Application servers should remain stateless.

Persistent state lives in:

```text
PostgreSQL
S3
```

Files upload directly to S3.

Email work is retryable.

Scheduled jobs are idempotent.

Any web instance should be capable of serving any request.

---

# 74. Caching

## LOCKED FOR EARLY MVP

Do not add Redis just because scalable systems sometimes use Redis.

Authenticated operational data should usually be current.

Add specialized caching only when measurements justify it.

Potential future reasons:

```text
distributed rate limiting
heavy repeated queries
job infrastructure
```

---

# 75. Backups

## REQUIRED BEFORE MEANINGFUL PRODUCTION USE

PostgreSQL:

- automatic backups;
- point-in-time recovery where available;
- documented restore process;
- actual restore testing.

S3:

- encryption;
- versioning where economically reasonable;
- lifecycle rules.

A backup is not proven until restoration has been tested.

---

# 76. Data Retention

## HYPOTHESIS

Potential policy:

```text
active paid account:
retain approval history

canceled account:
limited export/recovery period

after retention window:
delete customer data and S3 objects
```

Exact retention periods require business/privacy decisions later.

Architecture must support deletion cleanly.

---

# 77. Monitoring

Before meaningful production use, monitor:

```text
HTTP failures
database failures
upload failures
approval endpoint failures
SendGrid failures
Stripe webhook failures
scheduled-job failures
S3 failures
latency
```

Use application exception monitoring such as Sentry or equivalent.

Particularly important alerts:

```text
approval errors
Stripe webhook repeated failure
email queue backlog
scheduled jobs not executing
```

---

# 78. Security Test Checklist

## REQUIRED BEFORE PUBLIC LAUNCH

Automated tests should verify:

- User cannot access another organization.
- User cannot presign upload for another organization.
- Browser cannot choose arbitrary S3 storage keys.
- Customer cannot access another proof by changing an ID.
- Raw review token is not leaked through internal APIs.
- Regenerated review link invalidates previous token.
- Customer cannot approve a stale revision.
- Customer cannot approve a canceled proof.
- Customer cannot approve an unsent revision.
- Approved revision cannot be overwritten.
- Concurrent revision creation cannot duplicate revision numbers.
- Duplicate approval request does not duplicate the approval.
- SendGrid failure does not erase approval.
- Plan UI cannot be bypassed through direct API requests.
- Free account cannot abuse presigned uploads.
- Malicious filename cannot manipulate storage paths.
- HTML/SVG uploads are rejected.
- Oversized files are rejected.
- Cross-tenant customer IDs are rejected.
- Reminder cannot send after approval.
- Internal scheduled endpoints require authentication.

---

# 79. Critical Integration Test

The most important full workflow test:

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
Shop uploads Revision 2
     ↓
Revision 2 sent
     ↓
Customer approves Revision 2
     ↓
Dashboard displays APPROVED
     ↓
Approval record references Revision 2
```

This test represents the core product.

---

# 80. Features Explicitly Deferred

## DO NOT BUILD WITHOUT EVIDENCE

- full CRM;
- quoting;
- invoicing;
- inventory;
- production scheduling;
- online store;
- customer accounts;
- complicated approval chains;
- live annotation/drawing;
- PDF editing;
- revision visual diffing;
- SMS;
- AI functionality;
- QuickBooks integration;
- Printavo integration;
- shopVOX integration;
- Zapier;
- customer-facing webhooks;
- custom domains;
- payment collection;
- electronic-signature-provider integration.

---

# 81. Future Architecture Possibilities

The core architecture intentionally permits later additions.

### Annotations

```text
ProofAnnotation
revisionId
page
coordinates
comment
```

### Multiple approvers

```text
ProofRecipient
```

### SMS

Additional dispatch channel.

### Integrations

Potential events:

```text
proof.sent
proof.changes_requested
proof.approved
```

### Custom review domains

Organization domain mapping.

None belong in MVP until justified.

---

# 82. SmartLynx Relationship

## LOCKED

SmartLynx is frozen.

Do not transform the old repository into ApproveAProof.

It exists as reference material.

Useful implementation knowledge includes:

- Auth0 flow;
- sessions;
- direct S3 uploads;
- signed S3 reads;
- SendGrid;
- Stripe Checkout;
- Billing Portal;
- Stripe webhooks;
- Prisma/PostgreSQL;
- Vercel deployment;
- Tailwind;
- testing patterns.

Reuse knowledge and good patterns.

Do not blindly copy code.

---

# 83. SmartLynx Problems We Intend to Avoid

Known lessons:

- entitlement enforcement must happen before upload authorization;
- browser must not control S3 object identity;
- API permissions cannot depend on UI gating;
- operational dashboard should not become one giant component;
- approval records should not be treated like analytics;
- orphaned files require cleanup;
- plan logic should be centralized;
- tenant ownership must be enforced server-side;
- avoid N+1 database patterns.

These lessons should directly influence ApproveAProof implementation.

---

# 84. Development Roadmap

## PHASE 0 — Foundation

Current phase.

Tasks:

- inspect React Router boilerplate;
- remove unnecessary starter code;
- establish project structure;
- TypeScript configuration;
- environment validation;
- lint/format conventions;
- testing conventions;
- CI basics;
- development/production configuration.

---

## PHASE 1 — Database

Tasks:

- PostgreSQL connection;
- Prisma;
- initial migrations;
- development database;
- database utility layer.

No proof functionality yet.

---

## PHASE 2 — Identity and Tenant Foundation

Tasks:

- Auth0;
- User;
- Organization;
- Membership;
- initial organization creation;
- organization resolver;
- authorization helpers;
- authenticated `/app` shell.

Critical milestone:

> Tenant isolation works before proof functionality exists.

---

## PHASE 3 — Core Domain

Build:

- Customer;
- Proof;
- ProofRevision;
- ProofResponse;
- ProofActivity;
- ProofDispatch;
- state-machine logic.

Write domain tests before elaborate UI.

---

## PHASE 4 — Secure Uploads

Build:

- S3 configuration;
- server-created object paths;
- revision allocation;
- presigned direct upload;
- upload finalization;
- object verification;
- integrity/hash handling;
- orphan cleanup.

Milestone:

> Shop can create a proof and securely attach an immutable revision.

---

## PHASE 5 — Internal Proof Workflow

Build:

- dashboard shell;
- proof list;
- new proof;
- proof detail;
- customer creation;
- revision history;
- state display.

---

## PHASE 6 — Public Review

Build:

- secure review-token generation;
- hashed-token storage;
- public review route;
- PDF.js;
- image preview;
- shop branding;
- checklist;
- responsive/mobile UI.

Milestone:

> Customer can securely review a proof without creating an account.

---

## PHASE 7 — Request Changes

Build:

- required comments;
- revision validation;
- transactional response;
- state transition;
- activity timeline;
- shop notification.

Milestone:

> First complete revision loop works.

---

## PHASE 8 — Approval

Most security-sensitive product phase.

Build:

- approval confirmation;
- typed responder identity;
- database transaction;
- row/state validation;
- stale-revision protection;
- snapshotting;
- review fingerprint;
- idempotency;
- approved-state locking.

Milestone:

> Exact revision can be reliably approved.

---

## PHASE 9 — Email

Build:

- SendGrid templates;
- dispatch abstraction;
- retry behavior;
- proof-ready email;
- revision-ready email;
- change-request email;
- approval notification;
- approval confirmation.

---

## PHASE 10 — Operational Dashboard

Build:

```text
Awaiting Approval
Changes Requested
Approved Today
Needs Attention
```

Add:

- filtering;
- pagination;
- manual reminder;
- recent approvals.

---

## PHASE 11 — Reminders

Build:

- scheduled jobs;
- reminder eligibility;
- 24/72-hour hypothesis;
- retry logic;
- approval/cancellation recheck.

---

## PHASE 12 — Billing

Build:

- organization Stripe customer;
- Checkout;
- Billing Portal;
- webhook verification;
- subscription status;
- centralized entitlements;
- usage enforcement.

Do not allow billing work to delay early customer validation unnecessarily.

---

## PHASE 13 — Branding and Settings

Build:

- business identity;
- logo;
- accent color;
- default approval statement;
- checklist defaults;
- reply-to email.

---

## PHASE 14 — Approval Record

Build downloadable approval-record PDF from authoritative data.

---

## PHASE 15 — Security and Production Hardening

Complete:

- security test suite;
- rate limiting;
- CSP;
- CSRF/origin protections;
- logging review;
- secret rotation;
- backup verification;
- monitoring;
- error tracking;
- load testing;
- accessibility review;
- mobile review;
- cross-browser review.

---

## PHASE 16 — Initial Customer Launch

Goal:

> Approximately 10 real businesses regularly sending actual customer proofs.

The first success metric is not traffic.

It is not signups.

It is not social-media attention.

It is:

> **Real businesses trusting ApproveAProof with real proof approvals.**

---

# 85. Go-to-Market Plan

## CURRENT PLAN

Initial acquisition is founder-led direct outreach.

Likely approach:

1. identify local print shops;
2. inspect existing workflow where possible;
3. call or email;
4. ask how artwork approval currently works;
5. demonstrate ApproveAProof;
6. get real proofs flowing through the system;
7. observe friction;
8. improve product based on actual use.

Colorado provides a practical first market.

Do not initially rely on:

- SEO;
- paid advertising;
- broad content marketing;
- viral growth.

---

# 86. Sales Positioning

Possible message:

> **Still approving print proofs through email? ApproveAProof gives your customers one clear place to review the current version, request changes, or approve it for production—and gives your shop a record of exactly what they approved.**

This is positioning direction, not locked final marketing copy.

---

# 87. Outsourced Sales

## BACKLOG

Do not outsource the sales process before founder-led outreach proves:

- who buys;
- why they buy;
- objections;
- demo flow;
- pricing;
- sales cycle.

Later possibilities:

- contract salesperson;
- Reddit-based sales contractor;
- fixed customer-acquisition bounty;
- first 2–3 months of revenue as commission.

Avoid indefinite recurring commissions unless economically justified.

Require:

- lead tracking;
- attribution;
- clawback rules;
- anti-spam requirements.

---

# 88. Domain Strategy

## CURRENT PLAN

Canonical marketing site:

```text
approveaproof.com
```

Application:

```text
approveaproof.app
```

Potential marketing architecture:

```text
approveaproof.com/print-shops
approveaproof.com/sign-shops
approveaproof.com/screen-printing
approveaproof.com/vehicle-wraps
approveaproof.com/embroidery
```

Industry-specific domains may later redirect to these pages.

Do not create separate products for each industry.

---

# 89. Brand Decision

## CURRENT PLAN

Brand:

# ApproveAProof

Advantages:

- immediately explains the action;
- memorable;
- exact-match `.com` obtained/selected;
- works beyond printing;
- naturally describes iterative proofing;
- does not imply that the first submitted design is necessarily final.

Important caveat:

The name is descriptive and may therefore have weaker trademark distinctiveness than an invented brand.

Formal trademark clearance has not been performed.

---

# 90. Important Product Language

Prefer language such as:

```text
Proof
Revision
Review
Request Changes
Approve for Production
Awaiting Approval
Changes Requested
Approved
Approval Record
```

Avoid confusing customers by using:

```text
Final Design
Final File
Final Approval
```

when the workflow may involve multiple revisions.

The user specifically rejected naming centered around "FinalOK" for this reason.

---

# 91. Decision Log

## D-001 — Rebuild instead of pivoting SmartLynx in place

**Decision:** Create a clean new repository.

**Reason:** The visible product and domain architecture differ substantially from SmartLynx. Reusing the old schema/dashboard would introduce unnecessary baggage.

**Status:** LOCKED

---

## D-002 — Keep SmartLynx as reference

**Decision:** Do not delete SmartLynx.

**Reason:** Existing implementations of Auth0, S3, SendGrid, Stripe, Prisma, and deployment remain useful references.

**Status:** LOCKED

---

## D-003 — Modular monolith

**Decision:** One application rather than microservices.

**Reason:** Lower complexity, easier development, sufficient scalability.

**Status:** LOCKED

---

## D-004 — Single PostgreSQL database

**Decision:** Do not reproduce SmartLynx's second analytics database.

**Reason:** Approval data is transactional business truth. One database simplifies correctness and operations.

**Status:** LOCKED

---

## D-005 — Organization-first tenancy

**Decision:** Proofs, billing, branding, and customers belong to Organization.

**Reason:** Prevents difficult migration when shops add employees.

**Status:** LOCKED

---

## D-006 — Immutable revisions

**Decision:** Uploaded/sent revisions are never overwritten.

**Reason:** Approval must correspond to the exact artifact reviewed.

**Status:** LOCKED

---

## D-007 — Approval references exact revision

**Decision:** ProofResponse points directly to ProofRevision.

**Reason:** This is the central integrity property of the application.

**Status:** LOCKED

---

## D-008 — Private S3

**Decision:** Files remain private and are viewed using temporary signed URLs.

**Reason:** Proof artwork may be commercially sensitive.

**Status:** LOCKED

---

## D-009 — Hashed public review tokens

**Decision:** Store hashes rather than raw bearer tokens.

**Reason:** Database/log exposure should not automatically expose usable review links.

**Status:** LOCKED

---

## D-010 — Direct browser-to-S3 uploads

**Decision:** Application server authorizes uploads but does not carry normal file bytes.

**Reason:** Better scalability, lower bandwidth cost, cleaner server architecture.

**Status:** LOCKED

---

## D-011 — Email failure cannot invalidate approval

**Decision:** Approval commits independently of SendGrid.

**Reason:** Customer decisions are more important than notification delivery.

**Status:** LOCKED

---

## D-012 — Centralized entitlements

**Decision:** Plan checks live in one domain/service layer.

**Reason:** Avoid SmartLynx-style scattered UI/API plan logic.

**Status:** LOCKED

---

## D-013 — Initial file types

**Decision:** Start with PDF/JPEG/PNG.

**Reason:** Covers primary proof use cases while reducing active-content/security complexity.

**Status:** CURRENT PLAN

---

## D-014 — Auth0 initially retained

**Decision:** Use Auth0 rather than changing authentication technology during the product rebuild.

**Reason:** Proven knowledge from SmartLynx and authentication is not product differentiation.

**Status:** CURRENT PLAN

---

## D-015 — React Router Framework Mode

**Decision:** New application scaffold uses current React Router Framework Mode rather than the legacy Remix 2 generator.

**Reason:** Current framework direction for this architecture.

**Status:** LOCKED unless a major technical issue appears.

---

## D-016 — User controls Git workflow

**Decision:** Development collaboration uses copy/paste code into local VS Code.

**Workflow:**

- ChatGPT provides architecture, review, instructions, and copy/paste-ready code.
- User edits locally.
- User runs commands.
- User makes commits.
- User pushes.
- User controls deployments.

**Status:** LOCKED workflow preference.

---

# 92. Development Collaboration Protocol

To reduce mistakes:

### Before each significant implementation

We should establish:

1. what we are building;
2. why;
3. files affected;
4. security implications;
5. database implications;
6. tests required.

### During implementation

Prefer small coherent changes.

Avoid giving dozens of unrelated files in one step when incremental verification is possible.

### After implementation

Verify:

```text
npm build/test commands
application runs
expected behavior
security invariants
```

Then user decides when to commit.

---

# 93. Commit Philosophy

## CURRENT PLAN

Prefer meaningful checkpoints.

Examples:

```text
chore: clean initial React Router scaffold

chore: add environment validation

feat: add Prisma and PostgreSQL foundation

feat: add organization membership model

feat: add authenticated application shell

feat: add proof domain models

feat: add secure revision uploads

feat: add customer proof review

feat: add proof approval transaction
```

Avoid giant commits containing multiple unrelated architectural phases.

---

# 94. Definition of MVP

ApproveAProof is MVP-ready when this works reliably:

```text
Shop logs in.

Shop creates customer.

Shop creates proof.

Shop uploads Revision 1.

Shop sends proof.

Customer receives email.

Customer opens proof on phone.

Customer reviews Revision 1.

Customer requests changes.

Shop sees request.

Shop uploads Revision 2.

Shop sends Revision 2.

Customer reviews Revision 2.

Customer selects APPROVE FOR PRODUCTION.

Customer confirms identity and approval.

Server verifies Revision 2 is still current.

Approval commits transactionally.

Shop sees APPROVED.

Revision 1 remains preserved.

Revision 2 remains preserved.

Approval points specifically to Revision 2.

Shop can see who approved it and when.
```

If this experience is excellent, the application is sellable.

---

# 95. Success Criteria

Early success is not:

```text
10,000 visitors
1,000 free accounts
SEO ranking
social followers
```

Early success is:

```text
10 businesses
regularly sending
real customer proofs
through ApproveAProof
```

From those customers we learn:

- what is confusing;
- what is missing;
- what saves time;
- what prevents mistakes;
- what they will pay for;
- what adjacent features are genuinely valuable.

---

# 96. Product Development Rule

## LOCKED

When choosing between:

> adding another feature

and:

> making the core approval workflow clearer, faster, safer, and more reliable

choose the second until customers prove otherwise.

---

# 97. Security Development Rule

## LOCKED

Security is not a final launch phase.

Every feature must consider:

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

Security hardening occurs throughout development.

Phase 15 is verification and reinforcement, not the first time security is considered.

---

# 98. Scalability Development Rule

## LOCKED

Design data boundaries and asynchronous work so scaling remains possible.

Do not prematurely introduce:

```text
microservices
Redis
Kafka
SQS
multiple databases
Kubernetes
```

without demonstrated need.

Scalable simplicity is preferred to speculative complexity.

---

# 99. Current Working Checkpoint

**Date:** September 9, 2026

Repository:

```text
Created
```

Framework:

```text
React Router Framework Mode
```

Application scaffold:

```text
Created
```

Local development:

```text
Working
```

Initial repository push:

```text
Completed
```

Product code:

```text
Not started
```

Database:

```text
Not configured
```

Authentication:

```text
Not configured
```

S3:

```text
Not configured
```

Stripe:

```text
Not configured
```

SendGrid:

```text
Not configured
```

This is intentional.

We currently have a clean, functioning framework scaffold.

---

# 100. NEXT SESSION

## Start here.

### Step 1

Inspect the exact generated React Router scaffold.

Do not assume its structure from SmartLynx.

### Step 2

Remove unnecessary demo/boilerplate content.

Verify application still runs.

### Step 3

Establish clean project organization.

### Step 4

Establish:

- environment-variable validation;
- TypeScript expectations;
- formatting/linting;
- testing baseline;
- `.gitignore`/secret hygiene.

### Step 5

Run production build locally.

Confirm clean baseline.

### Step 6

Commit the foundation.

Suggested commit:

```text
chore: establish ApproveAProof project foundation
```

### Step 7

Begin PostgreSQL + Prisma.

Only after the application foundation is clean.

---

# 101. Questions We Intentionally Have Not Answered Yet

These are not blockers.

### Pricing

Unknown.

Requires validation.

### Exact free-plan limit

Unknown.

Requires product economics and customer testing.

### Exact file-size limits

Tentative only.

### Reminder cadence

24/72 hours is a hypothesis.

### Team functionality at launch

Architecture supports it; UI timing undecided.

### Approval-record PDF timing

Likely near-MVP but not necessary for first core workflow.

### Malware scanning

Architecture supports it; full scanning not initially required.

### Raw-IP retention policy

Needs privacy decision before production.

### Customer data-retention period

Needs business/privacy decision.

### Custom domains

Future possibility.

### SMS

Future possibility.

### Annotations

Future possibility.

None should distract from building the core workflow.

---

# 102. Questions to Ask During Customer Validation

Once the product can be demonstrated, ask shops:

1. How do customers approve proofs today?
2. Who sends the proof?
3. What file format do you normally send?
4. How many revisions does a typical job require?
5. What exactly counts as approval in your shop?
6. Have you ever had a disagreement about what was approved?
7. Do customers usually review proofs on phones or computers?
8. How long do approvals typically take?
9. Do you manually follow up when someone hasn't approved?
10. Who needs to know when approval arrives?
11. Do multiple people ever need to approve?
12. Do you need the customer's signature, or simply a clear documented approval?
13. How long do you keep proof records?
14. What software already runs the shop?
15. What would make you unwilling to add another tool?
16. What would make this worth paying for every month?

Do not lead customers toward features we want to build.

Listen for repeated problems.

---

# 103. Long-Term Product Test

Before adding any major feature, ask:

> **Does this make the journey from "proof ready" to "safe to produce" materially better?**

If yes, investigate.

If not, it probably belongs outside ApproveAProof.

---

# 104. Canonical Architecture Summary

The system can ultimately be reduced to this:

```text
                    ORGANIZATION
                         │
                    ┌────┴────┐
                    │         │
                 CUSTOMER    USERS
                    │
                    ▼
                   PROOF
                    │
                    ▼
              PROOF REVISION
              (immutable file)
                    │
              ┌─────┴─────┐
              │           │
              ▼           ▼
        REQUEST CHANGES  APPROVE
              │           │
              ▼           ▼
        NEW REVISION   RESPONSE
                          │
                          ▼
                 APPROVAL RECORD
```

Infrastructure:

```text
React Router / React / TypeScript
                │
                ▼
            PostgreSQL
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
       S3    SendGrid  Stripe
```

Security boundary:

```text
User
 ↓ authentication
Membership
 ↓ authorization
Organization
 ↓ ownership
Resource
```

Public review boundary:

```text
Random Token
     ↓
SHA-256 lookup
     ↓
Proof
     ↓
Current Revision
     ↓
Short-lived S3 access
```

Approval integrity:

```text
Customer decision
       +
Exact Revision
       +
File SHA-256
       +
Approval wording
       +
Checklist
       +
Server timestamp
       ↓
ProofResponse
```

That is ApproveAProof.

---

# 105. The Ten Rules

If this document becomes too long to reread during development, remember these ten rules.

### 1. A proof is not a file.

It is an approval process containing revisions.

### 2. Revisions are immutable.

Never overwrite what a customer reviewed.

### 3. Approval belongs to an exact revision.

Never merely mark a proof "approved."

### 4. The server owns truth.

Never trust browser-provided ownership, storage identity, plan state, revision identity, or timestamps.

### 5. Tenant isolation is mandatory.

Every private resource belongs to an organization.

### 6. Customer files remain private.

Use secure bearer review tokens and temporary S3 access.

### 7. Customer decisions are transactional.

Email, analytics, and notifications cannot determine whether approval succeeded.

### 8. Keep the infrastructure boring.

PostgreSQL + S3 + one application is enough until reality proves otherwise.

### 9. Do not build a print MIS.

Fix proof approval exceptionally well.

### 10. The product exists to establish one trustworthy fact:

> **This customer approved this exact revision at this exact time.**

---

# END OF CURRENT MASTER PLAN

**Current checkpoint:** Clean React Router application scaffold is running and pushed to the new ApproveAProof repository.

**Next action:** Inspect and clean the generated boilerplate, establish the project foundation, and then begin PostgreSQL/Prisma.

**Do not skip ahead without a reason.**

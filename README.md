# Fix My Problem

An AI-assisted problem-resolution platform. You describe what happened, in your
own words; the product turns that into a structured **Case** and moves it toward
a resolution.

The organising principle is that the Case — not the chat transcript — is the
source of truth. Every claim, document, finding and action is a first-class
record you can read, correct and audit.

> This repository also contains `legionar-sal-18-2-5.html`, an unrelated
> standalone page that predates this application. It is untouched.

## What it does

1. **Understands** a free-text account and turns it into a Case: title, summary,
   goal, category, risk level, first facts and the questions whose answers would
   actually change your options.
2. **Separates claims from evidence.** Everything is labelled "You told us" or
   "Verified by a document". Assumptions are never presented as facts.
3. **Reads what you upload** and connects it to the Case.
4. **Researches** the rules and policies that apply — and says plainly when it
   cannot.
5. **Plans** an ordered set of steps and surfaces exactly one next action.
6. **Drafts** what needs to be sent, and stops. Nothing leaves your hands
   without you seeing the full text, who receives it, and what it discloses.
7. **Follows up** on deadlines, overdue tasks and cases that have gone quiet.
8. **Closes only when you say so.** Performing an action is not the same as
   fixing the problem.

## Honesty rules

These are enforced in code, not just in copy:

- Tools carry an `available` flag. An unconnected capability is shown as *not
  connected*; the orchestrator will not plan around it and never simulates it.
- Research findings always carry their source. If web research is not
  configured, the Research tab says so instead of showing invented findings.
- An action's `deliveryState` is tracked separately from its `status`, so
  "approved" can never read as "sent".
- Risk classification has a rule-based floor a model cannot lower. Legal,
  medical, financial, immigration, tax and safety matters are treated as
  high-risk, and the product never presents itself as a licensed professional.
- Web pages and uploaded documents are fenced as untrusted data. Instructions
  found inside them are reported, never followed.

## Stack

| Layer | Choice | Fallback when unconfigured |
|---|---|---|
| UI | Next.js 15 (App Router), TypeScript, Tailwind | — |
| API | Next.js route handlers, deployable to Cloud Run | — |
| Database | Firestore | local JSON store |
| File storage | Cloud Storage (private) | local disk, owner-only |
| Model | Gemini, schema-constrained output | rule-based provider, labelled as such |
| Research | Google Programmable Search | reported as not connected |

Every one of those sits behind an interface (`DocumentStore`, `EvidenceStorage`,
`AIProvider`, `Tool`, `ActionProvider`), so the Case Engine does not depend on
any single vendor and the app runs end to end with no cloud credentials at all.

## Running locally

```bash
npm install
cp .env.example .env.local     # optional; sensible defaults apply
npm run dev                    # http://localhost:3000
```

With no configuration you get: the local JSON store (`.data/`), local file
storage, the rule-based provider, and research reported as unavailable. The
whole flow works — the UI is explicit about which parts are running on rules.

To use real models and data, set `GEMINI_API_KEY`, `DATA_BACKEND=firestore`,
`GOOGLE_CLOUD_PROJECT` and `EVIDENCE_BUCKET`.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deploying to Cloud Run

```bash
gcloud run deploy fix-my-problem \
  --source . \
  --region us-central1 \
  --set-env-vars DATA_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT,EVIDENCE_BUCKET=$BUCKET \
  --set-secrets SESSION_SECRET=fmp-session-secret:latest,GEMINI_API_KEY=fmp-gemini-key:latest
```

The service account needs `roles/datastore.user` and
`roles/storage.objectAdmin` on the evidence bucket. Deploy the deny-all rules in
`firestore.rules` and `storage.rules`: all access goes through the server, which
checks ownership itself, so no client should ever reach either directly.

Create the composite indexes with
`firebase deploy --only firestore:indexes` using `firestore.indexes.json`.

## Architecture

```
src/
  domain/          Case, Fact, Evidence, Action… plus status machine, taxonomy, risk rules
  lib/             config, errors, logging, validation, formatting
  server/
    ai/            AIProvider interface, Gemini + rule-based providers, output schemas, injection defence
    agents/        intake, investigation, evidence, planning, action, follow-up, risk, orchestrator
    tools/         typed tool registry with availability flags
    services/      case engine, notifications, audit, action providers
    db/            DocumentStore interface, Firestore and local adapters
    storage/       EvidenceStorage interface, GCS and local adapters
    auth/          sessions, password hashing, server-side user resolution
    http/          route wrapper, rate limiting
  components/      design system + case/landing/navigation components
  app/             routes and API endpoints
```

The **orchestrator** decides which agent acts next from the Case's state, under
three hard bounds — iteration count, tool budget and wall clock. There is no
open-ended autonomous loop.

## Security

- Sessions are HMAC-signed cookies; a user id is never taken from the client.
- Every case-scoped operation re-reads the document and checks ownership
  server-side. Another user's case returns 404, not 403, so its existence is not
  revealed.
- Uploads are validated for type and size, stored outside the served tree, and
  read back only through an authorised route that re-checks ownership.
- `fetchWebPage` refuses loopback and private-range addresses.
- Rate limits apply to sign-in, case creation, messages and uploads.
- Consequential events are written to an append-only audit log, holding
  identifiers and outcomes rather than case content.

## Not built yet

Deliberately absent, and represented in the UI as not connected rather than
faked: outbound email, phone, browser automation, shipment tracking, and the
Gmail/Outlook/calendar/bank/airline/insurer connectors. Each is a registered
tool with an `available: false` flag; adding one means implementing an
`ActionProvider` and registering it. PDF, image and Word text extraction needs a
document-understanding service — the file is stored and the limitation recorded
on the evidence itself.

# Envelope/Document Create API – Performance Change Outline

This document outlines concrete code changes to reduce latency for `api/v2/envelope/create` and `api/v2/document/create`. Apply in the order below for safest rollout.

---

## Compatibility & breakage check (verified)

The following was verified so that implementing these changes **does not break** the app.

### `createEnvelope()` return value – must stay the same shape

- **Envelope router** (`packages/trpc/server/envelope-router/create-envelope.ts`): returns `{ id: envelope.id }`. Only needs `envelope.id`.
- **Document router** (`packages/trpc/server/document-router/create-document.ts`): returns `{ envelopeId: document.id, id: mapSecondaryIdToDocumentId(document.secondaryId) }`. Needs `envelope.id` and `envelope.secondaryId`.
- **Document create temporary** (`packages/trpc/server/document-router/create-document-temporary.ts`): uses `createdEnvelope.id`, `createdEnvelope.secondaryId`, `createdEnvelope.documentMeta`, `createdEnvelope.fields`, `createdEnvelope.recipients`, `createdEnvelope.folder`. **Requires the full envelope** with those includes.
- **Template router** (`packages/trpc/server/template-router/router.ts`): uses `envelope.id` and `envelope.secondaryId` for return; api v1 template create then calls `getTemplateById(createdTemplate.id)` and does not rely on other fields from `createEnvelope`.
- **API v1** (`packages/api/v1/implementation.ts`): document create uses `envelope.secondaryId`; template create uses `createdTemplate.id` for `getTemplateById`.
- **Embedding routers**: use `envelope.id`, `envelope.secondaryId`, and (template) `template.envelopeItems[0]`.

**Conclusion:** The **return type of `createEnvelope()` must remain a full envelope** with at least: `id`, `secondaryId`, `documentMeta`, `recipients`, `fields`, `folder`, `envelopeAttachments`, `envelopeItems` (with `documentData` if any caller needs it). So when implementing §1 and §2: **do the heavy `findFirst` after the transaction** and return that same object from `createEnvelope()`. Do not change the public return shape; only move where the read happens (after commit instead of inside the transaction).

### Frontend

- **Envelope create** (`envelope-drop-zone-wrapper.tsx`, `envelope-upload-button.tsx`): expect `{ id }` from the mutation and navigate to `/${id}/edit`. The TRPC route returns `{ id: envelope.id }` — unchanged.
- **Document create (legacy)** (`document-upload-button-legacy.tsx`): expect `{ envelopeId: id }` from `createDocument` and navigate to `/${id}/edit`. The document route returns `{ envelopeId, id }` — unchanged.

No frontend changes are required.

### Webhook

- `mapEnvelopeToWebhookDocumentPayload(envelope)` expects an envelope with `recipients`, `documentMeta`, and scalar fields (`secondaryId`, `type`, `status`, `createdAt`, etc.). It does **not** use `envelopeItems` or `documentData`.
- Triggering the webhook **after** the transaction (with the envelope loaded in the post-TX fetch) yields the same payload. Subscribers see no change. Webhooks are async; no code depends on the webhook being sent before the API response.

### `getTeamSettings` (change §3)

- We do **not** change the `getTeamSettings()` function itself. We only change `create-envelope.ts` to stop calling it and instead derive settings from the single team fetch using `extractDerivedTeamSettings(team.organisation.organisationGlobalSettings, team.teamGlobalSettings)`. All other callers of `getTeamSettings()` (e.g. email context, other flows) are unaffected.

### Implementation caveat for §1 + §2

- When you move the `findFirst` to **after** the transaction, use the **exact same** `include` as today: `documentMeta`, `recipients`, `fields`, `folder`, `envelopeAttachments`, `envelopeItems: { include: { documentData: true } }`. That way `create-document-temporary` and any code that expects the full envelope keep working. The gain is from shortening the transaction (no long read + no webhook inside TX), not from slimming the response.

---

## 1. Move webhook trigger outside the transaction (highest impact)

**File:** `packages/lib/server-only/envelope/create-envelope.ts`

**Problem:** `triggerWebhook()` runs inside `prisma.$transaction`. It performs a DB query (`getAllWebhooksByEventTrigger`) and then `await`s one or more `jobs.triggerJob()` calls (e.g. Inngest `client.send()`). The transaction stays open until all of that completes, increasing lock time and making the API wait on external I/O.

**Change:**

1. **Inside the transaction:** Remove the `triggerWebhook` call and the heavy `findFirst` used only for the webhook payload (see §2). Keep the transaction returning only what’s needed for the response (e.g. envelope id and minimal data for audit logs).

2. **After the transaction:** Call `triggerWebhook` only after the transaction has committed. The webhook payload needs the created envelope; load it once after the transaction with the same `include` you use today (or a slimmer one if the webhook schema allows).

**Concrete steps:**

- In the transaction callback, after creating the audit log(s), do **not** call `triggerWebhook`.
- Still create `documentAuditLog` entries inside the transaction as today.
- Before `return createdEnvelope` from the transaction, return a minimal object that includes at least `envelope.id` (and any other ids needed for a follow-up query). Optionally return the full `createdEnvelope` from the existing `findFirst` for use outside the transaction (see §2).
- After `prisma.$transaction(...)` resolves, if `type === EnvelopeType.DOCUMENT`:
  - Fetch the envelope once (see §2) if you didn’t return it from the transaction.
  - Call `await triggerWebhook({ event: WebhookTriggerEvents.DOCUMENT_CREATED, data: mapEnvelopeToWebhookDocumentPayload(envelope), userId, teamId })`.

**Optional (further speed):** Fire the webhook without awaiting (e.g. `void triggerWebhook(...)` or queue a small “send webhook” job) so the API response is not delayed by Inngest. Only do this if you’re comfortable with fire-and-forget semantics and potential duplicate/retry behaviour.

---

## 2. Avoid heavy `findFirst` inside the transaction

**File:** `packages/lib/server-only/envelope/create-envelope.ts`

**Problem:** The transaction does a large `tx.envelope.findFirst` with `include: { documentMeta, recipients, fields, folder, envelopeAttachments, envelopeItems: { include: { documentData: true } } }`. That keeps the transaction open longer and can increase lock contention. `documentData` can be large.

**Change:**

- **Option A (recommended):** Remove this `findFirst` from inside the transaction. Have the transaction return the envelope id (and any other ids you need). After the transaction commits, run a single `prisma.envelope.findFirst({ where: { id }, include: { ... } })` to get the full envelope for:
  - The return value of `createEnvelope`, and
  - The webhook payload (if you still need it; see §1).
- **Option B:** If you keep a read inside the transaction, at least drop `envelopeItems.documentData` from the include (and from the webhook payload if the webhook doesn’t need document bytes). Then load `documentData` only when something actually needs it.

**Concrete steps (Option A):**

- Inside the transaction: after creating recipients and placeholder fields, create the audit log(s). Do **not** run the current `findFirst` with full includes.
- Return from the transaction an object that includes `envelopeId: envelope.id` (and optionally minimal data needed for audit log creation if not already available).
- After the transaction: run **one** `prisma.envelope.findFirst` with the **same full include** as today: `documentMeta`, `recipients`, `fields`, `folder`, `envelopeAttachments`, `envelopeItems: { include: { documentData: true } }`. (Do not slim this include — see “Compatibility & breakage check” above; `create-document-temporary` and others depend on it.) Use the result as the return value of `createEnvelope` and for the webhook payload in §1.

---

## 3. Single team fetch and reuse for settings

**File:** `packages/lib/server-only/envelope/create-envelope.ts`  
**File (optional):** `packages/lib/server-only/team/get-team-settings.ts`

**Problem:** The code fetches the team twice: once with `organisation.organisationClaim` (for folder check and CFR flag), then again in `getTeamSettings()` with `organisation.organisationGlobalSettings` and `teamGlobalSettings`.

**Change:**

- Fetch the team once with all relations needed for both use cases:
  - `organisation: { include: { organisationClaim: true, organisationGlobalSettings: true } }`
  - `teamGlobalSettings: true`
- Derive settings from that single team object instead of calling `getTeamSettings()` (which would do a second query).

**Concrete steps:**

1. In `create-envelope.ts`, replace the current `prisma.team.findFirst` with:

```ts
const team = await prisma.team.findFirst({
  where: buildTeamWhereQuery({ teamId, userId }),
  include: {
    organisation: {
      include: {
        organisationClaim: true,
        organisationGlobalSettings: true,
      },
    },
    teamGlobalSettings: true,
  },
});
```

2. Remove the `getTeamSettings({ userId, teamId })` call.
3. Derive settings using the same logic as `getTeamSettings`: import `extractDerivedTeamSettings` from `../../utils/teams` and set:

```ts
const settings = extractDerivedTeamSettings(
  team.organisation.organisationGlobalSettings,
  team.teamGlobalSettings,
);
```

4. Fix any type issues: `organisationGlobalSettings` may be a single object or the first of an array depending on your schema; use the same shape that `get-team-settings.ts` uses (e.g. `team.organisation.organisationGlobalSettings` as in the current getTeamSettings implementation).
5. Ensure the CFR check still works: `team.organisation.organisationClaim` is already included, so the existing `team.organisation.organisationClaim.flags.cfr21` check remains valid (add a null check if the type allows `organisationClaim` to be null).

---

## 4. Reduce `getServerLimits` round-trips (optional)

**File:** `packages/ee/server-only/limits/server.ts`

**Problem:** `getServerLimits` does several sequential DB calls: `team.findUnique`, `organisationMember.findMany`, `organisation.findFirst` (with claim), `getCurrentSubscriptionByOrganisationId`, `getOrganisationCredits`. This adds fixed latency to every envelope/document create.

**Change:**

- Combine into one or two queries where possible, e.g.:
  - Single query: team + organisation (with `organisationClaim`) + optionally organisation members for the user.
  - Then one query for subscription (if needed) and one for credits, or combine subscription + credits in one query if the schema allows.
- Avoid redundant work: e.g. if you already validated the user’s access to the team elsewhere, you may not need to re-fetch organisation members in limits.

**Concrete steps:**

- Refactor `getServerLimits` to use a single `prisma.team.findFirst` (or `findUnique`) with `include: { organisation: { include: { organisationClaim: true, members: { where: { userId } } } } }` (or equivalent) so you get team, organisation, claim, and membership in one go.
- Then call `getCurrentSubscriptionByOrganisationId(organisation.id)` and `getOrganisationCredits(organisation.id)` (or merge into one query if possible).
- Remove the separate `prisma.organisationMember.findMany` and the second `prisma.organisation.findFirst` that only add latency.

---

## 5. PDF pipeline (envelope/create only)

**File:** `packages/trpc/server/envelope-router/create-envelope.ts`  
**File:** `packages/lib/server-only/pdf/auto-place-fields.ts` (optional)

**Problem:** For each file you do: `insertFormValuesInPdf` → `normalizePdf` → `extractPdfPlaceholders` (which loads the PDF again and calls `removePlaceholdersFromPDF`) → `putPdfFileServerSide` (which loads the PDF again). So each file is loaded multiple times and processed in separate steps.

**Change:**

- Where possible, do a single load and a single save per file: e.g. load once → apply form values → normalize (flatten, etc.) → extract placeholders and remove them in one pass (or extract, then one “clean” pass that does both normalize and remove), then save once and upload.
- Avoid loading the same buffer multiple times in different helpers; pass the in-memory buffer between steps and only call `putPdfFileServerSide` once at the end.

**Concrete steps:**

- In the envelope router’s `Promise.all(files.map(...))`, consider a small helper that:
  1. Loads the PDF once.
  2. Optionally fills form (if you have a way to do it on the loaded doc).
  3. Normalizes (flatten layers/form/annotations).
  4. Extracts placeholders from the normalized buffer; then runs the “remove placeholders” logic on the same buffer (or a single save after remove).
  5. Saves once and passes the result to `putPdfFileServerSide`.
- Alternatively, add an `extractPdfPlaceholders(normalizedPdf, { inPlace: true })` (or similar) that removes placeholders without loading the PDF again, and ensure `putPdfFileServerSide` receives the cleaned buffer so it doesn’t reload from disk.

---

## 6. Counter contention (optional, if you see high concurrency)

**File:** `packages/lib/server-only/envelope/increment-id.ts`  
**File:** `packages/lib/server-only/envelope/create-envelope.ts`

**Problem:** `incrementDocumentId` / `incrementTemplateId` use a single-row `prisma.counter.update` with `increment: 1`. Under high concurrency this row serializes requests.

**Change:**

- Keep the same API (e.g. `incrementDocumentId()` returns `{ documentId, formattedDocumentId }`) but consider:
  - Using a DB sequence or `SELECT ... FOR UPDATE SKIP LOCKED` + update pattern to reduce lock duration, or
  - Batching or pre-generating IDs in a separate process and consuming from a pool (larger change).
- At minimum, ensure the counter update is not holding the row lock longer than necessary (no extra work inside the same transaction that holds the lock).

**Concrete steps:**

- Leave as-is unless you observe contention (e.g. many concurrent creates). If you do, consider moving the increment to the start of the create flow and doing it in a short transaction that only does the counter update and returns; then use the returned id in the main envelope transaction.

---

## Summary

| # | Change | File(s) | Impact |
|---|--------|--------|--------|
| 1 | Move webhook outside transaction | `create-envelope.ts` | High – shorter transaction, no awaiting Inngest inside TX |
| 2 | Heavy findFirst outside TX (or slim include inside) | `create-envelope.ts` | High – shorter TX, less lock time |
| 3 | Single team fetch + derive settings | `create-envelope.ts` | Medium – one fewer DB round-trip |
| 4 | Fewer getServerLimits queries | `limits/server.ts` | Medium – fewer round-trips on every create |
| 5 | Single-pass PDF per file (envelope/create) | envelope router + optional auto-place-fields | Medium for multi-file/large PDFs |
| 6 | Counter strategy (if needed) | `increment-id.ts`, `create-envelope.ts` | Low unless under high concurrency |

Implementing **1** and **2** together gives the largest gain; **3** and **4** are straightforward and reduce redundant DB work. **5** and **6** are optional and can be done later based on load and profiling.

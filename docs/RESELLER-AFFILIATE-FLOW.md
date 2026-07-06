# Reseller & Affiliate Purchase Flow

Complete end-to-end guide for the Nomia e-sign **Reseller Experience**: how an organisation becomes a reseller, how admins approve them, and how end users buy credits through an affiliate link.

---

## Table of contents

1. [Actors & roles](#actors--roles)
2. [High-level overview](#high-level-overview)
3. [Application status lifecycle](#application-status-lifecycle)
4. [Admin flow](#admin-flow)
5. [Client flow (reseller organisation)](#client-flow-reseller-organisation)
6. [User flow (affiliate purchaser)](#user-flow-affiliate-purchaser)
7. [Paystack payment & credit transfer](#paystack-payment--credit-transfer)
8. [End-to-end sequence diagram](#end-to-end-sequence-diagram)
9. [Data model](#data-model)
10. [Routes & URLs reference](#routes--urls-reference)
11. [Testing checklist](#testing-checklist)
12. [Known behaviour & dev notes](#known-behaviour--dev-notes)

---

## Actors & roles


| Actor      | Who they are                                                 | Primary goal                                                |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| **Admin**  | Nomia platform administrator                                 | Review applications, send T&Cs, configure DocGen templates  |
| **Client** | Organisation owner/manager applying to **become a reseller** | Apply, sign terms, configure packages, share affiliate link |
| **User**   | Logged-in customer visiting `**/r/{affiliateSlug}`**         | Buy e-sign credits from a reseller via Paystack             |


```mermaid
flowchart LR
    subgraph Platform["Nomia Platform"]
        Admin["Admin"]
        DocGen["Nomia DocGen"]
        Paystack["Paystack"]
    end

    Client["Client\n(Reseller org)"]
    User["User\n(Purchaser)"]

    Admin -->|"Review & send T&Cs"| Client
    DocGen -->|"Generate / e-sign terms"| Client
    Client -->|"Share affiliate link"| User
    User -->|"Pay for credits"| Paystack
    Paystack -->|"Webhook"| Platform
    Platform -->|"Transfer credits"| User
    Platform -->|"Deduct credits"| Client
```



---

## High-level overview

```mermaid
flowchart TB
    subgraph Phase1["Phase 1 — Application"]
        A1["Client meets eligibility"]
        A2["Client submits application"]
        A3["Status: PENDING"]
    end

    subgraph Phase2["Phase 2 — Admin review & T&Cs"]
        B1["Admin reviews application"]
        B2["Admin sends T&Cs via DocGen"]
        B3["Status: TERMS_SENT"]
    end

    subgraph Phase3["Phase 3 — Activation"]
        C1["Client signs T&Cs"]
        C2["ResellerProfile created"]
        C3["Status: APPROVED"]
        C4["Welcome email with affiliate link"]
    end

    subgraph Phase4["Phase 4 — Reseller setup"]
        D1["Client opens Reseller settings"]
        D2["Enables credit packages"]
        D3["Configures Paystack keys"]
        D4["Shares affiliate URL"]
    end

    subgraph Phase5["Phase 5 — Affiliate purchase"]
        E1["User opens /r/{slug}"]
        E2["User selects package"]
        E3["Paystack checkout"]
        E4["Credits transferred"]
    end

    A1 --> A2 --> A3 --> B1 --> B2 --> B3 --> C1 --> C2 --> C3 --> C4
    C4 --> D1 --> D2 --> D3 --> D4 --> E1 --> E2 --> E3 --> E4
```



---

## Application status lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Client applies

    PENDING --> TERMS_SENT: Admin sends T&Cs
    PENDING --> REJECTED: Admin rejects
    PENDING --> CANCELLED: Client cancels

    TERMS_SENT --> TERMS_COMPLETED: Applicant signs (optional intermediate)
    TERMS_SENT --> APPROVED: Terms signed & profile created
    TERMS_COMPLETED --> APPROVED: Terms signed & profile created

    APPROVED --> [*]: ResellerProfile ACTIVE
    REJECTED --> [*]
    CANCELLED --> [*]

    note right of APPROVED
        ResellerProfile + ResellerPackage rows created.
        Affiliate slug assigned.
    end note
```




| Status            | Meaning                                | Client UI                                        | Admin UI                      |
| ----------------- | -------------------------------------- | ------------------------------------------------ | ----------------------------- |
| `PENDING`         | Application submitted, awaiting review | Apply button disabled; "application in progress" | Visible in applications table |
| `TERMS_SENT`      | T&Cs generated and sent                | No Reseller sidebar yet                          | Can resend T&Cs               |
| `TERMS_COMPLETED` | Signed but not yet fully activated     | No Reseller sidebar yet                          | Rare intermediate state       |
| `APPROVED`        | Reseller activated                     | **Reseller** menu appears                        | Application complete          |
| `REJECTED`        | Declined                               | Can re-apply after reset                         | Shows rejection               |
| `CANCELLED`       | Withdrawn                              | Can re-apply                                     | Archived                      |


---

## Admin flow

### What the admin does

1. **Configure site settings** (one-time setup)
2. **Review pending applications**
3. **Send Terms & Conditions** to selected applicants
4. **Monitor** until reseller is activated (automatic on e-sign completion)

### Step-by-step


| Step | Action                                                                                  | URL / location                                         |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | Log in as admin                                                                         | `/admin`                                               |
| 2    | Open **Site Settings**                                                                  | `/admin/site-settings`                                 |
| 3    | Set reseller DocGen template ID, workspace ID (and optional internal template fallback) | Site Settings → Reseller section                       |
| 4    | Open **Reseller Applications**                                                          | `/admin/reseller-applications`                         |
| 5    | Search/filter applications                                                              | Table supports query by org name, applicant, email     |
| 6    | Select one or more `PENDING` applications                                               | Multi-select in table                                  |
| 7    | Click **Send T&Cs**                                                                     | Opens `SendResellerTermsDialog`                        |
| 8    | Fill template variables (e.g. `Preparedby`, `Client1`, `CEO`, …)                        | Per application                                        |
| 9    | Choose DocGen options                                                                   | Show in Nomia / Build for e-sign / **Send for e-sign** |
| 10   | Submit                                                                                  | Calls `admin.resellerApplications.sendTerms`           |


### Admin send-T&Cs diagram

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin UI
    participant tRPC as tRPC API
    participant Send as send-reseller-terms.ts
    participant DocGen as Nomia DocGen API
    participant Email as Mailer
    participant DB as Database

    Admin->>UI: Select applications + Send T&Cs
    UI->>tRPC: sendTerms(applications, variables, docGenOptions)
    tRPC->>Send: sendResellerTerms()

    loop Each application
        Send->>DB: Load ResellerApplication (PENDING or TERMS_SENT)
        Send->>DocGen: POST pdf_link (template, variables, signatories)

        alt Send for e-sign = ON
            DocGen-->>Send: envelopeId (Nomia sends sign email)
        else Send for e-sign = OFF
            DocGen-->>Send: pdfLink
            Send->>Email: Email PDF link to applicant
        end

        Send->>DB: Update status → TERMS_SENT
    end

    Send-->>UI: Success
    UI-->>Admin: Toast confirmation
```



### DocGen options explained


| Option               | Effect                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Show in Nomia**    | Document visible in Nomia workspace                                                                                |
| **Build for e-sign** | Document prepared for signing workflow                                                                             |
| **Send for e-sign**  | Nomia sends signing invitation to applicant. **Required for automatic reseller activation** via local seal handler |


> **Important:** If **Send for e-sign** is OFF, the applicant only receives a PDF link email. The application stays at `TERMS_SENT` and **no `ResellerProfile` is created automatically**.

### Admin environment variables


| Variable                    | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `NOMIA_DOCGEN_AUTH_TOKEN`   | JWT for DocGen API                                   |
| `NOMIA_DOCGEN_API_KEY`      | Workspace API key                                    |
| `NOMIA_DOCGEN_WORKSPACE_ID` | Default workspace (fallback if not in site settings) |
| `NOMIA_DOCGEN_API_ENDPOINT` | Defaults to `pdf_link` endpoint                      |


---

## Client flow (reseller organisation)

The **client** is the organisation applying to resell credits (e.g. "Nomia Creator").

### Phase A — Apply to become a reseller

```mermaid
flowchart TD
    Start(["Client logged in"])
    Start --> OrgSettings["/o/{orgUrl}/settings/general"]
    OrgSettings --> Eligibility{"Eligibility check"}

    Eligibility -->|"Not eligible"| Blocked["Apply button disabled\nShows reasons"]
    Eligibility -->|"Eligible"| ApplyBtn["Click Apply to resell"]
    ApplyBtn --> Confirm["Confirm in dialog"]
    Confirm --> CreateApp["createResellerApplication()"]
    CreateApp --> Pending["ResellerApplication\nstatus = PENDING"]

    Eligibility -->|"Already applied"| InProgress["Application in progress message"]
    Eligibility -->|"Already reseller"| Active["Reseller settings available"]
```



#### Eligibility requirements


| Requirement             | Default value                         | Bypass                                                       |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Credits used            | ≥ **50** e-sign credits               | Dev allowlist emails in `RESELLER_ELIGIBILITY_BYPASS_EMAILS` |
| Subscription tenure     | ≥ **2 months**                        | Same bypass                                                  |
| No existing application | None in progress                      | —                                                            |
| No existing profile     | Not already a reseller                | —                                                            |


**Client URL:** `/o/{orgUrl}/settings/general` → **Apply to resell e-sign credits** section

---

### Phase B — Wait for T&Cs & sign


| Step | What happens                                                | Client action                      |
| ---- | ----------------------------------------------------------- | ---------------------------------- |
| 1    | Admin sends T&Cs                                            | Check email                        |
| 2    | Receive signing invite (e-sign ON) or PDF link (e-sign OFF) | Open link / sign document          |
| 3    | On e-sign completion                                        | Automatic activation (see Phase C) |


---

### Phase C — Activation (automatic)

When the applicant **completes signing** on a document whose envelope ID matches `ResellerApplication.termsEnvelopeId`:

```mermaid
flowchart LR
    Sign["Applicant signs T&Cs"]
    Seal["seal-document.handler"]
    Activate["activateResellerFromTermsCompletion()"]
    Profile["Create ResellerProfile"]
    Packages["Create 6 ResellerPackage rows\n(all disabled by default)"]
    Welcome["Send welcome email"]
    Approved["Application → APPROVED"]

    Sign --> Seal --> Activate --> Profile --> Packages --> Welcome --> Approved
```



**Created automatically:**

- `ResellerProfile` with `status = ACTIVE`
- `affiliateSlug` = `{org-url-normalized}-{6-char-nanoid}` (e.g. `org-oefzxtceebfvocdy-2idCGL`)
- 6 `ResellerPackage` rows (one per catalog package, `isEnabled = false`)
- Welcome email containing affiliate URL

---

### Phase D — Configure reseller settings

Once `ResellerProfile` exists, the **Reseller** menu appears in org settings.

**URL:** `/o/{orgUrl}/settings/reseller`

```mermaid
flowchart TD
    Open["Open Reseller settings"]
    Open --> Link["Copy affiliate link\n/r/{affiliateSlug}"]
    Open --> Paystack["Enter Paystack public/secret keys\n+ callback URL"]
    Open --> VAT["Optional VAT number"]
    Open --> Packages["Enable packages to sell\n(checkboxes)"]
    Open --> Credits["Monitor available credits"]
    Open --> Txn["View transaction history"]

    Packages --> Ready["Affiliate page live\nfor enabled packages"]
    Credits --> Warn{"Enough credits?"}
    Warn -->|"No"| Block["Purchasers blocked\nunless allowNegativeCredits"]
    Warn -->|"Yes"| Ready
```




| Setting               | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| **Affiliate link**    | Share with customers — must match `ResellerProfile.affiliateSlug` exactly |
| **Paystack keys**     | Reseller's own Paystack account (future/direct use)                       |
| **Enabled packages**  | Only checked packages appear on `/r/{slug}`                               |
| **Available credits** | Purchases deduct from reseller's org credit balance                       |


> **Tip:** Always copy the affiliate link from Reseller settings. Do not guess the slug — manual DB inserts may use a custom slug (e.g. `nomia-creator-dev001`).

---

## User flow (affiliate purchaser)

The **user** is any logged-in Nomia customer who visits a reseller's affiliate link to buy credits.

**URL pattern:** `/r/{affiliateSlug}`  
**Example:** `http://localhost:3000/r/nomia-creator-dev001`

### Affiliate page flow

```mermaid
flowchart TD
    Visit["User visits /r/{affiliateSlug}"]
    Visit --> Auth{"Logged in?"}

    Auth -->|"No"| SignIn["Redirect to /signin?callbackUrl=/r/{slug}"]
    SignIn --> Auth

    Auth -->|"Yes"| Lookup["getAffiliate(affiliateSlug)"]
    Lookup --> Found{"Profile found?"}

    Found -->|"No"| NotFound["Reseller not found"]
    Found -->|"Yes"| Packages{"Enabled packages?"}

    Packages -->|"None"| NoPkg["No packages available"]
    Packages -->|"Some"| Show["Show package cards\nwith prices"]

    Show --> Select["User clicks Buy X credits"]
    Select --> Validate{"Valid purchase?"}

    Validate -->|"Own reseller account"| Error1["Cannot buy from yourself"]
    Validate -->|"Reseller low on credits"| Error2["Not enough credits available"]
    Validate -->|"OK"| Paystack["Redirect to Paystack checkout"]

    Paystack --> Return["Return to /r/{slug}?purchase=success"]
```



### Purchase validation rules


| Rule                                                        | Error if violated                                |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Affiliate slug must exist in `ResellerProfile`              | "Reseller not found"                             |
| Package must be `isEnabled = true`                          | "Package is not available"                       |
| Purchaser org ≠ reseller org                                | "Cannot purchase from your own reseller account" |
| Reseller has enough credits (unless `allowNegativeCredits`) | "Not enough credits available"                   |


### User sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant Page as /r/{affiliateSlug}
    participant tRPC as tRPC API
    participant Init as initialize-reseller-purchase.ts
    participant Paystack as Paystack
    participant Webhook as paystack.webhook
    participant Process as process-reseller-paystack-webhook.ts
    participant DB as Database

    User->>Page: Open affiliate link
    Page->>Page: Require login
    Page->>tRPC: getAffiliate(slug)
    tRPC-->>Page: packages + org name

    User->>Page: Click Buy credits
    Page->>tRPC: initializePurchase(slug, packageId, orgId)
    tRPC->>Init: Validate + create Paystack transaction
    Init-->>Page: authorizationUrl
    Page->>Paystack: Redirect to checkout

    User->>Paystack: Complete payment
    Paystack->>Webhook: charge.success webhook
    Webhook->>Process: processResellerPaystackWebhook()
    Process->>DB: Deduct credits from reseller org
    Process->>DB: Add credits to purchaser org
    Process->>DB: ResellerCreditTransaction → COMPLETED

    Paystack-->>User: Redirect to callback URL
```



### What the user sees on the affiliate page


| State               | UI message                                               |
| ------------------- | -------------------------------------------------------- |
| Invalid slug        | **Reseller not found** — link invalid or inactive        |
| No enabled packages | **No packages available**                                |
| Success             | Package cards with name, price, **Buy X credits** button |
| After payment       | Redirected back with `?purchase=success` query param     |


---

## Paystack payment & credit transfer

```mermaid
flowchart LR
    subgraph Init["initialize-reseller-purchase"]
        I1["Create Paystack transaction"]
        I2["Metadata: type=reseller-credit-purchase\nresellerProfileId, packageId, purchaserOrgId"]
    end

    subgraph Webhook["process-reseller-paystack-webhook"]
        W1["Verify reference not duplicate"]
        W2["Validate amount = package price"]
        W3["Reseller credits -= package.creditAmount"]
        W4["Purchaser credits += package.creditAmount"]
        W5["Transaction status = COMPLETED"]
    end

    Init --> Paystack["User pays"]
    Paystack --> Webhook
```



**Idempotency:** If the same `paystackReference` is processed twice, the second call returns `{ duplicate: true }` without double-transferring credits.

---

## End-to-end sequence diagram

Full journey from application to credit purchase:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client (Reseller org)
    actor Admin
    actor User as User (Purchaser)
    participant App as Nomia App
    participant DocGen as Nomia DocGen
    participant Paystack as Paystack

    Client->>App: Apply (General settings)
    App-->>Client: PENDING

    Admin->>App: Send T&Cs (Admin applications)
    App->>DocGen: Generate agreement
    DocGen-->>Client: Sign invitation / PDF
    App-->>Admin: TERMS_SENT

    Client->>DocGen: Sign T&Cs
    DocGen->>App: Document sealed
    App->>App: Create ResellerProfile + packages
    App-->>Client: Welcome email + affiliate link

    Client->>App: Enable packages (Reseller settings)
    Client->>User: Share /r/{affiliateSlug}

    User->>App: Open affiliate link (login required)
    User->>App: Buy package
    App->>Paystack: Initialize payment
    User->>Paystack: Pay
    Paystack->>App: Webhook
    App->>App: Transfer credits
    App-->>User: Credits added to purchaser org
```



---

## Data model

```mermaid
erDiagram
    Organisation ||--o| ResellerApplication : "applies once"
    Organisation ||--o| ResellerProfile : "becomes reseller"
    User ||--o{ ResellerApplication : "applicant"

    ResellerProfile ||--|{ ResellerPackage : "offers"
    ResellerProfile ||--|{ ResellerCreditTransaction : "records"

    ResellerPackage ||--o{ ResellerCreditTransaction : "sold via"
    Organisation ||--o{ ResellerCreditTransaction : "purchaser"

    ResellerApplication {
        string id PK
        string organisationId UK
        enum status
        string termsEnvelopeId
        string termsTemplateId
        datetime appliedAt
        datetime termsSentAt
        datetime approvedAt
    }

    ResellerProfile {
        string id PK
        string organisationId UK
        string affiliateSlug UK
        enum status
        string paystackPublicKey
        string paystackSecretKey
        boolean allowNegativeCredits
    }

    ResellerPackage {
        string id PK
        string catalogPackageId
        int creditAmount
        int priceInCents
        boolean isEnabled
    }

    ResellerCreditTransaction {
        string id PK
        string paystackReference UK
        enum status
        int credits
        int grossAmount
    }
```



### Credit catalog packages (default 6)


| Catalog ID  | Credits | Display price (test) |
| ----------- | ------- | -------------------- |
| `payg-20`   | 20      | ZAR 190              |
| `payg-50`   | 50      | ZAR 450              |
| `payg-100`  | 100     | ZAR 850              |
| `payg-200`  | 200     | ZAR 1,600            |
| `payg-500`  | 500     | ZAR 3,750            |
| `payg-1000` | 1000    | ZAR 7,000            |


All packages are created with `**isEnabled = false**` — the client must enable them in Reseller settings.

---

## Routes & URLs reference

### Admin


| Route                          | Purpose                                   |
| ------------------------------ | ----------------------------------------- |
| `/admin/site-settings`         | DocGen template & workspace configuration |
| `/admin/reseller-applications` | Review applications, send T&Cs            |


### Client (reseller organisation)


| Route                           | Purpose                                          |
| ------------------------------- | ------------------------------------------------ |
| `/o/{orgUrl}/settings/general`  | Apply to become a reseller                       |
| `/o/{orgUrl}/settings/reseller` | Affiliate link, Paystack, packages, transactions |


### User (affiliate purchaser)


| Route                                    | Purpose                               |
| ---------------------------------------- | ------------------------------------- |
| `/r/{affiliateSlug}`                     | Buy credits from a reseller           |
| `/signin?callbackUrl=/r/{affiliateSlug}` | Login redirect when not authenticated |


### API / background


| Path                         | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `POST /api/paystack/webhook` | Processes `reseller-credit-purchase` payments   |
| `seal-document.handler`      | Triggers reseller activation on T&Cs completion |


---

## Testing checklist

### As Admin

- Configure DocGen template ID (e.g. `839`) and workspace ID in Site Settings
- Verify env vars: `NOMIA_DOCGEN_AUTH_TOKEN`, `NOMIA_DOCGEN_API_KEY`
- Open `/admin/reseller-applications` and see pending application
- Send T&Cs with template variables filled
- Confirm application status → `TERMS_SENT`
- (E-sign path) Confirm activation after client signs → `APPROVED`

### As Client

- Meet eligibility (50 credits + 2 months) or use bypass email
- Apply from `/o/{orgUrl}/settings/general`
- Receive and sign T&Cs (or PDF link if e-sign off)
- See **Reseller** in org settings sidebar after activation
- Copy affiliate link from `/o/{orgUrl}/settings/reseller`
- Enable at least one package
- Ensure organisation has enough credits for expected sales

### As User (affiliate page)

- Open correct URL: `/r/{affiliateSlug}` (slug from Reseller settings, not guessed)
- Redirect to sign-in if logged out; return to affiliate page after login
- See enabled packages with prices
- Click **Buy credits** → Paystack checkout
- After payment: credits added to purchaser org, deducted from reseller org
- Reseller sees transaction in Reseller settings history

---

## Known behaviour & dev notes

### Affiliate slug must match the database

The slug in the URL **must exactly match** `ResellerProfile.affiliateSlug`.


| Source                       | Example slug                  |
| ---------------------------- | ----------------------------- |
| Auto-generated on activation | `org-oefzxtceebfvocdy-2idCGL` |
| Manual SQL / custom insert   | `nomia-creator-dev001`        |


Wrong slug → **"Reseller not found"** (this is expected).

### Activation paths


| Path                                | Creates profile?     | Sets APPROVED?     |
| ----------------------------------- | -------------------- | ------------------ |
| E-sign T&Cs completed (local seal)  | ✅ Yes                | ✅ Yes              |
| PDF link only (Send for e-sign OFF) | ❌ No                 | ❌ Stays TERMS_SENT |
| Manual SQL insert                   | ✅ If you insert rows | Manual             |


### Reseller sidebar visibility

The **Reseller** menu appears when `getProfile` returns a `ResellerProfile` — **not** when application status is `APPROVED` alone without a profile row.

### Dev eligibility bypass

These emails skip the 50-credit / 2-month requirements (see `esign-credit-packages.ts`):

- `nomiadeveloper@gmail.com`
- `nomiacreator@gmail.com`

### Common affiliate page errors (fixed / expected)


| Symptom                     | Cause                            | Fix                                                    |
| --------------------------- | -------------------------------- | ------------------------------------------------------ |
| "Oops something went wrong" | JS crash on `organisations.find` | Fixed — session returns array, not `{ organisations }` |
| "Reseller not found"        | Wrong `affiliateSlug` in URL     | Use link from Reseller settings                        |
| "No packages available"     | All packages `isEnabled = false` | Enable packages in Reseller settings                   |
| Buy button disabled         | User has no organisation         | User must belong to an org                             |
| Purchase failed             | Reseller out of credits          | Top up reseller org credits                            |


---

## Quick reference — status → who can do what

```mermaid
flowchart TB
    subgraph AdminActions["Admin can"]
        A1["Review PENDING apps"]
        A2["Send T&Cs"]
        A3["Configure site settings"]
    end

    subgraph ClientActions["Client can"]
        C1["Apply when eligible"]
        C2["Sign T&Cs when TERMS_SENT"]
        C3["Configure reseller when profile exists"]
        C4["Share affiliate link"]
    end

    subgraph UserActions["User can"]
        U1["Visit /r/{slug} when logged in"]
        U2["Buy enabled packages"]
        U3["Receive credits after Paystack"]
    end

    PENDING --> AdminActions
    TERMS_SENT --> ClientActions
    APPROVED --> ClientActions
    APPROVED --> UserActions
```



---

*Last updated: July 2026 — reflects reseller implementation in `documenso-revamp`.*
# Inbox Agent

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vnikhilbuddhavarapu/peer-point-card-3-inbox-agent)

Build the decision-making layer of an email Agent while the durable thread, draft plumbing, approval dashboard, signed simulator, and optional live Email Service path are already wired for you.

## Learning objective

A vague email should cause one useful clarification question. The reply should add only correspondent-established facts to durable state. Every outbound email must park as a Think Action and wait for explicit human approval before any delivery side effect.

The starter defaults to safe simulator mode. Teams with a temporary lab domain can independently enable real Email Routing and Email Sending without an instructor-operated mailbox or shared capability.

## Already complete

- bounded Zod mail and delivery contracts;
- signed `POST /email` simulator ingress with replay-window checks;
- native Email Routing `email()` ingress for a lab domain;
- account-local Email Sending after durable approval;
- idempotent programmatic submission keyed by message ID;
- one-correspondent thread, draft, submission, delivery, and model state;
- WebSocket thread and authoritative pending-approval UI;
- approve, reject, reset, model selection, and simulator-mode delivery paths;
- safe structured logs that omit email content, prompts, endpoints, and credentials.

## Build these three behaviors

Suggested starting files:

1. `src/agent/context.ts`
   - Replace the `WORKSHOP TASK` fallback with a concise clarification strategy.
   - Tell the Agent how to distinguish a vague request from a reply that contains enough established detail.
   - Require one focused question and forbid invented dates, audiences, decisions, incidents, or attachments.
2. `src/agent/workshop.ts`
   - Implement established-fact persistence using the validated state helper in `state.ts`.
   - Return a configured `durable-pause` send policy that requires approval for every outbound email.

Keep the result unions intact. Expected unfinished behavior should remain typed data rather than an exception.

## First run: simulator mode

```bash
npm ci
npm run dev
```

Open the printed local URL. The health endpoint is `/api/health`; it reports the active `emailMode`. Local Workers AI development uses your authenticated lab account and its `default` AI Gateway.

The starter deploys with:

```text
EMAIL_MODE=simulator
```

In simulator mode, inbound signed workshop payloads are accepted and every approved outbound draft records `simulated`. No external email is sent.

A useful first message is:

> Subject: Leadership rollout update
>
> Can you send leadership an update on the rollout?

A useful second message is:

> Tell the Montreal leadership team the rollout is complete, no incidents occurred, and feedback is due September 23.

## Optional: enable live email in your lab account

Use this only after the first Deploy to Cloudflare deployment succeeds. Your lab account must contain a domain using Cloudflare DNS.

### 1. Activate the lab Wrangler profile

Run these commands from the generated repository. If the `peer-point-lab` profile is not active for this directory, activate it before changing email or DNS resources.

```bash
npx wrangler whoami --profile peer-point-lab
```

Confirm that the output names only your assigned temporary lab account.

### 2. Choose the address

Use one handle and your lab domain:

```text
inbox-agent@<LAB_DOMAIN>
```

The handle must start with a letter and contain only lowercase letters, numbers, and hyphens.

### 3. Enable Email Routing and Email Sending

```bash
npx wrangler email routing enable <LAB_DOMAIN> --profile peer-point-lab
npx wrangler email sending enable <LAB_DOMAIN> --profile peer-point-lab
```

Cloudflare adds the required MX, SPF, DKIM, return-path, and DMARC records. DNS usually propagates within several minutes but may take longer.

You do not need to verify a destination email address because incoming mail is routed to a Worker, not forwarded to another mailbox.

### 4. Configure this repository

In `wrangler.jsonc`, set:

```jsonc
"EMAIL_MODE": "local",
"INBOX_HANDLE": "inbox-agent",
"INBOUND_DOMAIN": "<LAB_DOMAIN>",
"SENDING_DOMAIN": "<LAB_DOMAIN>"
```

Keep the existing `EMAIL` send binding. Do not remove simulator ingress, durable approval, idempotency, or validation.

Commit and push the change. Wait for GitHub Actions and Workers Builds to pass before creating the routing rule.

### 5. Route inbound mail to the deployed Worker

Replace `<WORKER_NAME>` with the Worker name shown by Workers Builds or the Cloudflare dashboard:

```bash
npx wrangler email routing rules update \
  <LAB_DOMAIN> \
  catch-all \
  --enabled true \
  --action-type worker \
  --action-value <WORKER_NAME> \
  --profile peer-point-lab
```

Verify both services:

```bash
npx wrangler email routing settings <LAB_DOMAIN> --profile peer-point-lab
npx wrangler email routing rules get <LAB_DOMAIN> catch-all --profile peer-point-lab
npx wrangler email sending settings <LAB_DOMAIN> --profile peer-point-lab
```

### 6. Send a real message

From a real mailbox, send to:

```text
inbox-agent@<LAB_DOMAIN>
```

Open the deployed Inbox Agent dashboard. The message should appear, but no reply is sent until you approve the parked Action. Email Sending is required for the approved reply; Email Routing alone only receives the message.

Reply to the clarification from your mailbox. The routing rule sends that reply back to the same Durable Object thread.

### Prompt for your AI coding assistant

```text
Configure this Inbox Agent for live email in my temporary lab account using domain <LAB_DOMAIN>. Read the README first. Preserve simulator fallback, signature verification, message-ID deduplication, one-correspondent isolation, draft revalidation, and durable approval. Change only the email mode, handle, and inbound/sending domain values in wrangler.jsonc. Do not enable or modify email resources until I confirm the peer-point-lab Wrangler profile names the correct account. After I confirm, enable Email Routing and Email Sending, push the config change, wait for verification and deployment, then route the catch-all to the deployed Worker. Never send a test email until I explicitly approve it.
```

## Contracts to preserve

- `mailPayloadSchema` bounds sender, recipient, subject, body, message IDs, references, hops, and received time.
- `draftInputSchema` is the exact value saved before `sendReply` is requested.
- `WorkshopTaskResult<T>` uses either `{ ok: true, value }` or `{ ok: false, error }`.
- A completed send policy has `kind: "durable-pause"` and `approval: true`.
- The Action revalidates its approved input against the current draft before delivery.
- Message IDs remain the idempotency boundary for ingress, submissions, thread entries, and side effects.
- `EMAIL_MODE=simulator` never calls Email Sending or the central router.
- `EMAIL_MODE=local` sends only through the lab account's `EMAIL` binding.

## Check your work

```bash
npm run verify
npx wrangler deploy --dry-run
```

The focused workshop tests accept either the safe typed fallback or a correctly shaped completed result. Do not weaken the contract, signature, Email Service, state-boundary, or UI tests.

### Base checklist

- [ ] A vague first email produces one concise clarification draft.
- [ ] The draft creates a pending Action visible in the dashboard.
- [ ] No outbound message or delivery result exists before approval.
- [ ] The correspondent's second email adds only established facts.
- [ ] A useful final draft preserves `Re:` subject and message references.
- [ ] Each outbound send parks independently and proceeds only after approval.
- [ ] Duplicate inbound message IDs do not duplicate the thread or submission.

### Live-email checklist

- [ ] Email Routing sends `inbox-agent@<LAB_DOMAIN>` to this Worker.
- [ ] Email Sending is enabled for the same lab domain.
- [ ] The first approved reply reaches the real sender.
- [ ] A real follow-up returns to the same Agent thread.
- [ ] Repeated approval or duplicate ingress does not send twice.

## Deploy and demo

```bash
npm run deploy
```

For the guaranteed demo, keep simulator mode and show the signed thread, clarification, parked approval, absence of pre-approval delivery, and final fact summary.

For the live stretch, show the Email Routing rule, send from a real mailbox, approve in the dashboard, receive the reply, answer it, and approve the final response.

The optional central-router mode remains available for instructor-operated scenarios. A real router capability is secret material; never place it in source, logs, screenshots, or chat.

## Recovery

- **No inbound email:** confirm Email Routing is enabled, the catch-all targets the exact deployed Worker name, and DNS records are active.
- **Approved reply fails:** confirm Email Sending is enabled for `SENDING_DOMAIN`, the `EMAIL` binding exists, and `EMAIL_MODE` is `local`.
- **Wrong account:** stop before changing DNS. Reactivate `peer-point-lab` in this repository and confirm `wrangler whoami`.
- **`INVALID_SIGNATURE` or `EMAIL_REJECTED`:** signed HTTP simulation requires the workshop simulator; handwritten requests are intentionally rejected.
- **No approval appears:** inspect the typed tool result and confirm the send policy returns `ok: true` with `durable-pause` plus `approval: true`.
- **Draft approval fails after an edit:** request a new Action. The approved input must exactly match the current draft.
- **Need a clean attempt:** use dashboard reset, which rejects parked approvals before clearing application state.
- **DNS is still pending:** return to simulator mode and continue the card without blocking on propagation.

## Security constraints

Do not bypass signature verification, strict Email Service parsing, replay limits, the one-correspondent guard, model allowlisting, idempotency keys, draft revalidation, or the durable approval gate. Do not log email content or tool payloads. Do not commit `.dev.vars`, API tokens, router capabilities, or signing keys. Treat every inbound email as untrusted model input.

## Start with Peer Point OS

After Deploy to Cloudflare creates your repository and first deployment, copy your generated GitHub repository URL. In a new Peer Point OS chat, run:

```text
/inbox-agent https://github.com/<your-user>/<deploy-created-repository>
```

Replace the example URL with your generated repository. Peer Point OS will read this README and guide the card workflow. If Container MCP becomes unavailable, continue with the skill's GitHub branch/PR and Workers Builds fallback.

## Start with your own IDE

```bash
npm ci
npm run verify
npm run dev
```

Before pushing or deploying:

```bash
npm run verify
```

Deploy only to the temporary lab account assigned for the event.

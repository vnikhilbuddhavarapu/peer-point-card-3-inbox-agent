import PostalMime from "postal-mime";
import { z } from "zod";

import {
  handleSchema,
  MAX_MESSAGE_ID_LENGTH,
  MAX_REFERENCES,
  mailPayloadSchema,
  outboundRequestSchema,
  type MailPayload,
  type OutboundRequest,
} from "./contracts.js";
import { sendOutboundMail, type MailRouterResult } from "./mail-router.js";

const MAX_RAW_EMAIL_BYTES = 1_048_576;

export const emailModeSchema = z.enum(["simulator", "router", "local"]);
export type EmailMode = z.infer<typeof emailModeSchema>;

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u);

export interface RoutedEmailInput {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  setReject(reason: string): void;
}

export interface EmailSender {
  send(message: EmailMessageBuilder): Promise<unknown>;
}

export interface OutboundEmailOptions {
  mode: EmailMode;
  email: EmailSender;
  inboundDomain: string;
  sendingDomain: string;
  routerUrl: string;
  routerCapability: string;
  fetch?: typeof globalThis.fetch;
}

export function isConfiguredRecipient(to: string, handle: string, domain: string): boolean {
  const parsedTo = z.string().email().max(254).safeParse(to);
  const parsedHandle = handleSchema.safeParse(handle);
  const parsedDomain = domainSchema.safeParse(domain);
  return (
    parsedTo.success &&
    parsedHandle.success &&
    parsedDomain.success &&
    parsedTo.data.toLowerCase() === `${parsedHandle.data}@${parsedDomain.data}`
  );
}

function references(headers: Headers): string[] {
  return (headers.get("references") ?? "")
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(-MAX_REFERENCES);
}

export async function parseInboundEmail(
  message: RoutedEmailInput,
  now = new Date(),
): Promise<MailPayload> {
  if (message.rawSize > MAX_RAW_EMAIL_BYTES) {
    message.setReject("Message is too large");
    throw new Error("EMAIL_TOO_LARGE");
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);
  return mailPayloadSchema.parse({
    from: message.from,
    to: message.to,
    subject: parsed.subject?.slice(0, 200) ?? "(no subject)",
    text: (parsed.text ?? "").trim().slice(0, 20_000),
    messageId:
      message.headers.get("message-id") ??
      `<${crypto.randomUUID()}@${message.to.split("@").at(-1) ?? "email"}>`,
    inReplyTo: message.headers.get("in-reply-to")?.slice(0, MAX_MESSAGE_ID_LENGTH) ?? null,
    references: references(message.headers),
    hopCount: 0,
    receivedAt: now.toISOString(),
  });
}

function localHeaders(input: OutboundRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references.length > 0) headers.References = input.references.join(" ");
  return headers;
}

export async function deliverOutboundEmail(
  untrustedInput: unknown,
  options: OutboundEmailOptions,
): Promise<MailRouterResult> {
  const input = outboundRequestSchema.safeParse(untrustedInput);
  const mode = emailModeSchema.safeParse(options.mode);
  if (!input.success || !mode.success) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Outbound mail input is invalid" },
    };
  }

  if (mode.data === "simulator") {
    return { ok: true, data: { status: "simulated" } };
  }
  if (mode.data === "router") {
    return sendOutboundMail(input.data, {
      baseUrl: options.routerUrl,
      capability: options.routerCapability,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  const inboundDomain = domainSchema.safeParse(options.inboundDomain);
  const sendingDomain = domainSchema.safeParse(options.sendingDomain);
  if (!inboundDomain.success || !sendingDomain.success) {
    return {
      ok: false,
      error: { code: "INVALID_CONFIG", message: "Local Email Service domains are invalid" },
    };
  }

  try {
    await options.email.send({
      to: input.data.to,
      from: {
        email: `${input.data.fromHandle}@${sendingDomain.data}`,
        name: "Peer Point Agent",
      },
      replyTo: `${input.data.fromHandle}@${inboundDomain.data}`,
      subject: input.data.subject,
      text: input.data.text,
      headers: localHeaders(input.data),
    });
    return { ok: true, data: { status: "external-queued" } };
  } catch {
    return {
      ok: false,
      error: { code: "UNAVAILABLE", message: "Email Service delivery failed" },
    };
  }
}

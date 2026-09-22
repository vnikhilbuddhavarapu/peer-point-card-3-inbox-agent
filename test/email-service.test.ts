import { describe, expect, it, vi } from "vitest";

import {
  deliverOutboundEmail,
  isConfiguredRecipient,
  parseInboundEmail,
} from "../src/services/email-service.js";

function rawEmail(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

const outbound = {
  fromHandle: "inbox",
  to: "correspondent@example.com",
  subject: "Re: Rollout update",
  text: "The rollout is complete.",
  messageId: "<reply-1@lab.example>",
  inReplyTo: "<message-1@example.com>",
  references: ["<message-1@example.com>"],
  hopCount: 0,
};

describe("local Email Service", () => {
  it("parses one bounded routed email into the existing mail contract", async () => {
    const payload = await parseInboundEmail(
      {
        from: "correspondent@example.com",
        to: "inbox@lab.example",
        headers: new Headers({
          "message-id": "<message-1@example.com>",
          references: "<older@example.com> <message-0@example.com>",
          "in-reply-to": "<message-0@example.com>",
        }),
        raw: rawEmail(
          "From: correspondent@example.com\r\nTo: inbox@lab.example\r\nSubject: Rollout update\r\n\r\nCan you send an update?",
        ),
        rawSize: 140,
        setReject: vi.fn(),
      },
      new Date("2026-09-22T14:00:00.000Z"),
    );

    expect(payload).toEqual({
      from: "correspondent@example.com",
      to: "inbox@lab.example",
      subject: "Rollout update",
      text: "Can you send an update?",
      messageId: "<message-1@example.com>",
      inReplyTo: "<message-0@example.com>",
      references: ["<older@example.com>", "<message-0@example.com>"],
      hopCount: 0,
      receivedAt: "2026-09-22T14:00:00.000Z",
    });
  });

  it("accepts only the configured inbox address", () => {
    expect(isConfiguredRecipient("Inbox-Agent@Lab.Example", "inbox-agent", "lab.example")).toBe(
      true,
    );
    expect(isConfiguredRecipient("other@lab.example", "inbox-agent", "lab.example")).toBe(false);
    expect(isConfiguredRecipient("inbox-agent@other.example", "inbox-agent", "lab.example")).toBe(
      false,
    );
  });

  it("rejects oversized routed email before reading the raw stream", async () => {
    const setReject = vi.fn();
    await expect(
      parseInboundEmail({
        from: "correspondent@example.com",
        to: "inbox@lab.example",
        headers: new Headers(),
        raw: rawEmail("unused"),
        rawSize: 1_048_577,
        setReject,
      }),
    ).rejects.toThrow("EMAIL_TOO_LARGE");
    expect(setReject).toHaveBeenCalledWith("Message is too large");
  });

  it("uses the lab Email Sending binding only in local mode", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "sent-1" });
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      deliverOutboundEmail(outbound, {
        mode: "local",
        email: { send },
        inboundDomain: "lab.example",
        sendingDomain: "lab.example",
        routerUrl: "https://mail-router.example",
        routerCapability: "simulator-only",
        fetch: fetchMock,
      }),
    ).resolves.toEqual({ ok: true, data: { status: "external-queued" } });

    expect(send).toHaveBeenCalledWith({
      to: "correspondent@example.com",
      from: { email: "inbox@lab.example", name: "Peer Point Agent" },
      replyTo: "inbox@lab.example",
      subject: "Re: Rollout update",
      text: "The rollout is complete.",
      headers: {
        "In-Reply-To": "<message-1@example.com>",
        References: "<message-1@example.com>",
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps simulator mode side-effect free", async () => {
    const send = vi.fn();
    const fetchMock = vi.fn<typeof fetch>();
    await expect(
      deliverOutboundEmail(outbound, {
        mode: "simulator",
        email: { send },
        inboundDomain: "cf.prompt2prod.dev",
        sendingDomain: "ppug-montreal.cf.prompt2prod.dev",
        routerUrl: "https://mail-router.example",
        routerCapability: "simulator-only",
        fetch: fetchMock,
      }),
    ).resolves.toEqual({ ok: true, data: { status: "simulated" } });
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

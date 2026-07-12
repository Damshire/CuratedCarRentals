import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyExistingPaymentAttempt,
  startPublicWipayPayment,
} from "@/lib/payments/publicPaymentStart";
import {
  arePublicOnlinePaymentsEnabled,
  getPublicPaymentsUnavailableMessage,
} from "@/lib/payments/publicPaymentsAvailability";

test("public payment start: reuses a recent initiated attempt with a hosted checkout URL", () => {
  const now = Date.parse("2026-03-14T12:00:00.000Z");
  const result = classifyExistingPaymentAttempt(
    {
      id: "payment-1",
      deposit_amount_cents: 5000,
      created_at: "2026-03-14T11:55:00.000Z",
      metadata_json: {
        hosted_page_url: "https://checkout.example.com/session-1",
      },
    },
    now,
  );

  assert.deepEqual(result, {
    type: "reuse",
    paymentId: "payment-1",
    redirectUrl: "https://checkout.example.com/session-1",
  });
});

test("public payment start: blocks duplicate starts while a fresh attempt is still pending", () => {
  const now = Date.parse("2026-03-14T12:00:00.000Z");
  const result = classifyExistingPaymentAttempt(
    {
      id: "payment-2",
      deposit_amount_cents: 5000,
      created_at: "2026-03-14T11:59:30.000Z",
      metadata_json: {},
    },
    now,
  );

  assert.deepEqual(result, {
    type: "pending",
    paymentId: "payment-2",
  });
});

test("public payment start: ignores stale initiated attempts so valid retries can proceed", () => {
  const now = Date.parse("2026-03-14T12:00:00.000Z");
  const result = classifyExistingPaymentAttempt(
    {
      id: "payment-3",
      deposit_amount_cents: 5000,
      created_at: "2026-03-14T10:00:00.000Z",
      metadata_json: {},
    },
    now,
  );

  assert.deepEqual(result, { type: "none" });
});

test("public payment availability defaults to disabled in production and can be explicitly enabled", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.PUBLIC_WIPAY_ENABLED;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_WIPAY_ENABLED;
    assert.equal(arePublicOnlinePaymentsEnabled(), false);

    process.env.PUBLIC_WIPAY_ENABLED = "true";
    assert.equal(arePublicOnlinePaymentsEnabled(), true);

    process.env.PUBLIC_WIPAY_ENABLED = "false";
    assert.equal(arePublicOnlinePaymentsEnabled(), false);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousFlag === undefined) {
      delete process.env.PUBLIC_WIPAY_ENABLED;
    } else {
      process.env.PUBLIC_WIPAY_ENABLED = previousFlag;
    }
  }
});

test("public payment start: returns payments_unavailable before any payment work when online payments are disabled", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.PUBLIC_WIPAY_ENABLED;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.PUBLIC_WIPAY_ENABLED;

    const response = await startPublicWipayPayment({
      request: new Request("http://localhost/api/payments/wipay/start", {
        method: "POST",
      }),
      bookingId: "booking-disabled",
      mode: "deposit",
    });

    assert.equal(response.status, 503);
    const body = (await response.json()) as { ok: boolean; code?: string; error?: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, "payments_unavailable");
    assert.equal(body.error, getPublicPaymentsUnavailableMessage());
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousFlag === undefined) {
      delete process.env.PUBLIC_WIPAY_ENABLED;
    } else {
      process.env.PUBLIC_WIPAY_ENABLED = previousFlag;
    }
  }
});

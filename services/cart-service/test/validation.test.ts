import { describe, expect, it } from "vitest";

import { parseLineItemBody } from "../src/validation.js";

const valid = { quantity: 2, name: "Chair", price: 12.99, imageUrl: "/c.jpg" };

describe("parseLineItemBody — accepts a well-formed line item", () => {
  it("returns the parsed stored item", () => {
    const result = parseLineItemBody(valid);

    expect(result).toEqual({ ok: true, item: valid });
  });

  it("accepts a price of exactly zero", () => {
    const result = parseLineItemBody({ ...valid, price: 0 });

    expect(result.ok).toBe(true);
  });
});

describe("parseLineItemBody — rejects an invalid quantity", () => {
  // Server never trusts the untrusted client (no auth): quantity must be a
  // positive integer, not just any number (Decision 4).
  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["a string", "2"],
    ["missing", undefined],
    ["NaN", Number.NaN],
  ])("rejects quantity that is %s", (_label, quantity) => {
    const result = parseLineItemBody({ ...valid, quantity });

    expect(result.ok).toBe(false);
  });
});

describe("parseLineItemBody — rejects invalid snapshot fields", () => {
  it("rejects a negative price", () => {
    expect(parseLineItemBody({ ...valid, price: -1 }).ok).toBe(false);
  });

  it("rejects a non-number price", () => {
    expect(parseLineItemBody({ ...valid, price: "12.99" }).ok).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(parseLineItemBody({ ...valid, name: "" }).ok).toBe(false);
  });

  it("rejects a missing imageUrl", () => {
    expect(parseLineItemBody({ ...valid, imageUrl: undefined }).ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseLineItemBody(undefined).ok).toBe(false);
    expect(parseLineItemBody("nope").ok).toBe(false);
  });
});

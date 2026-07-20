import type { StoredLineItem } from "./domain.js";

/** Result of validating a line-item body: either the parsed item or a reason. */
export type ParseResult =
  | { ok: true; item: StoredLineItem }
  | { ok: false; reason: string };

const isPositiveInteger = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Validate the structure of an upsert body from the untrusted client (Decision 4).
 * The snapshot fields (name/price/imageUrl) are trusted for content but must be
 * structurally sound so a malformed request cannot enter the Cart as a line item.
 */
export function parseLineItemBody(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "body must be a JSON object" };
  }
  const { quantity, name, price, imageUrl } = body as Record<string, unknown>;

  if (!isPositiveInteger(quantity)) {
    return { ok: false, reason: "quantity must be a positive integer" };
  }
  if (!isNonNegativeNumber(price)) {
    return { ok: false, reason: "price must be a number >= 0" };
  }
  if (!isNonEmptyString(name)) {
    return { ok: false, reason: "name must be a non-empty string" };
  }
  if (!isNonEmptyString(imageUrl)) {
    return { ok: false, reason: "imageUrl must be a non-empty string" };
  }

  return { ok: true, item: { quantity, name, price, imageUrl } };
}

import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { beforeEach, describe, expect, it } from "vitest";

import { CART_TTL_MS, RedisCartStore } from "../src/cart-store.js";

let redis: Redis;
let store: RedisCartStore;

beforeEach(() => {
  redis = new RedisMock() as unknown as Redis;
  store = new RedisCartStore(redis);
});

const line = { quantity: 2, name: "Chair", price: 12.99, imageUrl: "/c.jpg" };

describe("RedisCartStore.create", () => {
  it("creates a cart that snapshots as empty rather than missing", async () => {
    const cartId = await store.create();

    const snap = await store.snapshot(cartId);
    expect(snap).toEqual({ cartId, items: [] });
  });
});

describe("RedisCartStore.snapshot", () => {
  it("returns null for an unknown cart", async () => {
    expect(await store.snapshot("nope")).toBeNull();
  });
});

describe("RedisCartStore.upsertItem", () => {
  it("stores one hash field per SKU (Decision 1 representation)", async () => {
    const cartId = await store.create();

    await store.upsertItem(cartId, "SKU-001", line);
    await store.upsertItem(cartId, "SKU-002", { ...line, quantity: 1 });

    const raw = await redis.hgetall(`cart:${cartId}`);
    const itemFields = Object.keys(raw).filter((f) => f.startsWith("item:"));
    expect(itemFields.sort()).toEqual(["item:SKU-001", "item:SKU-002"]);
  });

  it("computes lineTotal and returns the full snapshot", async () => {
    const cartId = await store.create();

    const snap = await store.upsertItem(cartId, "SKU-001", line);

    expect(snap?.items).toEqual([
      { sku: "SKU-001", ...line, lineTotal: 25.98 },
    ]);
  });

  it("is absolute — re-upserting the same SKU replaces quantity, not adds", async () => {
    const cartId = await store.create();

    await store.upsertItem(cartId, "SKU-001", { ...line, quantity: 2 });
    const snap = await store.upsertItem(cartId, "SKU-001", { ...line, quantity: 5 });

    expect(snap?.items).toHaveLength(1);
    expect(snap?.items[0].quantity).toBe(5);
  });

  it("returns null when the cart does not exist", async () => {
    expect(await store.upsertItem("nope", "SKU-001", line)).toBeNull();
  });
});

describe("RedisCartStore.removeItem", () => {
  it("removes a line item and keeps the (now empty) cart alive", async () => {
    const cartId = await store.create();
    await store.upsertItem(cartId, "SKU-001", line);

    const snap = await store.removeItem(cartId, "SKU-001");

    expect(snap).toEqual({ cartId, items: [] });
    expect(await store.snapshot(cartId)).toEqual({ cartId, items: [] });
  });

  it("returns null when the cart does not exist", async () => {
    expect(await store.removeItem("nope", "SKU-001")).toBeNull();
  });
});

describe("sliding TTL (Decision 2 / behaviour 6)", () => {
  it("refreshes the 48h TTL on create and on every write", async () => {
    const cartId = await store.create();
    expect(await redis.pttl(`cart:${cartId}`)).toBeGreaterThan(CART_TTL_MS - 5000);

    // Simulate time passing by shrinking the TTL, then a write must bump it back.
    await redis.pexpire(`cart:${cartId}`, 1000);
    await store.upsertItem(cartId, "SKU-001", line);
    expect(await redis.pttl(`cart:${cartId}`)).toBeGreaterThan(CART_TTL_MS - 5000);

    await redis.pexpire(`cart:${cartId}`, 1000);
    await store.removeItem(cartId, "SKU-001");
    expect(await redis.pttl(`cart:${cartId}`)).toBeGreaterThan(CART_TTL_MS - 5000);
  });
});

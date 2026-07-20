import { describe, expect, it, vi } from "vitest";

import type { Cart, CartClient, CartStorage, ItemSnapshot, Product } from "../src/api/cartClient.js";
import { CART_ID_KEY } from "../src/api/cartClient.js";
import { bootstrapSession } from "../src/session.js";

const CATALOG: Product[] = [
  { sku: "SKU-001", name: "Chair", price: 12.99, imageUrl: "/c.jpg" },
];

function memoryStorage(seed: Record<string, string> = {}): CartStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

/** Fake client that records calls, so bootstrap is tested without fetch. */
function fakeClient(overrides: Partial<CartClient> = {}): CartClient {
  return {
    getCatalog: vi.fn(async () => CATALOG),
    createCart: vi.fn(async () => ({ cartId: "new-cart", items: [] }) as Cart),
    getCart: vi.fn(async (cartId: string) => ({ cartId, items: [] }) as Cart),
    addItem: vi.fn(async (cartId: string, _item: ItemSnapshot) => ({ cartId, items: [] }) as Cart),
    removeItem: vi.fn(async (cartId: string) => ({ cartId, items: [] }) as Cart),
    ...overrides,
  };
}

describe("bootstrapSession — no cartId in storage", () => {
  it("creates a cart, persists its id, and loads the catalog", async () => {
    const storage = memoryStorage();
    const client = fakeClient();

    const session = await bootstrapSession(client, storage);

    expect(client.createCart).toHaveBeenCalledOnce();
    expect(storage.getItem(CART_ID_KEY)).toBe("new-cart");
    expect(session.cart.cartId).toBe("new-cart");
    expect(session.catalog).toEqual(CATALOG);
  });
});

describe("bootstrapSession — existing cartId in storage", () => {
  it("loads the existing cart instead of creating a new one", async () => {
    const storage = memoryStorage({ [CART_ID_KEY]: "known-cart" });
    const client = fakeClient();

    const session = await bootstrapSession(client, storage);

    expect(client.getCart).toHaveBeenCalledWith("known-cart");
    expect(client.createCart).not.toHaveBeenCalled();
    expect(session.cart.cartId).toBe("known-cart");
  });
});

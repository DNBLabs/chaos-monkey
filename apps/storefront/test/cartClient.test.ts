import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CartStorage } from "../src/api/cartClient.js";
import { CART_ID_KEY, createCartClient } from "../src/api/cartClient.js";

function memoryStorage(seed: Record<string, string> = {}): CartStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const NOT_FOUND = { error: { code: "CART_NOT_FOUND", message: "gone" } };
const SNAPSHOT_FIELDS = { name: "Chair", price: 12.99, imageUrl: "/c.jpg" };

let storage: CartStorage;
let onCartReset: ReturnType<typeof vi.fn>;

beforeEach(() => {
  storage = memoryStorage();
  onCartReset = vi.fn();
});

describe("createCartClient — happy paths", () => {
  it("getCatalog returns the products array", async () => {
    const fetchMock = vi.fn(async () => json(200, { products: [{ sku: "SKU-001", ...SNAPSHOT_FIELDS }] }));
    const client = createCartClient({ storage, fetch: fetchMock as unknown as typeof fetch });

    const catalog = await client.getCatalog();

    expect(catalog).toEqual([{ sku: "SKU-001", ...SNAPSHOT_FIELDS }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/catalog", expect.anything());
  });

  it("addItem PUTs the snapshot and returns the cart", async () => {
    const cart = { cartId: "c1", items: [{ sku: "SKU-001", ...SNAPSHOT_FIELDS, quantity: 2, lineTotal: 25.98 }] };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(200, cart));
    const client = createCartClient({ storage, fetch: fetchMock as unknown as typeof fetch });

    const result = await client.addItem("c1", { sku: "SKU-001", quantity: 2, ...SNAPSHOT_FIELDS });

    expect(result).toEqual(cart);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/carts/c1/items/SKU-001");
    expect((init as RequestInit).method).toBe("PUT");
  });
});

describe("centralized 404 recovery (Decision 5)", () => {
  it("addItem: on CART_NOT_FOUND creates + persists a new cart, signals reset, and replays the add", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT" && url.includes("/carts/stale/")) return json(404, NOT_FOUND);
      if (init?.method === "POST" && url === "/api/v1/carts") return json(201, { cartId: "fresh", items: [] });
      if (init?.method === "PUT" && url.includes("/carts/fresh/")) {
        return json(200, { cartId: "fresh", items: [{ sku: "SKU-001", ...SNAPSHOT_FIELDS, quantity: 2, lineTotal: 25.98 }] });
      }
      throw new Error(`unexpected call ${init?.method} ${url}`);
    });
    const client = createCartClient({ storage, onCartReset, fetch: fetchMock as unknown as typeof fetch });

    const result = await client.addItem("stale", { sku: "SKU-001", quantity: 2, ...SNAPSHOT_FIELDS });

    expect(result.cartId).toBe("fresh");
    expect(result.items).toHaveLength(1);
    expect(storage.getItem(CART_ID_KEY)).toBe("fresh");
    expect(onCartReset).toHaveBeenCalledOnce();
  });

  it("getCart: on CART_NOT_FOUND returns the fresh empty cart and does NOT replay the GET", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET" && url === "/api/v1/carts/stale") return json(404, NOT_FOUND);
      if (init?.method === "POST" && url === "/api/v1/carts") return json(201, { cartId: "fresh", items: [] });
      throw new Error(`unexpected call ${init?.method} ${url}`);
    });
    const client = createCartClient({ storage, onCartReset, fetch: fetchMock as unknown as typeof fetch });

    const result = await client.getCart("stale");

    expect(result).toEqual({ cartId: "fresh", items: [] });
    expect(storage.getItem(CART_ID_KEY)).toBe("fresh");
    expect(onCartReset).toHaveBeenCalledOnce();
    // no second GET against the fresh cart
    const getCalls = fetchMock.mock.calls.filter(([, i]) => ((i as RequestInit)?.method ?? "GET") === "GET");
    expect(getCalls).toHaveLength(1);
  });

  it("removeItem: on CART_NOT_FOUND returns the fresh empty cart and does NOT replay the DELETE", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return json(404, NOT_FOUND);
      if (init?.method === "POST" && url === "/api/v1/carts") return json(201, { cartId: "fresh", items: [] });
      throw new Error(`unexpected call ${init?.method} ${url}`);
    });
    const client = createCartClient({ storage, onCartReset, fetch: fetchMock as unknown as typeof fetch });

    const result = await client.removeItem("stale", "SKU-001");

    expect(result).toEqual({ cartId: "fresh", items: [] });
    const deleteCalls = fetchMock.mock.calls.filter(([, i]) => (i as RequestInit)?.method === "DELETE");
    expect(deleteCalls).toHaveLength(1);
    expect(onCartReset).toHaveBeenCalledOnce();
  });
});

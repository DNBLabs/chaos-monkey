import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "../src/app.js";
import { RedisCartStore } from "../src/cart-store.js";

let app: Express;

beforeEach(() => {
  app = createApp(new RedisCartStore(new RedisMock() as unknown as Redis));
});

const snapshotFields = { name: "Chair", price: 12.99, imageUrl: "/c.jpg" };

/** Create a cart through the API and return its id. */
async function createCart(): Promise<string> {
  const res = await request(app).post("/api/v1/carts");
  return res.body.cartId as string;
}

describe("POST /api/v1/carts", () => {
  it("creates an empty cart and returns 201 with a cartId", async () => {
    const res = await request(app).post("/api/v1/carts");

    expect(res.status).toBe(201);
    expect(res.body.items).toEqual([]);
    expect(typeof res.body.cartId).toBe("string");
    expect(res.body.cartId.length).toBeGreaterThan(0);
  });

  it("issues a distinct cartId per creation", async () => {
    const a = await createCart();
    const b = await createCart();

    expect(a).not.toBe(b);
  });
});

describe("GET /api/v1/carts/{cartId}", () => {
  it("returns a 200 snapshot for a known cart", async () => {
    const cartId = await createCart();

    const res = await request(app).get(`/api/v1/carts/${cartId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cartId, items: [] });
  });

  it("returns 404 CART_NOT_FOUND for an unknown cartId", async () => {
    const res = await request(app).get("/api/v1/carts/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CART_NOT_FOUND");
  });
});

describe("PUT /api/v1/carts/{cartId}/items/{sku}", () => {
  it("adds a line item and returns the full snapshot with lineTotal", async () => {
    const cartId = await createCart();

    const res = await request(app)
      .put(`/api/v1/carts/${cartId}/items/SKU-001`)
      .send({ quantity: 2, ...snapshotFields });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cartId,
      items: [{ sku: "SKU-001", quantity: 2, ...snapshotFields, lineTotal: 25.98 }],
    });
  });

  it("uses absolute quantity semantics — PUT sets, it does not add", async () => {
    const cartId = await createCart();

    await request(app).put(`/api/v1/carts/${cartId}/items/SKU-001`).send({ quantity: 2, ...snapshotFields });
    const res = await request(app)
      .put(`/api/v1/carts/${cartId}/items/SKU-001`)
      .send({ quantity: 5, ...snapshotFields });

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
  });

  it("returns 404 CART_NOT_FOUND when the cart does not exist", async () => {
    const res = await request(app)
      .put("/api/v1/carts/nope/items/SKU-001")
      .send({ quantity: 1, ...snapshotFields });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CART_NOT_FOUND");
  });

  it("returns 400 INVALID_QUANTITY for a non-positive-integer quantity", async () => {
    const cartId = await createCart();

    const res = await request(app)
      .put(`/api/v1/carts/${cartId}/items/SKU-001`)
      .send({ quantity: 0, ...snapshotFields });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUANTITY");
  });

  it("returns 400 for a malformed body before touching the cart", async () => {
    const cartId = await createCart();

    const res = await request(app)
      .put(`/api/v1/carts/${cartId}/items/SKU-001`)
      .send({ quantity: 2, price: -5, ...{ name: "Chair", imageUrl: "/c.jpg" } });

    expect(res.status).toBe(400);
    // Validation must run before the cart is mutated — cart stays empty.
    const snap = await request(app).get(`/api/v1/carts/${cartId}`);
    expect(snap.body.items).toEqual([]);
  });
});

describe("DELETE /api/v1/carts/{cartId}/items/{sku}", () => {
  it("removes a line item and returns the updated snapshot", async () => {
    const cartId = await createCart();
    await request(app).put(`/api/v1/carts/${cartId}/items/SKU-001`).send({ quantity: 2, ...snapshotFields });
    await request(app).put(`/api/v1/carts/${cartId}/items/SKU-002`).send({ quantity: 1, ...snapshotFields });

    const res = await request(app).delete(`/api/v1/carts/${cartId}/items/SKU-001`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { sku: string }) => i.sku)).toEqual(["SKU-002"]);
  });

  it("returns 404 CART_NOT_FOUND when the cart does not exist", async () => {
    const res = await request(app).delete("/api/v1/carts/nope/items/SKU-001");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CART_NOT_FOUND");
  });
});

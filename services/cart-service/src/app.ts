import express, { type Express } from "express";

import type { CartStore } from "./cart-store.js";
import { parseLineItemBody } from "./validation.js";

// Error envelope shared across services (docs/spec/api-contracts.md).
function errorBody(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

const CART_NOT_FOUND = errorBody("CART_NOT_FOUND", "No cart with that id");

/**
 * Build the cart-service HTTP app over a CartStore. The store is injected so the
 * same routes run against real Redis in production and ioredis-mock in tests.
 */
export function createApp(store: CartStore): Express {
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/v1/carts", async (_req, res) => {
    const cartId = await store.create();
    res.status(201).json({ cartId, items: [] });
  });

  app.get("/api/v1/carts/:cartId", async (req, res) => {
    const snapshot = await store.snapshot(req.params.cartId);
    if (snapshot === null) {
      res.status(404).json(CART_NOT_FOUND);
      return;
    }
    res.status(200).json(snapshot);
  });

  app.put("/api/v1/carts/:cartId/items/:sku", async (req, res) => {
    const parsed = parseLineItemBody(req.body);
    if (!parsed.ok) {
      res.status(400).json(errorBody("INVALID_QUANTITY", parsed.reason));
      return;
    }
    const snapshot = await store.upsertItem(req.params.cartId, req.params.sku, parsed.item);
    if (snapshot === null) {
      res.status(404).json(CART_NOT_FOUND);
      return;
    }
    res.status(200).json(snapshot);
  });

  app.delete("/api/v1/carts/:cartId/items/:sku", async (req, res) => {
    const snapshot = await store.removeItem(req.params.cartId, req.params.sku);
    if (snapshot === null) {
      res.status(404).json(CART_NOT_FOUND);
      return;
    }
    res.status(200).json(snapshot);
  });

  return app;
}

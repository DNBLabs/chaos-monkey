import RedisMock from "ioredis-mock";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { RedisCartStore } from "../src/cart-store.js";

const app = createApp(new RedisCartStore(new RedisMock() as unknown as Redis));

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

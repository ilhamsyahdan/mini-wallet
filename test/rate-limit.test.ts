import { expect, it } from "vitest";
import { describe } from "vitest";
import express from "express";
import request from "supertest";
import { authLimiter } from "../src/rate-limit";

describe("rate limit", () => {
  it("request ke-4 dengan batas 3 -> 429", async () => {
    const app = express();
    app.post("/x", authLimiter(3), (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i++) {
      const r = await request(app).post("/x");
      expect(r.status).toBe(200);
    }

    const blocked = await request(app).post("/x");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty("error");
  });
});

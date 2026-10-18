import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../src/db";
import { app } from "../src/app";
import { resetDb } from "./helpers";
import { registerAndLogin, getIds } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("topup", () => {
  it("sukses menambah saldo", async () => {
    const token = await registerAndLogin("topup-success@x.com");
    const { accountId } = await getIds("topup-success@x.com");

    const res = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-1")
      .send({ amount: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBe(50000);
    expect(res.body.replayed).toBe(false);

    const dbBalance = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    expect(Number(dbBalance.rows[0].balance)).toBe(50000);
  });

  it("key sama hanya memproses sekali", async () => {
    const token = await registerAndLogin("topup-replay@x.com");
    const { accountId } = await getIds("topup-replay@x.com");

    const first = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-key")
      .send({ amount: 50000 });

    const second = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-key")
      .send({ amount: 50000 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.replayed).toBe(true);
    expect(second.body.transactionId).toBe(first.body.transactionId);

    const dbBalance = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId],
    );

    expect(Number(dbBalance.rows[0].balance)).toBe(50000);
  });

  it("key sama dengan amount berbeda -> 422", async () => {
    const token = await registerAndLogin("topup-conflict@x.com");

    await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-key")
      .send({ amount: 50000 });

    const conflict = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-key")
      .send({ amount: 100000 });

    expect(conflict.status).toBe(422);
  });

  it("amount tidak valid -> 400", async () => {
    const token = await registerAndLogin("topup-invalid@x.com");

    const res = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-key")
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it("tanpa Idempotency-Key -> 400", async () => {
    const token = await registerAndLogin("topup-nokey@x.com");

    const res = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 50000 });

    expect(res.status).toBe(400);
  });

  it("amount melebihi batas -> 400", async () => {
    const token = await registerAndLogin("topup-max@x.com");
    const res = await request(app)
      .post("/topup")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "topup-max")
      .send({ amount: 10_000_001 });
    expect(res.status).toBe(400);
  });

});

import { pool } from "../src/db";
import { topUp } from "../src/wallet/top-up";
import request from "supertest";
import { app } from "../src/app";
import { randomUUID } from "node:crypto";

export async function resetDb() {
  await pool.query(
    "TRUNCATE table ledger_entries, transactions, accounts, users RESTART IDENTITY CASCADE",
  );

  await pool.query("INSERT INTO accounts (type) VALUES ('system')");
}

export async function createUserWithAccount(email: string, balance: number) {
  const user = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
    [email],
  );

  const userId = user.rows[0].id;

  const account = await pool.query(
    "INSERT INTO accounts (user_id) values ($1) RETURNING id",
    [userId],
  );

  const accountId = Number(account.rows[0].id);

  if (balance > 0) {
    await topUp(accountId, balance, userId, randomUUID());
  }

  return { userId, accountId };
}

export async function registerAndLogin(email: string) {
  await request(app).post("/register").send({ email, password: "rahasia123" });

  const login = await request(app)
    .post("/login")
    .send({ email, password: "rahasia123" });

  return login.body.token as string;
}

export async function getIds(email: string) {
  const r = await pool.query(
    `SELECT u.id AS user_id, a.id AS account_id
     FROM users u
     JOIN accounts a ON a.user_id = u.id
     WHERE u.email = $1`,
    [email],
  );

  return {
    userId: r.rows[0].user_id as string,
    accountId: Number(r.rows[0].account_id),
  };
}

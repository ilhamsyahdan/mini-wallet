import { createHash } from "node:crypto";
import { pool } from "../db";
import { DomainError } from "./errors";

export async function topUp(
  accountId: number,
  amount: number,
  createdBy: string,
  idempotencyKey: string,
) {
  const requestHash = createHash("sha256")
    .update(`${accountId}:topup:${amount}`)
    .digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const systemAccountRes = await client.query(
      `SELECT id
       FROM accounts
       WHERE type = 'system'
       LIMIT 1`,
    );

    const systemAccountId = systemAccountRes.rows[0]?.id;

    if (!systemAccountId) {
      throw new DomainError("Akun sistem tidak ditemukan");
    }

    const accountsRes = await client.query(
      `SELECT id, balance
       FROM accounts
       WHERE id IN ($1, $2)
       ORDER BY id
       FOR UPDATE`,
      [accountId, systemAccountId],
    );

    if (accountsRes.rows.length < 2) {
      throw new DomainError("Salah satu akun tidak ditemukan");
    }

    const keyRes = await client.query(
      `INSERT INTO idempotency_keys
         (user_id, key, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [createdBy, idempotencyKey, requestHash],
    );

    if (keyRes.rowCount === 0) {
      const existing = await client.query(
        `SELECT transaction_id, request_hash
         FROM idempotency_keys
         WHERE user_id = $1 AND key = $2`,
        [createdBy, idempotencyKey],
      );

      const existingKey = existing.rows[0];

      if (existingKey.request_hash !== requestHash) {
        throw new DomainError(
          "Idempotency-Key sama digunakan untuk payload berbeda",
        );
      }

      if (!existingKey.transaction_id) {
        throw new DomainError("Request sebelumnya masih diproses");
      }

      const previous = await client.query(
        `SELECT id, amount
         FROM transactions
         WHERE id = $1`,
        [existingKey.transaction_id],
      );

      const currentBalanceRes = await client.query(
        `SELECT balance FROM accounts WHERE id = $1`,
        [accountId],
      );

      await client.query("COMMIT");
      return {
        success: true,
        transactionId: previous.rows[0].id,
        amount: previous.rows[0].amount,
        balance: Number(currentBalanceRes.rows[0].balance),
        replayed: true,
      };
    }

    const txRes = await client.query(
      `INSERT INTO transactions
         (type, status, amount, created_by)
       VALUES ('topup', 'success', $1, $2)
       RETURNING id`,
      [amount, createdBy],
    );

    const transactionId = txRes.rows[0].id;

    await client.query(
      `INSERT INTO ledger_entries
         (transaction_id, account_id, direction, amount)
       VALUES
         ($1, $2, 'debit', $4),
         ($1, $3, 'credit', $4)`,
      [transactionId, systemAccountId, accountId, amount],
    );

    await client.query(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE id = $2`,
      [amount, systemAccountId],
    );

    const updatedUser = await client.query(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE id = $2
       RETURNING balance`,
      [amount, accountId],
    );

    await client.query(
      `UPDATE idempotency_keys
       SET transaction_id = $1
       WHERE user_id = $2 AND key = $3`,
      [transactionId, createdBy, idempotencyKey],
    );

    await client.query("COMMIT");

    return {
      success: true,
      transactionId,
      amount,
      balance: Number(updatedUser.rows[0].balance),
      replayed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

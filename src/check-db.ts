import { pool } from "./db";

async function main() {
  const res = await pool.query("select now() as sekarang");
  await pool.end();
}

main();

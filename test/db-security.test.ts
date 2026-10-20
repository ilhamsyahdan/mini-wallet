import "dotenv/config";
import { Pool } from "pg"; // Sesuaikan jika pakai driver lain
import { describe, expect, it } from "vitest";

describe("Database Security & Least Privilege Tests", () => {
  it("wallet_app tidak boleh DELETE/DROP", async () => {
    // Pastikan env variable sesuai dengan punya Anda (DATABASE_URL atau APP_DATABASE_URL)
    const app = new Pool({ connectionString: process.env.TEST_APP_DATABASE_URL! });

    // Uji coba perintah DELETE (Harus ditolak karena tidak diberi grant delete)
    await expect(app.query("DELETE FROM ledger_entries")).rejects.toThrow(
      /permission denied/,
    );

    // Uji coba perintah DROP (Harus ditolak karena bukan owner/admin)
    await expect(app.query("DROP TABLE users")).rejects.toThrow();

    await app.end();
  });
});

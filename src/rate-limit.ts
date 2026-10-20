// src/rate-limit.ts
import rateLimit from "express-rate-limit";

export function authLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Terlalu banyak percobaan, coba lagi nanti" },
  });
}

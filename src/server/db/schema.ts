// D1 holds identity only: Better Auth's users, sessions and accounts (generated into auth-schema.ts by
// `aube run auth:schema`). Bookings live in the venue's Durable Object (src/server/venue-do.ts).
export * from "./auth-schema";

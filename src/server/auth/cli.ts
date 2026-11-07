// Entry point for `aube run auth:schema` only: the Better Auth CLI reads the configuration to generate the Drizzle
// schema. It never connects to a database.
import { createDb } from "../db";
import { createAuth } from "./config";

export const auth = createAuth({
	db: createDb({} as D1Database),
	secret: "schema-generation-only",
	baseURL: "http://localhost:4710",
});

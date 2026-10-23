// Pure identity/hash/time helpers. Kept separate from store.ts so cloud code
// can import them without pulling node:sqlite into a Vercel bundle.
import { createHash, randomUUID } from "node:crypto";

export const id = (prefix: string) => `${prefix}_${randomUUID()}`;
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export const now = () => new Date().toISOString();

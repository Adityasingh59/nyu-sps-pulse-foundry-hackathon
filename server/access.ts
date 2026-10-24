import { createHash, timingSafeEqual } from "node:crypto";
import type { Express } from "express";

export interface AccessOptions {
  publicOrigin?: string;
  password?: string;
}

export function installAccess(app: Express, options: AccessOptions) {
  const origin = options.publicOrigin
    ? new URL(options.publicOrigin).origin
    : undefined;
  if (origin && (!options.password || options.password.length < 16))
    throw new Error(
      "Online access requires TABLESIGNAL_ACCESS_PASSWORD with at least 16 characters.",
    );
  if (
    options.publicOrigin &&
    (origin !== options.publicOrigin ||
      !options.publicOrigin.startsWith("https://"))
  )
    throw new Error(
      "TABLESIGNAL_PUBLIC_ORIGIN must be an exact HTTPS origin without a trailing slash.",
    );
  const expected = options.password
    ? createHash("sha256").update(`operator:${options.password}`).digest()
    : undefined;
  // This is one private operator workspace. It is not a multi-tenant service.
  // Protect HTML, API, saved evidence, and downloads with the same access gate.
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    const requestOrigin = req.header("origin");
    if (
      requestOrigin &&
      (origin
        ? requestOrigin !== origin
        : !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(requestOrigin))
    ) {
      res
        .status(403)
        .json({
          error: "This workspace does not accept requests from that origin.",
        });
      return;
    }
    if (req.path === "/api/health" && ["GET", "HEAD"].includes(req.method)) {
      next();
      return;
    }
    if (expected) {
      const header = req.header("authorization") || "";
      const supplied = /^Basic [A-Za-z0-9+/]+=*$/i.test(header)
        ? Buffer.from(header.slice(6), "base64").toString("utf8")
        : "";
      const digest = createHash("sha256").update(supplied).digest();
      if (!timingSafeEqual(expected, digest)) {
        res.setHeader(
          "WWW-Authenticate",
          'Basic realm="TableSignal private workspace", charset="UTF-8"',
        );
        res.status(401).json({ error: "Sign in to this private workspace." });
        return;
      }
    }
    if (requestOrigin && !origin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Idempotency-Key",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      res.status(204).end();
      return;
    }
    next();
  });
}

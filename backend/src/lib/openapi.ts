// Loads ../../openapi.yaml (the canonical hand-authored spec at the repo
// root) and serves it as JSON at /openapi.json — Scalar reads from there.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type { FastifyInstance } from "fastify";

let cached: unknown | null = null;

export function loadOpenApi(): unknown {
  if (cached) return cached;
  // Resolve from the backend directory up to the repo root or container root
  const repoRoot = resolve(process.cwd(), "..");
  const candidates = [
    resolve(process.cwd(), "openapi.yaml"),
    resolve(repoRoot, "openapi.yaml"),
    "/app/openapi.yaml",
    fileURLToPath(new URL("../../../openapi.yaml", import.meta.url)),
    fileURLToPath(new URL("../../openapi.yaml", import.meta.url)),
  ];
  for (const p of candidates) {
    try {
      cached = yaml.load(readFileSync(p, "utf8"));
      return cached;
    } catch {
      // try next
    }
  }
  // Minimal stub if the file isn't reachable (CI without the working tree)
  cached = {
    openapi: "3.1.0",
    info: { title: "agentBANK", version: "1.0.0" },
    paths: {},
  };
  return cached;
}

export async function openApiRoutes(app: FastifyInstance) {
  app.get("/openapi.json", async () => loadOpenApi());
}

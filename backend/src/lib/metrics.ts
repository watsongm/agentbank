/**
 * backend/src/lib/metrics.ts
 *
 * Prometheus metrics for agentBANK.
 *
 * Exports:
 *  - `registry`              — shared prom-client Registry
 *  - `httpRequestsTotal`     — Counter: http_requests_total{method,route,status_code}
 *  - `httpRequestDurationMs` — Histogram: http_request_duration_ms{method,route}
 *  - `metricsPlugin`         — Fastify plugin that wires up onRequest/onResponse hooks
 *                              and registers GET /metrics (no auth required)
 */

import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

// ── Registry ────────────────────────────────────────────────────────────────

export const registry = new Registry();
registry.setDefaultLabels({ app: "agentbank" });

// Collect Node.js process metrics (heap, CPU, event-loop lag, etc.)
collectDefaultMetrics({ register: registry });

// ── Counters & Histograms ────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests received",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

export const httpRequestDurationMs = new Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route"] as const,
  buckets: [50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

// ── Fastify plugin ───────────────────────────────────────────────────────────

const metricsPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Track start time per request using a WeakMap keyed on the raw request
  const startTimes = new WeakMap<object, number>();

  app.addHook("onRequest", (request, _reply, done) => {
    startTimes.set(request.raw, Date.now());
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const start = startTimes.get(request.raw);
    const durationMs = start !== undefined ? Date.now() - start : 0;

    // Normalise the route label — fall back to the raw URL path
    // (Fastify populates request.routeOptions.url after routing)
    const route =
      (request.routeOptions as { url?: string } | undefined)?.url ??
      request.url.split("?")[0];

    const method = request.method;
    const statusCode = String(reply.statusCode);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationMs.observe({ method, route }, durationMs);

    done();
  });

  // ── GET /metrics — Prometheus text format ──────────────────────────────────
  // This route bypasses auth (registered before authPlugin in server.ts)
  app.get(
    "/metrics",
    {
      config: { skipAuth: true },
      schema: { hide: true } as any, // hide from OpenAPI docs
    },
    async (_request, reply) => {
      const metrics = await registry.metrics();
      reply
        .header("Content-Type", registry.contentType)
        .send(metrics);
    }
  );
};

export const metricsPlugin = fp(metricsPluginImpl, {
  name: "metrics",
  fastify: "4.x",
});

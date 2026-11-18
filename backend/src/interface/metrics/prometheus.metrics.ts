import type { NextFunction, Request, Response } from "express";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export interface MetricsContext {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  handler: (req: Request, res: Response) => Promise<void>;
  setDatabaseUp: (isUp: boolean) => void;
}

/** Creates an isolated Prometheus registry, HTTP instrumentation middleware, and /metrics handler. */
export function createMetricsContext(
  checkDatabaseHealth?: () => Promise<void>,
): MetricsContext {
  const register = new Registry();
  collectDefaultMetrics({ register, prefix: "flix_nodejs_" });

  const httpRequestsTotal = new Counter({
    name: "flix_http_requests_total",
    help: "Total HTTP requests processed by Flix backend",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [register],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "flix_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });

  const dbHealthGauge = new Gauge({
    name: "flix_database_up",
    help: "PostgreSQL availability (1 = up, 0 = down)",
    registers: [register],
  });
  dbHealthGauge.set(1);

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/metrics") {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();
    res.on("finish", () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
      const route = req.route?.path
        ? `${req.baseUrl}${String(req.route.path)}`
        : req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    });
    next();
  };

  const handler = async (_req: Request, res: Response) => {
    if (checkDatabaseHealth) {
      try {
        await checkDatabaseHealth();
        dbHealthGauge.set(1);
      } catch {
        dbHealthGauge.set(0);
      }
    }
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  };

  return {
    middleware,
    handler,
    setDatabaseUp: (isUp: boolean) => dbHealthGauge.set(isUp ? 1 : 0),
  };
}

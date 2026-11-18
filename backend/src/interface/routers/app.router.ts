import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { type AdminUseCase } from "../../application/admin.use-case.ts";
import { type AuthUseCase } from "../../application/auth.use-case.ts";
import { type CatalogUseCase } from "../../application/catalog.use-case.ts";
import { type HistoryUseCase } from "../../application/history.use-case.ts";
import { type LibraryUseCase } from "../../application/library.use-case.ts";
import { type PlaybackUseCase } from "../../application/playback.use-case.ts";
import { type ProfileUseCase } from "../../application/profile.use-case.ts";
import { type TmdbUseCase } from "../../application/tmdb.use-case.ts";
import { AdminController } from "../controllers/admin.controller.ts";
import { CatalogController } from "../controllers/catalog.controller.ts";
import {
  DEFAULT_AVATAR_PATH,
  DEFAULT_AVATAR_SVG,
} from "../assets/default-avatar.ts";
import { HistoryController } from "../controllers/history.controller.ts";
import { LibraryController } from "../controllers/library.controller.ts";
import { PlaybackController } from "../controllers/playback.controller.ts";
import { ProfileController } from "../controllers/profile.controller.ts";
import { TmdbController } from "../controllers/tmdb.controller.ts";
import { createAuthMiddleware } from "../middlewares/auth.middleware.ts";
import { errorMiddleware } from "../middlewares/error.middleware.ts";
import { createAdminRouter } from "./admin.router.ts";
import { createDislikesRouter } from "./dislikes.router.ts";
import { createMoviesRouter } from "./movies.router.ts";
import { createMyListRouter } from "./my-list.router.ts";
import { createProfileRouter } from "./profile.router.ts";
import { openApiSpec } from "./swagger.ts";
import { createTmdbRouter } from "./tmdb.router.ts";
import { createWatchHistoryRouter } from "./watch-history.router.ts";

export interface AppDependencies {
  authHandler: RequestHandler;
  authUseCase: AuthUseCase;
  profileUseCase: ProfileUseCase;
  libraryUseCase: LibraryUseCase;
  historyUseCase: HistoryUseCase;
  catalogUseCase: CatalogUseCase;
  playbackUseCase: PlaybackUseCase;
  tmdbUseCase: TmdbUseCase;
  adminUseCase?: AdminUseCase;
  checkDatabaseHealth?: () => Promise<void>;
}

export function createApp(
  deps: AppDependencies,
  app: Express = express(),
): Express {
  const authMiddleware = createAuthMiddleware(deps.authUseCase);
  const profileController = new ProfileController(deps.profileUseCase);
  const libraryController = new LibraryController(deps.libraryUseCase);
  const historyController = new HistoryController(deps.historyUseCase);
  const catalogController = new CatalogController(deps.catalogUseCase);
  const playbackController = new PlaybackController(deps.playbackUseCase);
  const tmdbController = new TmdbController(deps.tmdbUseCase);

  app.disable("x-powered-by");

  app.use((_req: Request, res: Response, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const configuredOrigins = [
          process.env.FRONTEND_URL,
          ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
        ]
          .map((item) => item?.trim())
          .filter((item): item is string => Boolean(item));

        if (
          configuredOrigins.length === 0 ||
          configuredOrigins.includes(origin) ||
          origin.endsWith(".vercel.app") ||
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use("/api/auth", deps.authHandler);

  app.use(express.json());

  app.get("/", (_req: Request, res: Response) => {
    res.send("Flix Backend OK");
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "flix-backend",
      commitSha: process.env.GIT_COMMIT_SHA || "dev",
      buildNumber: process.env.BUILD_NUMBER || "local",
    });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    const metadata = {
      service: "flix-backend",
      commitSha: process.env.GIT_COMMIT_SHA || "dev",
      buildNumber: process.env.BUILD_NUMBER || "local",
    };

    try {
      if (deps.checkDatabaseHealth) {
        await deps.checkDatabaseHealth();
      }
      res.status(200).json({
        status: "ready",
        database: "up",
        ...metadata,
      });
    } catch {
      res.status(503).json({
        status: "not_ready",
        database: "down",
        ...metadata,
      });
    }
  });

  app.get(DEFAULT_AVATAR_PATH, (_req: Request, res: Response) => {
    res
      .type("image/svg+xml")
      .set("Cache-Control", "public, max-age=86400")
      .send(DEFAULT_AVATAR_SVG);
  });

  app.get("/api-docs.json", (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(
    "/api/movies",
    createMoviesRouter(catalogController, playbackController, authMiddleware),
  );
  app.use("/api/tmdb", createTmdbRouter(tmdbController));
  app.use(
    "/api/profile",
    createProfileRouter(profileController, authMiddleware),
  );
  app.use(
    "/api/watch-history",
    createWatchHistoryRouter(historyController, authMiddleware),
  );
  app.use(
    "/api/my-list",
    createMyListRouter(libraryController, authMiddleware),
  );
  app.use(
    "/api/dislikes",
    createDislikesRouter(libraryController, authMiddleware),
  );

  if (deps.adminUseCase) {
    const adminController = new AdminController(deps.adminUseCase);
    app.use(
      "/api/admin",
      createAdminRouter(adminController, catalogController, authMiddleware),
    );
  }

  app.use(errorMiddleware);

  return app;
}

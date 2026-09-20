import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./app/config/env.js";
import { globalErrorHandler } from "./app/middlewares/errorHandler.js";
import { notFound } from "./app/middlewares/notFound.js";
import { globalRateLimiter } from "./app/middlewares/rateLimiter.js";
import { apiRouter } from "./app/routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients such as Postman/cURL that send no Origin header.
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(globalRateLimiter);

// IMPORTANT: The Stripe webhook route will be mounted HERE in the payment commit,
// before express.json(). Stripe signature verification requires the raw body.

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(env.API_PREFIX, apiRouter);

app.use(notFound);
app.use(globalErrorHandler);

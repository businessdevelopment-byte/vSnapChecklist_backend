import express from "express";

// BigInt is not JSON-serializable by default; serialize as string so res.json() works
// (Frontend ChecklistEntry.id is typed as string, so this is safe)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { env } from "./config/env";
import routes from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

app.use("/api", routes);

app.use(errorHandler);

export default app;

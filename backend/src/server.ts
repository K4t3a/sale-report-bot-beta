// Важно: dotenv должен загрузиться ДО любых импортов, которые используют process.env
// (например, до инициализации пула PostgreSQL в src/lib/db.ts).
import "dotenv/config";

import app from "./app";

const PORT = Number(process.env.PORT ?? 4000);

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException", err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`[server] Backend listening on http://localhost:${PORT}`);
});

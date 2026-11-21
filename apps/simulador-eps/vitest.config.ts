import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://eps_app:eps_dev_pass@localhost:5432/eps_db",
      DIRECT_URL: "postgresql://eps_app:eps_dev_pass@localhost:5432/eps_db",
      FARMA_SERVICE_API_KEY: "test-api-key-simulador-eps",
      DEMO_ADMIN_PASSWORD: "test-demo-password",
      SESSION_SECRET: "test-session-secret-de-al-menos-32-caracteres",
    },
  },
});

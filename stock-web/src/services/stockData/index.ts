import { createHttpStockDataProvider } from "./httpProvider";
import { mockStockDataProvider } from "./mockProvider";
import type { StockDataProvider } from "./types";

export * from "./types";

const providerName = import.meta.env.VITE_STOCK_DATA_PROVIDER ?? "mock";
const apiBaseUrl = import.meta.env.VITE_STOCK_API_BASE_URL ?? "";

export const stockDataProvider: StockDataProvider =
  providerName === "http" && apiBaseUrl ? createHttpStockDataProvider(apiBaseUrl) : mockStockDataProvider;

export const refreshIntervalMs = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS ?? "60000");

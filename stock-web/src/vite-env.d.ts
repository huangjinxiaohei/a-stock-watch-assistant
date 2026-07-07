/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STOCK_DATA_PROVIDER?: string;
  readonly VITE_REFRESH_INTERVAL_MS?: string;
  readonly VITE_STOCK_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_STOCK_API_BASE_URL?: string;
  readonly VITE_TUSHARE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}



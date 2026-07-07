#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const execFileAsync = promisify(execFile);
const serverDir = dirname(fileURLToPath(import.meta.url));

loadDotEnv();

const server = new McpServer({
  name: "stock-mcp-server",
  version: "0.1.0"
});

function loadDotEnv(): void {
  const envPath = join(serverDir, "..", ".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set. Add it to your MCP server environment.");
  }

  return apiKey;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function jsonResponse(data: JsonValue) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

async function finnhubGet<T extends JsonValue>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("token", getApiKey());

  return (await requestJson(url)) as T;
}

async function requestJson(url: URL): Promise<JsonValue> {
  try {
    return await requestJsonWithFetch(url);
  } catch (error) {
    if (process.platform === "win32") {
      return await requestJsonWithPowerShell(url);
    }

    throw new Error(`Finnhub request failed: ${getErrorMessage(error)}`);
  }
}

async function requestJsonWithFetch(url: URL): Promise<JsonValue> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "stock-mcp-server/0.1.0"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Finnhub request failed: ${response.status} ${response.statusText} ${body}`);
  }

  return (await response.json()) as JsonValue;
}

async function requestJsonWithPowerShell(url: URL): Promise<JsonValue> {
  const script = [
    '$ErrorActionPreference = "Stop"',
    "$response = Invoke-WebRequest -Uri $env:FINNHUB_REQUEST_URL -UseBasicParsing -TimeoutSec 30",
    "$response.Content"
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        env: {
          ...process.env,
          FINNHUB_REQUEST_URL: url.toString()
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 35_000,
        windowsHide: true
      }
    );

    return JSON.parse(stdout) as JsonValue;
  } catch {
    throw new Error("Finnhub request failed: Node fetch failed and the Windows PowerShell fallback also failed.");
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9.\-:]+$/, "Use a market symbol such as AAPL, MSFT, BRK.B, or OANDA:EUR_USD.");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.");

server.registerTool(
  "get_quote",
  {
    title: "Get Quote",
    description: "Fetch the latest Finnhub quote for a stock symbol. This is market data, not investment advice.",
    inputSchema: {
      symbol: symbolSchema.describe("Ticker symbol, for example AAPL or MSFT.")
    }
  },
  async ({ symbol }) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = await finnhubGet("/quote", { symbol: normalizedSymbol });

    return jsonResponse({
      symbol: normalizedSymbol,
      quote
    });
  }
);

server.registerTool(
  "get_company_news",
  {
    title: "Get Company News",
    description: "Fetch Finnhub company news for a symbol and date range. This is news data, not investment advice.",
    inputSchema: {
      symbol: symbolSchema.describe("Ticker symbol, for example AAPL or MSFT."),
      from: dateSchema.describe("Start date in YYYY-MM-DD format."),
      to: dateSchema.describe("End date in YYYY-MM-DD format.")
    }
  },
  async ({ symbol, from, to }) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    const news = await finnhubGet("/company-news", {
      symbol: normalizedSymbol,
      from,
      to
    });

    return jsonResponse({
      symbol: normalizedSymbol,
      from,
      to,
      news
    });
  }
);

server.registerTool(
  "get_market_news",
  {
    title: "Get Market News",
    description: "Fetch Finnhub market news by category. This is news data, not investment advice.",
    inputSchema: {
      category: z
        .enum(["general", "forex", "crypto", "merger"])
        .default("general")
        .describe("Finnhub market news category.")
    }
  },
  async ({ category }) => {
    const news = await finnhubGet("/news", { category });

    return jsonResponse({
      category,
      news
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);






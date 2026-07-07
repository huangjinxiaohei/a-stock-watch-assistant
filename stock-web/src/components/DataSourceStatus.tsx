import { Cloud, Database, HardDrive } from "lucide-react";
import type { DataStatus } from "../services/stockData";

export function DataSourceStatus({ status, label }: { status?: DataStatus; label?: string }) {
  if (!status) {
    return (
      <div className="data-status neutral">
        <Database size={16} />
        <div>
          <strong>{label ? `${label}：数据源状态未知` : "数据源状态未知"}</strong>
          <p>当前接口未返回数据源状态，可能仍在使用旧服务或 mock 数据。</p>
        </div>
      </div>
    );
  }

  const tone = status.mode === "fallback" ? "bad" : status.mode === "stale" || status.mode === "stale_refreshing" ? "warn" : "good";
  const Icon = status.provider === "cache" || status.mode === "fresh" || status.mode === "stale" || status.mode === "stale_refreshing" ? HardDrive : status.mode === "live" ? Cloud : Database;
  const sourceProvider = status.sourceProvider ?? status.provider;

  return (
    <div className={`data-status ${tone}`}>
      <Icon size={16} />
      <div>
        <strong>{label ? `${label}：${getModeLabel(status.mode)}` : getModeLabel(status.mode)}</strong>
        <p>
          原始来源：{getProviderLabel(sourceProvider)}
          {status.provider === "cache" ? ` · 读取：本地 SQLite 缓存` : " · 读取：实时接口"}
          {status.cacheAgeSeconds > 0 ? ` · ${formatAge(status.cacheAgeSeconds)} 前更新` : ""}
        </p>
        {status.coverageNote ? <p className="status-warning">字段提示：{status.coverageNote}</p> : null}
        {status.warning ? <p className="status-warning">状态提示：{status.warning.slice(0, 120)}</p> : null}
      </div>
    </div>
  );
}

function getModeLabel(mode: string): string {
  if (mode === "live") return "实时真实数据";
  if (mode === "fresh") return "真实数据缓存（新鲜）";
  if (mode === "stale") return "真实数据缓存（实时刷新失败，使用旧数据）";
  if (mode === "fallback") return "模拟数据兜底";
  return `数据状态：${mode}`;
}

function getProviderLabel(provider: string): string {
  if (provider === "akshare") return "东方财富 / AkShare 免费接口";
  if (provider === "cache") return "本地 SQLite 缓存";
  if (provider === "mock") return "本地模拟数据";
  return provider;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${Math.round(seconds / 3600)} 小时`;
}




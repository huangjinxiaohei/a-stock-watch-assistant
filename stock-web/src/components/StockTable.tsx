import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Quote } from "../services/stockData";
import { formatMoney, formatNumber, formatOptionalNumber, formatOptionalPercent, formatPercent, toneClass } from "../utils/format";
import { EmptyState } from "./StateViews";

type SortKey = "changePercent" | "latestPrice" | "amount" | "turnoverRate" | "name";

interface StockTableProps {
  quotes: Quote[];
  onSelect: (symbol: string) => void;
  onRemove?: (symbol: string) => void;
  onRefresh?: () => void;
  title: string;
  sortable?: boolean;
  dense?: boolean;
  emptyLabel?: string;
  bare?: boolean;
  refreshing?: boolean;
  defaultSortKey?: SortKey;
  defaultSortDirection?: "asc" | "desc";
}

export function StockTable({
  quotes,
  onSelect,
  onRemove,
  onRefresh,
  title,
  sortable = false,
  dense = false,
  emptyLabel,
  bare = false,
  refreshing = false,
  defaultSortKey = "changePercent",
  defaultSortDirection = "desc"
}: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  useEffect(() => {
    setSortKey(defaultSortKey);
    setSortDirection(defaultSortDirection);
  }, [defaultSortDirection, defaultSortKey]);

  const sortedQuotes = useMemo(() => {
    if (!sortable) return quotes;
    return [...quotes].sort((a, b) => {
      const result = sortKey === "name" ? a.name.localeCompare(b.name, "zh-CN") : Number(a[sortKey] || 0) - Number(b[sortKey] || 0);
      return sortDirection === "asc" ? result : -result;
    });
  }, [quotes, sortDirection, sortKey, sortable]);

  const activeRefreshing = refreshing || localRefreshing;

  const handleRefresh = async () => {
    if (!onRefresh || activeRefreshing) return;
    setLocalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setLocalRefreshing(false);
    }
  };

  const updateSort = (nextKey: SortKey) => {
    if (!sortable) return;
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "name" ? "asc" : "desc");
  };

  const body = (
    <>
      {!bare ? (
        <div className="panel-header compact-header">
          <h2>{title}</h2>
          {onRefresh ? (
            <button className={`icon-button refresh-icon-button ${activeRefreshing ? "is-refreshing" : ""}`} type="button" title="刷新" aria-label="刷新" onClick={handleRefresh} disabled={activeRefreshing}>
              <RefreshCw className="refresh-icon" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}
      {quotes.length === 0 ? (
        <EmptyState label={emptyLabel || "暂无股票，搜索后可加入自选"} />
      ) : (
        <div className="table-wrap">
          <table className="stock-table market-table">
            <thead>
              <tr>
                <HeaderButton label="名称" sortKey="name" activeKey={sortKey} sortable={sortable} onSort={updateSort} />
                <HeaderButton label="最新价" sortKey="latestPrice" activeKey={sortKey} sortable={sortable} onSort={updateSort} align="right" />
                <HeaderButton label="涨跌幅" sortKey="changePercent" activeKey={sortKey} sortable={sortable} onSort={updateSort} align="right" />
                <HeaderButton label="成交额" sortKey="amount" activeKey={sortKey} sortable={sortable} onSort={updateSort} align="right" />
                <HeaderButton label="换手" sortKey="turnoverRate" activeKey={sortKey} sortable={sortable} onSort={updateSort} align="right" />
                <th>PE/PB</th>
                {onRemove ? <th>操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map((quote) => (
                <tr className="clickable-row" key={quote.symbol} onClick={() => onSelect(quote.symbol)}>
                  <td>
                    <div className="table-stock-button">
                      <strong>{quote.name}</strong>
                      <span>{quote.code} · {quote.industry}</span>
                    </div>
                  </td>
                  <td>{formatNumber(quote.latestPrice)}</td>
                  <td className={toneClass(quote.changePercent)}>{formatPercent(quote.changePercent)}</td>
                  <td>{formatMoney(quote.amount)}</td>
                  <td>{formatOptionalPercent(quote.turnoverRate)}</td>
                  <td>{formatOptionalNumber(quote.pe, 1)} / {formatOptionalNumber(quote.pb, 1)}</td>
                  {onRemove ? (
                    <td>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="删除自选"
                        aria-label="删除自选"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemove(quote.symbol);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (bare) return <div className={dense ? "dense-panel" : undefined}>{body}</div>;
  return <section className={`panel ${dense ? "dense-panel" : ""}`}>{body}</section>;
}

function HeaderButton({ label, sortKey, activeKey, sortable, onSort, align = "left" }: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  sortable: boolean;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  if (!sortable) {
    return <th className={align === "right" ? "align-right" : undefined}>{label}</th>;
  }

  return (
    <th className={align === "right" ? "align-right" : undefined}>
      <button className={`sort-button ${activeKey === sortKey ? "active" : ""}`} type="button" onClick={() => onSort(sortKey)}>
        {label}
      </button>
    </th>
  );
}

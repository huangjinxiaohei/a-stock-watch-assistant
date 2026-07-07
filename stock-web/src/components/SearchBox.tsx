import { Search, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { stockDataProvider, type StockSummary } from "../services/stockData";

interface SearchBoxProps {
  onSelect: (symbol: string) => void;
  onAddWatch: (symbol: string) => void;
}

export function SearchBox({ onSelect, onAddWatch }: SearchBoxProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmedKeyword = keyword.trim();

  useEffect(() => {
    if (trimmedKeyword.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await stockDataProvider.searchStocks(trimmedKeyword));
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [trimmedKeyword]);

  const showResults = trimmedKeyword.length >= 2;

  return (
    <div className="search-box compact-search">
      <div className="search-input-wrap">
        <Search size={18} />
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="输入代码或名称搜索，例如 600519 / 贵州茅台"
        />
        {keyword ? (
          <button className="clear-search" type="button" aria-label="清空搜索" title="清空搜索" onClick={() => setKeyword("")}>
            <X size={15} />
          </button>
        ) : null}
      </div>
      {showResults ? (
        <div className="search-results dropdown-results">
          {loading ? <div className="search-row muted">搜索中...</div> : null}
          {!loading && results.length === 0 ? <div className="search-row muted">没有匹配股票</div> : null}
          {results.slice(0, 8).map((stock) => (
            <div className="search-row" key={stock.symbol}>
              <button type="button" className="link-button" onClick={() => onSelect(stock.symbol)}>
                <strong>{stock.name}</strong>
                <span>{stock.code}</span>
                <span>{stock.industry}</span>
              </button>
              <button className="icon-button" type="button" aria-label="加入自选" title="加入自选" onClick={() => onAddWatch(stock.symbol)}>
                <Star size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="search-hint">输入至少 2 个字符后显示搜索结果</div>
      )}
    </div>
  );
}
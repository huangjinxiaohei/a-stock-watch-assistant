import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { stockDataProvider, type StockSummary } from "../services/stockData";

interface ResearchLauncherProps {
  loading: boolean;
  onGenerate: (keyword: string) => void;
}

export function ResearchLauncher({ loading, onGenerate }: ResearchLauncherProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<StockSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmedKeyword = useMemo(() => keyword.trim(), [keyword]);

  useEffect(() => {
    if (trimmedKeyword.length < 2) {
      setResults([]);
      return;
    }

    let disposed = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const nextResults = await stockDataProvider.searchStocks(trimmedKeyword);
        if (!disposed) setResults(nextResults.slice(0, 5));
      } catch {
        if (!disposed) setResults([]);
      } finally {
        if (!disposed) setSearching(false);
      }
    }, 260);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [trimmedKeyword]);

  const handleGenerate = () => {
    if (!trimmedKeyword || loading) return;
    onGenerate(trimmedKeyword);
  };

  return (
    <section className="panel research-launcher" aria-label="AI投研助手入口">
      <div className="research-launcher-copy">
        <span className="eyebrow">AI Research Assistant</span>
        <h2>输入股票代码，生成结构化研究报告</h2>
        <p>优先调用后端AI报告接口整理公开行情、K线、技术指标和新闻线索；接口不可用时自动返回规则整理稿。</p>
      </div>

      <div className="research-input-block">
        <div className="research-input-row">
          <Search size={18} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleGenerate();
            }}
            placeholder="输入股票代码或名称，例如 600519 / 贵州茅台"
          />
          <button className="primary-button" type="button" onClick={handleGenerate} disabled={!trimmedKeyword || loading}>
            <FileText size={17} />
            {loading ? "生成中" : "生成研究报告"}
          </button>
        </div>

        <div className="research-suggestion-list">
          {searching ? <span className="research-search-state">正在匹配股票...</span> : null}
          {!searching && results.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              className="research-suggestion"
              onClick={() => {
                setKeyword(`${stock.code} ${stock.name}`);
                onGenerate(stock.symbol);
              }}
              disabled={loading}
            >
              <strong>{stock.name}</strong>
              <span>{stock.code} · {stock.market} · {stock.industry || "行业待补充"}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

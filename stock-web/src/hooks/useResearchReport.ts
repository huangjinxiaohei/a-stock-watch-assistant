import { useCallback, useState } from "react";
import { generateResearchReport, type ResearchReport } from "../analysis/researchReport";
import { stockDataProvider, type MarketOverview } from "../services/stockData";

const researchSteps = ["准备数据", "整理行情", "整理技术指标", "生成研究报告"];

export function useResearchReport(overview: MarketOverview | null) {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const generate = useCallback(async (keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;

    setLoading(true);
    setError("");
    setReport(null);
    setCurrentStep(0);

    try {
      const searchResults = await stockDataProvider.searchStocks(trimmedKeyword).catch(() => []);
      const matched = searchResults.find((stock) => stock.symbol.toUpperCase() === trimmedKeyword.toUpperCase() || stock.code === trimmedKeyword || stock.name.includes(trimmedKeyword)) || searchResults[0];
      const symbol = matched?.symbol || normalizeResearchSymbol(trimmedKeyword);

      setCurrentStep(1);
      const quote = await stockDataProvider.getStockQuote(symbol);

      setCurrentStep(2);
      const [detail, kline] = await Promise.all([
        stockDataProvider.getStockDetail(symbol).catch(() => null),
        stockDataProvider.getKline(symbol).catch(() => null)
      ]);

      setCurrentStep(3);
      setReport(generateResearchReport({ quote: detail?.quote || quote, quoteStatus: quote._dataStatus, detail, kline, overview }));
    } catch (researchLoadError) {
      setError(researchLoadError instanceof Error ? researchLoadError.message : "研究报告生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [overview]);

  return {
    report,
    loading,
    error,
    currentStep,
    steps: researchSteps,
    generate
  };
}

function normalizeResearchSymbol(keyword: string): string {
  const token = keyword.trim().split(/\s+/)[0].toUpperCase();
  if (/^(SH|SZ|BJ)\d{6}$/.test(token)) return token;
  if (/^\d{6}$/.test(token)) {
    if (token.startsWith("6")) return `SH${token}`;
    if (token.startsWith("8") || token.startsWith("4")) return `BJ${token}`;
    return `SZ${token}`;
  }
  return token;
}

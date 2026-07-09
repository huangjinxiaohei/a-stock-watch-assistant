import { useCallback, useRef, useState } from "react";
import { generateResearchReport, type ResearchReport } from "../analysis/researchReport";
import { requestBackendResearchReport } from "../services/researchReportApi";
import { stockDataProvider, type MarketOverview } from "../services/stockData";

const researchSteps = ["解析股票", "请求AI报告", "准备规则兜底", "生成研究报告"];

export function useResearchReport(overview: MarketOverview | null) {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const requestIdRef = useRef(0);

  const generate = useCallback(async (keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => requestIdRef.current === requestId;

    setLoading(true);
    setError("");
    setReport(null);
    setCurrentStep(0);

    try {
      const searchResults = await stockDataProvider.searchStocks(trimmedKeyword).catch(() => []);
      if (!isCurrentRequest()) return;

      const matched = searchResults.find((stock) => stock.symbol.toUpperCase() === trimmedKeyword.toUpperCase() || stock.code === trimmedKeyword || stock.name.includes(trimmedKeyword)) || searchResults[0];
      const symbol = matched?.symbol || normalizeResearchSymbol(trimmedKeyword);

      setCurrentStep(1);
      try {
        const backendReport = await requestBackendResearchReport({
          symbol,
          keyword: trimmedKeyword,
          language: "zh-CN",
          depth: "standard"
        });
        if (!isCurrentRequest()) return;
        setCurrentStep(3);
        setReport(backendReport);
        return;
      } catch (backendError) {
        if (!isCurrentRequest()) return;
        setCurrentStep(2);
        const fallbackReason = backendError instanceof Error ? backendError.message : "后端AI报告暂不可用";

        const quote = await stockDataProvider.getStockQuote(symbol);
        if (!isCurrentRequest()) return;

        const [detail, kline] = await Promise.all([
          stockDataProvider.getStockDetail(symbol).catch(() => null),
          stockDataProvider.getKline(symbol).catch(() => null)
        ]);
        if (!isCurrentRequest()) return;

        setCurrentStep(3);
        setReport(generateResearchReport({
          quote: detail?.quote || quote,
          quoteStatus: quote._dataStatus,
          detail,
          kline,
          overview,
          reportStatus: {
            source: "rule_fallback",
            status: "fallback",
            provider: "frontend-rule",
            model: null,
            fallbackReason: `后端AI报告暂不可用，已使用本地规则整理稿。${fallbackReason}`,
            latencyMs: null
          },
          warnings: ["后端AI报告暂不可用，已使用本地规则整理稿。"]
        }));
      }
    } catch (researchLoadError) {
      if (!isCurrentRequest()) return;
      setError(researchLoadError instanceof Error ? researchLoadError.message : "研究报告生成失败，请稍后重试。");
    } finally {
      if (isCurrentRequest()) setLoading(false);
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

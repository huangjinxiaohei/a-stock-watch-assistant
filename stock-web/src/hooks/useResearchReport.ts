import { useCallback, useRef, useState } from "react";
import { generateResearchReport, type ResearchReport } from "../analysis/researchReport";
import { requestBackendResearchReport } from "../services/researchReportApi";
import { stockDataProvider, type MarketOverview } from "../services/stockData";

const researchSteps = ["\u89e3\u6790\u80a1\u7968", "\u8bf7\u6c42\u89c4\u5219\u62a5\u544a", "\u51c6\u5907\u89c4\u5219\u515c\u5e95", "\u751f\u6210\u7814\u7a76\u62a5\u544a"];
const AI_REQUEST_TIMEOUT_MS = 120000;

export function useResearchReport(overview: MarketOverview | null) {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiElapsedSeconds, setAiElapsedSeconds] = useState(0);
  const [aiError, setAiError] = useState("");
  const requestIdRef = useRef(0);
  const aiRequestIdRef = useRef(0);
  const aiAbortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    aiRequestIdRef.current += 1;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    const isCurrentRequest = () => requestIdRef.current === requestId;

    setLoading(true);
    setError("");
    setAiLoading(false);
    setAiElapsedSeconds(0);
    setAiError("");
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
          depth: "standard",
          generationMode: "rule"
        });
        if (!isCurrentRequest()) return;
        setCurrentStep(3);
        setReport(backendReport);
        return;
      } catch (backendError) {
        if (!isCurrentRequest()) return;
        setCurrentStep(2);
        const fallbackReason = backendError instanceof Error ? backendError.message : "\u540e\u7aef\u89c4\u5219\u62a5\u544a\u6682\u4e0d\u53ef\u7528";

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
            fallbackReason: `\u540e\u7aef\u89c4\u5219\u62a5\u544a\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u89c4\u5219\u6574\u7406\u7a3f\u3002${fallbackReason}`,
            latencyMs: null
          },
          warnings: ["\u540e\u7aef\u89c4\u5219\u62a5\u544a\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u89c4\u5219\u6574\u7406\u7a3f\u3002"]
        }));
      }
    } catch (researchLoadError) {
      if (!isCurrentRequest()) return;
      setError(researchLoadError instanceof Error ? researchLoadError.message : "\u7814\u7a76\u62a5\u544a\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [overview]);

  const generateAi = useCallback(async () => {
    if (!report || aiLoading || loading) return;

    const reportRequestId = requestIdRef.current;
    const aiRequestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = aiRequestId;
    const controller = new AbortController();
    aiAbortRef.current = controller;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setAiElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const isCurrentAiRequest = () => aiRequestIdRef.current === aiRequestId && requestIdRef.current === reportRequestId;

    setAiLoading(true);
    setAiElapsedSeconds(0);
    setAiError("");

    try {
      const backendReport = await requestBackendResearchReport({
        symbol: report.symbol,
        keyword: report.symbol,
        language: "zh-CN",
        depth: "standard",
        generationMode: "ai"
      }, {
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
        signal: controller.signal
      });
      if (!isCurrentAiRequest()) return;

      if (backendReport.reportStatus.source === "llm" && backendReport.reportStatus.status === "success") {
        setReport(backendReport);
      } else {
        setAiError(backendReport.reportStatus.fallbackReason || "AI\u589e\u5f3a\u62a5\u544a\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u4fdd\u7559\u5f53\u524d\u89c4\u5219\u6574\u7406\u7a3f\u3002");
      }
    } catch (aiRequestError) {
      if (!isCurrentAiRequest()) return;
      if (controller.signal.aborted) {
        setAiError("\u5df2\u505c\u6b62\u7b49\u5f85 AI \u589e\u5f3a\u62a5\u544a\u3002\u670d\u52a1\u7aef\u6a21\u578b\u8c03\u7528\u53ef\u80fd\u4ecd\u5728\u5b8c\u6210\u5e76\u4ea7\u751f\u8d39\u7528\u3002");
      } else {
        const reason = aiRequestError instanceof Error ? aiRequestError.message : "AI\u589e\u5f3a\u62a5\u544a\u8bf7\u6c42\u5931\u8d25";
        setAiError(`${reason}\uff0c\u5df2\u4fdd\u7559\u5f53\u524d\u89c4\u5219\u6574\u7406\u7a3f\u3002`);
      }
    } finally {
      window.clearInterval(timer);
      if (isCurrentAiRequest()) {
        aiAbortRef.current = null;
        setAiLoading(false);
      }
    }
  }, [aiLoading, loading, report]);

  const stopAiWait = useCallback(() => {
    if (!aiAbortRef.current) return;
    aiRequestIdRef.current += 1;
    aiAbortRef.current.abort();
    aiAbortRef.current = null;
    setAiLoading(false);
    setAiError("\u5df2\u505c\u6b62\u7b49\u5f85 AI \u589e\u5f3a\u62a5\u544a\u3002\u670d\u52a1\u7aef\u6a21\u578b\u8c03\u7528\u53ef\u80fd\u4ecd\u5728\u5b8c\u6210\u5e76\u4ea7\u751f\u8d39\u7528\u3002");
  }, []);

  return {
    report,
    loading,
    error,
    currentStep,
    steps: researchSteps,
    generate,
    generateAi,
    stopAiWait,
    aiLoading,
    aiElapsedSeconds,
    aiError
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

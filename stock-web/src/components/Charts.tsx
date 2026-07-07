import { BarChart, CandlestickChart, LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { init, use, type ECharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef, type DependencyList } from "react";
import { calculateTechnicalIndicators, type BollPoint, type KdjPoint, type MacdPoint } from "../analysis/technicalIndicators";
import type { IntradayPoint, KlinePoint } from "../services/stockData";

use([BarChart, CandlestickChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

interface ChartProps {
  title: string;
  intraday?: IntradayPoint[];
  kline?: KlinePoint[];
  indicator?: KlineIndicator;
}

export type KlineIndicator = "volume" | "macd" | "kdj" | "rsi" | "boll";

export function IntradayChart({ title, intraday = [] }: ChartProps) {
  const ref = useChart((chart) => {
    chart.setOption({
      title: { text: title, left: 10, top: 6, textStyle: { fontSize: 13, fontWeight: 700 } },
      tooltip: { trigger: "axis" },
      grid: [
        { left: 44, right: 16, top: 42, height: 190 },
        { left: 44, right: 16, top: 252, height: 58 }
      ],
      xAxis: [
        { type: "category", data: intraday.map((point) => point.time), boundaryGap: false, axisLabel: { hideOverlap: true } },
        { type: "category", gridIndex: 1, data: intraday.map((point) => point.time), axisLabel: { show: false }, axisTick: { show: false } }
      ],
      yAxis: [{ type: "value", scale: true }, { type: "value", gridIndex: 1, scale: true, axisLabel: { show: false }, splitLine: { show: false } }],
      series: [
        {
          name: "价格",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: intraday.map((point) => point.price),
          lineStyle: { width: 2, color: "#d93025" },
          areaStyle: { color: "rgba(217, 48, 37, 0.08)" }
        },
        {
          name: "均价",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: intraday.map((point) => point.averagePrice),
          lineStyle: { width: 1.4, color: "#1f6feb" }
        },
        {
          name: "成交量",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: intraday.map((point) => point.volume),
          itemStyle: { color: "#9aa4b2" }
        }
      ]
    });
  }, [intraday, title]);

  return <div className="chart" ref={ref} />;
}

export function KlineChart({ title, kline = [], indicator = "volume" }: ChartProps) {
  const ref = useChart((chart) => {
    const dates = kline.map((point) => point.date);
    const candles = kline.map((point) => [point.open, point.close, point.low, point.high]);
    const technical = calculateTechnicalIndicators(kline);
    const { macd, kdj, rsi, boll } = technical;
    const indicatorConfig = buildIndicatorConfig(indicator, kline, macd, kdj, rsi, boll);

    chart.setOption({
      title: { text: title, left: 10, top: 6, textStyle: { fontSize: 13, fontWeight: 700 } },
      tooltip: { trigger: "axis" },
      legend: { top: 6, right: 12, data: indicatorConfig.legend },
      grid: [
        { left: 44, right: 16, top: 44, height: 225 },
        { left: 44, right: 16, top: 292, height: 70 }
      ],
      xAxis: [
        { type: "category", data: dates, boundaryGap: true, axisLabel: { hideOverlap: true } },
        { type: "category", gridIndex: 1, data: dates, axisLabel: { show: false }, axisTick: { show: false } }
      ],
      yAxis: [{ scale: true }, { gridIndex: 1, scale: true, axisLabel: { show: false }, splitLine: { show: false } }],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], start: 35, end: 100 }],
      series: [
        {
          name: "K线",
          type: "candlestick",
          data: candles,
          itemStyle: { color: "#d93025", color0: "#16834a", borderColor: "#d93025", borderColor0: "#16834a" }
        },
        { name: "MA5", type: "line", showSymbol: false, data: kline.map((point) => point.ma5), lineStyle: { color: "#d08b21", width: 1.3 } },
        { name: "MA10", type: "line", showSymbol: false, data: kline.map((point) => point.ma10), lineStyle: { color: "#1f6feb", width: 1.3 } },
        { name: "MA20", type: "line", showSymbol: false, data: kline.map((point) => point.ma20), lineStyle: { color: "#6f42c1", width: 1.3 } },
        ...indicatorConfig.series
      ]
    });
  }, [indicator, kline, title]);

  return <div className="chart kline-chart" ref={ref} />;
}

function buildIndicatorConfig(
  indicator: KlineIndicator,
  kline: KlinePoint[],
  macd: MacdPoint[],
  kdj: KdjPoint[],
  rsi: Record<"rsi6" | "rsi12" | "rsi24", Array<number | null>>,
  boll: BollPoint[]
) {
  const baseLegend = ["K线", "MA5", "MA10", "MA20"];

  if (indicator === "macd") {
    return {
      legend: [...baseLegend, "DIF", "DEA", "MACD"],
      series: [
        { name: "DIF", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: macd.map((point) => point.dif), lineStyle: { color: "#d08b21", width: 1.2 } },
        { name: "DEA", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: macd.map((point) => point.dea), lineStyle: { color: "#1f6feb", width: 1.2 } },
        {
          name: "MACD",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: macd.map((point) => ({ value: point.macd, itemStyle: { color: point.macd >= 0 ? "#d93025" : "#16834a" } }))
        }
      ]
    };
  }

  if (indicator === "kdj") {
    return {
      legend: [...baseLegend, "K", "D", "J"],
      series: [
        { name: "K", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: kdj.map((point) => point.k), lineStyle: { color: "#d08b21", width: 1.2 } },
        { name: "D", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: kdj.map((point) => point.d), lineStyle: { color: "#1f6feb", width: 1.2 } },
        { name: "J", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: kdj.map((point) => point.j), lineStyle: { color: "#d93025", width: 1.2 } }
      ]
    };
  }

  if (indicator === "rsi") {
    return {
      legend: [...baseLegend, "RSI6", "RSI12", "RSI24"],
      series: [
        { name: "RSI6", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: rsi.rsi6, lineStyle: { color: "#d93025", width: 1.2 } },
        { name: "RSI12", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: rsi.rsi12, lineStyle: { color: "#d08b21", width: 1.2 } },
        { name: "RSI24", type: "line", xAxisIndex: 1, yAxisIndex: 1, showSymbol: false, data: rsi.rsi24, lineStyle: { color: "#1f6feb", width: 1.2 } }
      ]
    };
  }

  if (indicator === "boll") {
    return {
      legend: [...baseLegend, "BOLL上轨", "BOLL中轨", "BOLL下轨", "成交量"],
      series: [
        { name: "BOLL上轨", type: "line", showSymbol: false, data: boll.map((point) => point.upper), lineStyle: { color: "#d93025", width: 1, opacity: 0.85 } },
        { name: "BOLL中轨", type: "line", showSymbol: false, data: boll.map((point) => point.mid), lineStyle: { color: "#d08b21", width: 1, opacity: 0.85 } },
        { name: "BOLL下轨", type: "line", showSymbol: false, data: boll.map((point) => point.lower), lineStyle: { color: "#16834a", width: 1, opacity: 0.85 } },
        buildVolumeSeries(kline)
      ]
    };
  }

  return {
    legend: [...baseLegend, "成交量"],
    series: [buildVolumeSeries(kline)]
  };
}

function buildVolumeSeries(kline: KlinePoint[]) {
  return {
    name: "成交量",
    type: "bar",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: kline.map((point) => ({ value: point.volume, itemStyle: { color: point.close >= point.open ? "#d93025" : "#16834a" } }))
  };
}

function useChart(render: (chart: ECharts) => void, deps: DependencyList) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const chart = init(elementRef.current);
    render(chart);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return elementRef;
}


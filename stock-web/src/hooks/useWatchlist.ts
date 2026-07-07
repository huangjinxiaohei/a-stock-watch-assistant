import { useCallback, useEffect, useState } from "react";

const storageKey = "a-share-watchlist";
const defaultSymbols = ["SH600519", "SZ000001", "SZ300750"];

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultSymbols;
    } catch {
      return defaultSymbols;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(symbols));
  }, [symbols]);

  const addSymbol = useCallback((symbol: string) => {
    setSymbols((current) => (current.includes(symbol) ? current : [symbol, ...current]));
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setSymbols((current) => current.filter((item) => item !== symbol));
  }, []);

  return { symbols, addSymbol, removeSymbol };
}

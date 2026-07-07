import { lazy, Suspense, useEffect, useState } from "react";
import { useWatchlist } from "./hooks/useWatchlist";
import { HomePage } from "./pages/HomePage";
import { LoadingState } from "./components/StateViews";

const StockDetailPage = lazy(() => import("./pages/StockDetailPage").then((module) => ({ default: module.StockDetailPage })));
type ThemeMode = "light" | "dark";

function getInitialSymbol(): string | null {
  const hash = window.location.hash.replace("#/stock/", "");
  return hash && hash !== window.location.hash ? decodeURIComponent(hash) : null;
}

function getInitialTheme(): ThemeMode {
  const stored = window.localStorage.getItem("stock-web-theme");
  return stored === "dark" ? "dark" : "light";
}

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(() => getInitialSymbol());
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const { symbols, addSymbol, removeSymbol } = useWatchlist();

  useEffect(() => {
    const handleHashChange = () => setSelectedSymbol(getInitialSymbol());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("stock-web-theme", theme);
  }, [theme]);

  const selectStock = (symbol: string) => {
    window.location.hash = `#/stock/${encodeURIComponent(symbol)}`;
    setSelectedSymbol(symbol);
  };

  const backHome = () => {
    window.location.hash = "";
    setSelectedSymbol(null);
  };

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return selectedSymbol ? (
    <Suspense fallback={<LoadingState label="正在加载个股详情" />}>
      <StockDetailPage symbol={selectedSymbol} onBack={backHome} onAddWatch={addSymbol} />
    </Suspense>
  ) : (
    <HomePage watchSymbols={symbols} onAddWatch={addSymbol} onRemoveWatch={removeSymbol} onSelectStock={selectStock} theme={theme} onToggleTheme={toggleTheme} />
  );
}

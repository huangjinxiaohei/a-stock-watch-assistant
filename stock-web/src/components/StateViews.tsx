import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "正在加载行情数据" }: { label?: string }) {
  return (
    <div className="state-view">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ label = "暂无数据" }: { label?: string }) {
  return <div className="state-view muted">{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-view error-state">
      <AlertCircle size={22} />
      <span>{message}</span>
      {onRetry ? (
        <button className="secondary-button" type="button" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}

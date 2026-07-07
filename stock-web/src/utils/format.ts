export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function formatOptionalNumber(value: number, digits = 2): string {
  return Number.isFinite(value) && value !== 0 ? formatNumber(value, digits) : "暂无";
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}%`;
}

export function formatOptionalPercent(value: number): string {
  return value > 0 ? `${formatNumber(value)}%` : "暂无";
}

export function formatMoney(value: number): string {
  const abs = Math.abs(value);

  if (abs === 0) {
    return "暂无";
  }

  if (abs >= 100_000_000) {
    return `${formatNumber(value / 100_000_000)}亿`;
  }

  if (abs >= 10_000) {
    return `${formatNumber(value / 10_000)}万`;
  }

  return formatNumber(value, 0);
}

export function formatVolume(value: number): string {
  if (value >= 100_000_000) {
    return `${formatNumber(value / 100_000_000)}亿手`;
  }

  if (value >= 10_000) {
    return `${formatNumber(value / 10_000)}万手`;
  }

  return `${formatNumber(value, 0)}手`;
}

export function toneClass(value: number): string {
  if (value > 0) return "rise";
  if (value < 0) return "fall";
  return "flat";
}

# A股行情 API 代理

本服务给 `stock-web` 提供统一 JSON 接口。默认使用 AkShare 聚合免费公开数据源，前端只访问本服务，不直接访问第三方接口。

## 安装

```powershell
cd stock-api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## 配置

复制 `.env.example` 为 `.env`：

```env
STOCK_API_PROVIDER=akshare
STOCK_API_HOST=127.0.0.1
STOCK_API_PORT=8787
STOCK_API_ALLOW_MOCK_FALLBACK=true
STOCK_API_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

基础行情、K线、换手率、PE/PB、总市值优先走免费 AkShare 数据源：

- 东方财富快照：实时行情、PE/PB、总市值、流通市值、全市场换手率。
- 百度估值：详情页 PE、PB、总市值兜底。
- 历史行情：详情页换手率兜底。

如果某个免费接口被本机网络代理拦截，接口会继续使用缓存或 mock fallback，不用付费开通 Tushare `daily_basic`。

公网部署时，把 Netlify 正式域名追加到 `STOCK_API_CORS_ORIGINS`，例如：`https://your-site.netlify.app`。

## 运行

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

前端 `.env.local`：

```env
VITE_STOCK_DATA_PROVIDER=http
VITE_STOCK_API_BASE_URL=http://127.0.0.1:8787/api
VITE_REFRESH_INTERVAL_MS=60000
```

健康检查：

```text
http://127.0.0.1:8787/api/health
```

本服务只做行情查询和辅助分析数据聚合，不构成投资建议。

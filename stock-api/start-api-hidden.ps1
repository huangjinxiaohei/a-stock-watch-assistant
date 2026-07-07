$apiDir = 'C:\Users\梁嘉辰\Documents\炒股行情辅助分析\stock-api'
$python = Join-Path $apiDir '.venv\Scripts\python.exe'
Set-Location -LiteralPath $apiDir
& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8787

from __future__ import annotations

import sys
from pathlib import Path

import uvicorn

base_dir = Path(__file__).resolve().parent
log_file = base_dir / "api.runtime.log"
err_file = base_dir / "api.err.log"

sys.stdout = log_file.open("a", encoding="utf-8", buffering=1)
sys.stderr = err_file.open("a", encoding="utf-8", buffering=1)

uvicorn.run("app.main:app", host="127.0.0.1", port=8787, log_level="info")

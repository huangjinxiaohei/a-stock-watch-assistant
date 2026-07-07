@echo off
set "RUNTIME=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime"
set "PATH=%RUNTIME%\dependencies\node\bin;%RUNTIME%\dependencies\bin;%PATH%"
"%RUNTIME%\dependencies\bin\pnpm.cmd" dev --host 127.0.0.1 --port 5173

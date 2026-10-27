# PRISM-AI Camera & AI Model Test Runner
$VenvPython = Join-Path $PSScriptRoot "ai-service\edge\venv\Scripts\python.exe"
$TestScript = Join-Path $PSScriptRoot "scripts\test_ai_camera.py"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Virtual environment not found at: $VenvPython" -ForegroundColor Red
    exit 1
}

Write-Host "[PRISM-AI] Running Camera 1 (UGREEN) test using edge venv Python..." -ForegroundColor Cyan
& $VenvPython $TestScript

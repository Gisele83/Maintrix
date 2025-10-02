# Maintrix Integration Test Suite - PowerShell

Write-Host "🧪 Maintrix Integration Test Suite" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$env:NODE_ENV = "test"
$env:API_URL = "http://localhost:5000"

$testType = $args[0]

switch ($testType) {
    "coverage" {
        Write-Host "📊 Running tests with coverage..." -ForegroundColor Yellow
        npx jest --coverage
    }
    "watch" {
        Write-Host "👁️ Running tests in watch mode..." -ForegroundColor Yellow
        npx jest --watch
    }
    "gmao" {
        Write-Host "🔧 Running GMAO module tests..." -ForegroundColor Yellow
        npx jest tests/gmao.test.ts
    }
    "diagnostic" {
        Write-Host "🤖 Running Diagnostic module tests..." -ForegroundColor Yellow
        npx jest tests/diagnostic.test.ts
    }
    "tenant" {
        Write-Host "🏢 Running Multi-tenant tests..." -ForegroundColor Yellow
        npx jest tests/multi-tenant.test.ts
    }
    "integration" {
        Write-Host "🔗 Running inter-module communication tests..." -ForegroundColor Yellow
        npx jest tests/inter-module-communication.test.ts
    }
    default {
        Write-Host "🚀 Running all integration tests..." -ForegroundColor Yellow
        npx jest
    }
}

Write-Host ""
Write-Host "✅ Tests completed!" -ForegroundColor Green

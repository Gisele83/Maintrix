#!/bin/bash

set -e

echo "🧪 Maintrix Integration Test Suite"
echo "=================================="
echo ""

export NODE_ENV=test
export API_URL=http://localhost:5000

if [ "$1" == "coverage" ]; then
  echo "📊 Running tests with coverage..."
  npx jest --coverage
elif [ "$1" == "watch" ]; then
  echo "👁️ Running tests in watch mode..."
  npx jest --watch
elif [ "$1" == "gmao" ]; then
  echo "🔧 Running GMAO module tests..."
  npx jest tests/gmao.test.ts
elif [ "$1" == "diagnostic" ]; then
  echo "🤖 Running Diagnostic module tests..."
  npx jest tests/diagnostic.test.ts
elif [ "$1" == "tenant" ]; then
  echo "🏢 Running Multi-tenant tests..."
  npx jest tests/multi-tenant.test.ts
elif [ "$1" == "integration" ]; then
  echo "🔗 Running inter-module communication tests..."
  npx jest tests/inter-module-communication.test.ts
else
  echo "🚀 Running all integration tests..."
  npx jest
fi

echo ""
echo "✅ Tests completed!"

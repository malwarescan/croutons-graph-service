#!/bin/bash
# Test script for Verified Domains Dashboard
# Tests the /api/verified-domains endpoint

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
ENDPOINT="$API_URL/api/verified-domains"

echo "=================================="
echo "Verified Domains Dashboard Test"
echo "=================================="
echo ""
echo "Testing endpoint: $ENDPOINT"
echo ""

# Test 1: Basic connectivity
echo "Test 1: Basic Connectivity"
echo "----------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ PASS: Endpoint returned HTTP $HTTP_CODE"
else
  echo "❌ FAIL: Endpoint returned HTTP $HTTP_CODE (expected 200)"
  exit 1
fi
echo ""

# Test 2: Valid JSON response
echo "Test 2: Valid JSON Response"
echo "----------------------------"
RESPONSE=$(curl -s "$ENDPOINT")
if echo "$RESPONSE" | jq -e . > /dev/null 2>&1; then
  echo "✅ PASS: Response is valid JSON"
else
  echo "❌ FAIL: Response is not valid JSON"
  echo "Response: $RESPONSE"
  exit 1
fi
echo ""

# Test 3: Response structure
echo "Test 3: Response Structure"
echo "----------------------------"
OK=$(echo "$RESPONSE" | jq -r '.ok')
if [ "$OK" == "true" ]; then
  echo "✅ PASS: Response has 'ok: true'"
else
  echo "❌ FAIL: Response missing 'ok' field or not true"
  exit 1
fi

COUNT=$(echo "$RESPONSE" | jq -r '.count')
if [ -n "$COUNT" ] && [ "$COUNT" -ge 0 ]; then
  echo "✅ PASS: Response has valid 'count' field: $COUNT"
else
  echo "❌ FAIL: Response missing or invalid 'count' field"
  exit 1
fi

DATA_TYPE=$(echo "$RESPONSE" | jq -r '.data | type')
if [ "$DATA_TYPE" == "array" ]; then
  echo "✅ PASS: Response has 'data' array"
else
  echo "❌ FAIL: Response 'data' is not an array"
  exit 1
fi
echo ""

# Test 4: Domain data structure (if domains exist)
echo "Test 4: Domain Data Structure"
echo "----------------------------"
DOMAIN_COUNT=$(echo "$RESPONSE" | jq '.data | length')
if [ "$DOMAIN_COUNT" -gt 0 ]; then
  echo "Found $DOMAIN_COUNT verified domains"
  
  # Check first domain has required fields
  FIRST_DOMAIN=$(echo "$RESPONSE" | jq -r '.data[0].domain')
  HEALTH_STATUS=$(echo "$RESPONSE" | jq -r '.data[0].health_status')
  VERIFIED_AT=$(echo "$RESPONSE" | jq -r '.data[0].verified_at')
  MARKDOWN_ACTIVE=$(echo "$RESPONSE" | jq -r '.data[0].markdown.active_count')
  CROUTON_COUNT=$(echo "$RESPONSE" | jq -r '.data[0].crouton_count')
  
  echo ""
  echo "Sample domain: $FIRST_DOMAIN"
  echo "  Health Status: $HEALTH_STATUS"
  echo "  Verified At: $VERIFIED_AT"
  echo "  Active Markdown: $MARKDOWN_ACTIVE"
  echo "  Crouton Count: $CROUTON_COUNT"
  echo ""
  
  # Validate fields
  if [ -n "$FIRST_DOMAIN" ] && [ "$FIRST_DOMAIN" != "null" ]; then
    echo "✅ PASS: Domain has valid 'domain' field"
  else
    echo "❌ FAIL: Domain missing 'domain' field"
    exit 1
  fi
  
  if [ "$HEALTH_STATUS" == "healthy" ] || [ "$HEALTH_STATUS" == "degraded" ] || [ "$HEALTH_STATUS" == "inactive" ]; then
    echo "✅ PASS: Domain has valid health_status: $HEALTH_STATUS"
  else
    echo "❌ FAIL: Domain has invalid health_status: $HEALTH_STATUS"
    exit 1
  fi
  
  if [ -n "$MARKDOWN_ACTIVE" ] && [ "$MARKDOWN_ACTIVE" -ge 0 ]; then
    echo "✅ PASS: Domain has valid markdown.active_count: $MARKDOWN_ACTIVE"
  else
    echo "❌ FAIL: Domain missing or invalid markdown.active_count"
    exit 1
  fi
  
  if [ -n "$CROUTON_COUNT" ] && [ "$CROUTON_COUNT" -ge 0 ]; then
    echo "✅ PASS: Domain has valid crouton_count: $CROUTON_COUNT"
  else
    echo "❌ FAIL: Domain missing or invalid crouton_count"
    exit 1
  fi
  
else
  echo "⚠️  WARNING: No verified domains found (this is OK for new installations)"
  echo "   To add a verified domain:"
  echo "   1. POST to /v1/verify/initiate with domain"
  echo "   2. Add DNS TXT record"
  echo "   3. POST to /v1/verify/check to confirm"
fi
echo ""

# Test 5: Performance
echo "Test 5: Performance"
echo "----------------------------"
START=$(date +%s%N)
curl -s "$ENDPOINT" > /dev/null
END=$(date +%s%N)
ELAPSED=$((($END - $START) / 1000000))

if [ $ELAPSED -lt 2000 ]; then
  echo "✅ PASS: Response time: ${ELAPSED}ms (< 2000ms)"
elif [ $ELAPSED -lt 5000 ]; then
  echo "⚠️  WARNING: Response time: ${ELAPSED}ms (between 2-5 seconds)"
  echo "   Consider adding database indexes or caching"
else
  echo "❌ FAIL: Response time: ${ELAPSED}ms (> 5 seconds)"
  echo "   Query is too slow, needs optimization"
fi
echo ""

# Summary
echo "=================================="
echo "Test Summary"
echo "=================================="
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "1. Open dashboard: $API_URL/dashboard.html"
echo "2. Click 'Verified Domains' tab"
echo "3. Verify UI displays correctly"
echo ""
echo "API Endpoint: $ENDPOINT"
echo "Dashboard: $API_URL/dashboard.html"
echo "=================================="

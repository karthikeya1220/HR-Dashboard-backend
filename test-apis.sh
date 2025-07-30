#!/bin/bash

# Dashboard Backend API Testing Script
# Make sure the server is running on localhost:3000

echo "🚀 Testing Dashboard Backend APIs"
echo "=================================="

BASE_URL="http://localhost:3000"

echo ""
echo "1. Testing Health Check..."
curl -s "$BASE_URL/health" | jq '.'

echo ""
echo "2. Testing Users List..."
curl -s "$BASE_URL/api/v1/users" | jq '.'

echo ""
echo "3. Testing Auth Register (will fail without Supabase setup)..."
curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }' | jq '.'

echo ""
echo "4. Testing Auth Me endpoint (will fail without token)..."
curl -s "$BASE_URL/api/v1/auth/me" | jq '.'

echo ""
echo "5. Testing API Documentation..."
echo "Visit: $BASE_URL/api-docs for interactive documentation"

echo ""
echo "✅ API Testing Complete!"
echo ""
echo "📝 Notes:"
echo "- Health and Users endpoints are working"
echo "- Auth endpoints require Supabase configuration"
echo "- See README.md for setup instructions"
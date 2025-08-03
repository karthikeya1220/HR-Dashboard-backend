#!/bin/bash

# Employee Management API Test Script
# This script tests the employee management endpoints

BASE_URL="http://localhost:3000/api/v1"
ADMIN_TOKEN="your-admin-jwt-token-here"

echo "🚀 Testing Employee Management API"
echo "=================================="

# Test 1: Create Supabase User Account
echo "📝 Test 1: Creating Supabase user account..."
curl -X POST "$BASE_URL/add-emp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "test.employee@company.com",
    "password": "TempPass123!",
    "name": "Test Employee",
    "role": "EMPLOYEE"
  }' | jq '.'

echo -e "\n"

# Test 2: Create Employee Profile
echo "👤 Test 2: Creating employee profile..."
curl -X POST "$BASE_URL/employees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "supabaseId": "replace-with-actual-supabase-id",
    "firstName": "Test",
    "lastName": "Employee",
    "dateOfBirth": "15/06/1990",
    "gender": "MALE",
    "maritalStatus": "SINGLE",
    "contactNumber": "+1234567890",
    "email": "test.employee@company.com",
    "jobTitle": "Software Engineer",
    "department": "ENGINEERING",
    "employmentType": "FULL_TIME",
    "hireDate": "01/03/2024",
    "workLocation": "Remote",
    "skills": ["JavaScript", "React", "Node.js"]
  }' | jq '.'

echo -e "\n"

# Test 3: Get All Employees
echo "📋 Test 3: Getting all employees..."
curl -X GET "$BASE_URL/employees?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

echo -e "\n"

# Test 4: Get Employee Statistics
echo "📊 Test 4: Getting employee statistics..."
curl -X GET "$BASE_URL/employees/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'

echo -e "\n"

# Test 5: Health Check
echo "🏥 Test 5: Health check..."
curl -X GET "http://localhost:3000/health" | jq '.'

echo -e "\n✅ API tests completed!"
echo "📖 View full API documentation at: http://localhost:3000/api-docs"
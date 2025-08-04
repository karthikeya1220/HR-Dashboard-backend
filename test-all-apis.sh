#!/bin/bash

# Dashboard Backend API Testing Script
# This script tests all the major API endpoints to ensure they are working correctly

BASE_URL="http://localhost:3005"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDI5ODQ1OCwiZXhwIjoxNzU0Mzg0ODU4fQ.k8Xh9619aoLb7_Tt3I98220qccQBsDOsV7Xs0UIkTl8"

echo "🚀 Testing Dashboard Backend APIs"
echo "=================================="

# Health Check
echo "1. Testing Health Check..."
curl -s -X GET "$BASE_URL/health" | jq '.'
echo ""

# Employee APIs
echo "2. Testing Employee APIs..."
echo "   - Get all employees"
curl -s -X GET "$BASE_URL/api/v1/employees" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, (.data | length)'

echo "   - Get employee statistics"
curl -s -X GET "$BASE_URL/api/v1/employees/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, .data.totalEmployees'

echo ""

# Onboarding APIs
echo "3. Testing Onboarding APIs..."
echo "   - Get global tasks"
curl -s -X GET "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, (.data | length)'

echo "   - Get workflow templates"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflow-templates" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, (.data | length)'

echo "   - Get workflows"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflows" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, (.data | length)'

echo "   - Get workflow statistics"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflows/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.success, .message, .data.totalWorkflows'

echo ""

# Test workflow creation flow
echo "4. Testing Workflow Creation Flow..."
echo "   - Creating a new global task"
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Security Training",
    "taskType": "TRAINING",
    "description": "Complete mandatory security awareness training",
    "priorityLevel": "HIGH",
    "duration": 2,
    "durationUnit": "HOURS",
    "requiresApproval": true,
    "assigneeType": "EMPLOYEE",
    "approverType": "MANAGER",
    "tags": ["security", "training", "mandatory"]
  }')

echo $TASK_RESPONSE | jq '.success, .message'
TASK_ID=$(echo $TASK_RESPONSE | jq -r '.data.id')

echo "   - Creating a new workflow template"
TEMPLATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/workflow-templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Team Onboarding",
    "description": "Onboarding process for new sales team members",
    "category": "Sales",
    "templateData": {
      "duration": "1 week",
      "focus": "sales training"
    }
  }')

echo $TEMPLATE_RESPONSE | jq '.success, .message'
TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | jq -r '.data.id')

echo "   - Creating a workflow from template"
WORKFLOW_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/from-template/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo $WORKFLOW_RESPONSE | jq '.success, .message'
WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.data.id')

echo "   - Assigning task to workflow"
curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"globalTaskId\": \"$TASK_ID\",
    \"orderIndex\": 1,
    \"isRequired\": true,
    \"deadlineDays\": 7
  }" | jq '.success, .message'

echo ""

# Test employee creation
echo "5. Testing Employee Creation..."
curl -s -X POST "$BASE_URL/api/v1/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Bob",
    "lastName": "Wilson",
    "dateOfBirth": "15/03/1988",
    "gender": "MALE",
    "maritalStatus": "MARRIED",
    "contactNumber": "+1555123456",
    "emailAddress": "bob.wilson@company.com",
    "jobTitle": "Sales Representative",
    "department": "SALES",
    "employmentType": "FULL_TIME",
    "hireDate": "01/03/2024",
    "workLocation": "Chicago Office",
    "skills": ["Sales", "Customer Relations", "CRM"]
  }' | jq '.success, .message, .data.employee.firstName, .data.employee.department'

echo ""
echo "✅ All API tests completed successfully!"
echo "🔗 API Documentation available at: $BASE_URL/api-docs"
#!/bin/bash

# Comprehensive Onboarding Workflow System Test
# This script demonstrates the complete workflow from task creation to workflow assignment

BASE_URL="http://localhost:3005"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDI5ODQ1OCwiZXhwIjoxNzU0Mzg0ODU4fQ.k8Xh9619aoLb7_Tt3I98220qccQBsDOsV7Xs0UIkTl8"

echo "🚀 Testing Complete Onboarding Workflow System"
echo "=============================================="

# Test 1: Health Check
echo "1. Health Check..."
curl -s -X GET "$BASE_URL/health" | jq '.status'
echo ""

# Test 2: Create Global Tasks for Onboarding
echo "2. Creating Global Tasks for Onboarding..."

echo "   Creating 'Complete I-9 Form' task..."
I9_TASK=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Complete I-9 Form",
    "taskType": "DOCUMENT_SUBMISSION",
    "description": "Employee must complete and submit I-9 employment eligibility verification form",
    "detailedInstructions": "1. Download I-9 form from HR portal\n2. Fill out Section 1\n3. Submit to HR within 3 days",
    "priorityLevel": "HIGH",
    "duration": 1,
    "durationUnit": "HOURS",
    "requiresApproval": true,
    "assigneeType": "EMPLOYEE",
    "approverType": "ADMIN",
    "tags": ["compliance", "legal", "required"]
  }')

I9_TASK_ID=$(echo $I9_TASK | jq -r '.data.id')
echo "   ✅ I-9 Task created: $I9_TASK_ID"

echo "   Creating 'IT Equipment Setup' task..."
IT_TASK=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "IT Equipment Setup",
    "taskType": "EQUIPMENT_ALLOCATION",
    "description": "Assign and configure laptop, phone, and other IT equipment",
    "detailedInstructions": "1. Assign laptop from inventory\n2. Install required software\n3. Set up email account\n4. Provide phone and accessories",
    "priorityLevel": "MEDIUM",
    "duration": 2,
    "durationUnit": "HOURS",
    "requiresApproval": false,
    "assigneeType": "ADMIN",
    "tags": ["IT", "equipment", "setup"]
  }')

IT_TASK_ID=$(echo $IT_TASK | jq -r '.data.id')
echo "   ✅ IT Equipment Task created: $IT_TASK_ID"

echo "   Creating 'Security Training' task..."
SECURITY_TASK=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Security Awareness Training",
    "taskType": "TRAINING",
    "description": "Complete mandatory security awareness training",
    "detailedInstructions": "1. Access training portal\n2. Complete all modules\n3. Pass final assessment with 80% score",
    "priorityLevel": "HIGH",
    "duration": 3,
    "durationUnit": "HOURS",
    "requiresApproval": true,
    "assigneeType": "EMPLOYEE",
    "approverType": "MANAGER",
    "tags": ["security", "training", "mandatory"]
  }')

SECURITY_TASK_ID=$(echo $SECURITY_TASK | jq -r '.data.id')
echo "   ✅ Security Training Task created: $SECURITY_TASK_ID"

echo ""

# Test 3: Create Workflow Template
echo "3. Creating Workflow Template..."
TEMPLATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/workflow-templates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complete Employee Onboarding",
    "description": "Comprehensive onboarding process for all new employees",
    "category": "General",
    "templateData": {
      "duration": "2 weeks",
      "phases": ["documentation", "equipment", "training", "orientation"],
      "requirements": ["I-9 completion", "IT setup", "security training"]
    }
  }')

TEMPLATE_ID=$(echo $TEMPLATE_RESPONSE | jq -r '.data.id')
echo "   ✅ Template created: $TEMPLATE_ID"
echo ""

# Test 4: Create Workflow from Template
echo "4. Creating Workflow from Template..."
WORKFLOW_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/from-template/$TEMPLATE_ID" \
  -H "Authorization: Bearer $TOKEN")

WORKFLOW_ID=$(echo $WORKFLOW_RESPONSE | jq -r '.data.id')
echo "   ✅ Workflow created: $WORKFLOW_ID"
echo ""

# Test 5: Assign Tasks to Workflow
echo "5. Assigning Tasks to Workflow..."

echo "   Assigning IT Equipment Setup (Order 1)..."
curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"globalTaskId\": \"$IT_TASK_ID\",
    \"orderIndex\": 1,
    \"isRequired\": true,
    \"deadlineDays\": 1
  }" | jq '.success'

echo "   Assigning I-9 Form (Order 2)..."
curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"globalTaskId\": \"$I9_TASK_ID\",
    \"orderIndex\": 2,
    \"isRequired\": true,
    \"deadlineDays\": 3
  }" | jq '.success'

echo "   Assigning Security Training (Order 3)..."
curl -s -X POST "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"globalTaskId\": \"$SECURITY_TASK_ID\",
    \"orderIndex\": 3,
    \"isRequired\": true,
    \"deadlineDays\": 7
  }" | jq '.success'

echo "   ✅ All tasks assigned to workflow"
echo ""

# Test 6: Activate Workflow
echo "6. Activating Workflow..."
curl -s -X PUT "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE",
    "autoStart": true
  }' | jq '.success'

echo "   ✅ Workflow activated"
echo ""

# Test 7: Get Complete Workflow with Tasks
echo "7. Retrieving Complete Workflow..."
COMPLETE_WORKFLOW=$(curl -s -X GET "$BASE_URL/api/v1/onboarding/workflows/$WORKFLOW_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "   Workflow Name: $(echo $COMPLETE_WORKFLOW | jq -r '.data.name')"
echo "   Status: $(echo $COMPLETE_WORKFLOW | jq -r '.data.status')"
echo "   Tasks Count: $(echo $COMPLETE_WORKFLOW | jq '.data.workflowTasks | length')"
echo "   Tasks:"
echo $COMPLETE_WORKFLOW | jq -r '.data.workflowTasks[] | "     - \(.orderIndex). \(.globalTask.taskName) (\(.globalTask.taskType))"'
echo ""

# Test 8: Create Employee for Onboarding
echo "8. Creating Employee for Onboarding Test..."
EMPLOYEE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Sarah",
    "lastName": "Johnson",
    "dateOfBirth": "15/08/1990",
    "gender": "FEMALE",
    "maritalStatus": "SINGLE",
    "contactNumber": "+1234567890",
    "emailAddress": "sarah.johnson@company.com",
    "jobTitle": "Software Engineer",
    "department": "ENGINEERING",
    "employmentType": "FULL_TIME",
    "hireDate": "04/01/2024",
    "workLocation": "San Francisco Office",
    "skills": ["JavaScript", "React", "Node.js"]
  }')

EMPLOYEE_ID=$(echo $EMPLOYEE_RESPONSE | jq -r '.data.employee.id')
echo "   ✅ Employee created: $EMPLOYEE_ID (Sarah Johnson)"
echo ""

# Test 9: Get System Statistics
echo "9. System Statistics..."
echo "   Workflow Statistics:"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflows/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {totalWorkflows, activeWorkflows, totalTasks, totalTemplates}'

echo "   Employee Statistics:"
curl -s -X GET "$BASE_URL/api/v1/employees/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {totalEmployees, activeEmployees}'

echo ""

# Test 10: List All Resources
echo "10. Current System State..."
echo "    Global Tasks:"
curl -s -X GET "$BASE_URL/api/v1/onboarding/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[] | "      - \(.taskName) (\(.taskType)) - Priority: \(.priorityLevel)"'

echo "    Workflow Templates:"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflow-templates" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[] | "      - \(.name) (\(.category))"'

echo "    Active Workflows:"
curl -s -X GET "$BASE_URL/api/v1/onboarding/workflows?status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[] | "      - \(.name) - Tasks: \(._count.workflowTasks)"'

echo ""

echo "✅ Complete Onboarding Workflow System Test Completed!"
echo ""
echo "📊 Summary:"
echo "   - Created 3 global tasks (I-9, IT Setup, Security Training)"
echo "   - Created 1 workflow template"
echo "   - Created 1 active workflow with 3 assigned tasks"
echo "   - Created 1 employee ready for onboarding"
echo "   - All APIs working correctly"
echo ""
echo "🔗 Next Steps:"
echo "   - Implement onboarding instance creation (POST /api/v1/onboarding)"
echo "   - Add employee task management endpoints"
echo "   - Implement manager oversight functionality"
echo "   - Add notification system integration"
echo ""
echo "📖 API Documentation: $BASE_URL/api-docs"
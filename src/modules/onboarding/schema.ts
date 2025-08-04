import { z } from 'zod';

// Enums for validation
export const TaskTypeEnum = z.enum([
  'DOCUMENT_SUBMISSION',
  'TRAINING',
  'ORIENTATION',
  'EQUIPMENT_ALLOCATION',
  'SYSTEM_ACCESS',
  'MEETING',
  'REVIEW',
  'OTHER',
]);

export const AssigneeTypeEnum = z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']);

export const PriorityLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const DurationUnitEnum = z.enum(['HOURS', 'DAYS', 'WEEKS']);

export const WorkflowStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);

export const TaskInstanceStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'SKIPPED',
  'CANCELLED',
]);

export const WorkflowInstanceStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD',
]);

export const ConditionTypeEnum = z.enum([
  'EMPLOYEE_TYPE',
  'DEPARTMENT',
  'ROLE',
  'LOCATION',
  'HIRE_DATE',
  'CUSTOM',
]);

export const ConditionOperatorEnum = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'LESS_THAN',
  'CONTAINS',
]);

// Resource schema for tasks
const resourceSchema = z.object({
  name: z.string().min(1, 'Resource name is required'),
  type: z.enum(['LINK', 'DOCUMENT', 'TOOL', 'CONTACT']),
  url: z.string().url().optional(),
  description: z.string().optional(),
});

// Conditional logic schema
const conditionalLogicSchema = z.object({
  conditionType: ConditionTypeEnum,
  conditionOperator: ConditionOperatorEnum,
  conditionValue: z.union([z.string(), z.array(z.string())]),
  description: z.string().optional(),
});

// Global Task Schemas
export const createGlobalTaskSchema = z.object({
  taskName: z.string().min(1, 'Task name is required').max(255),
  taskType: TaskTypeEnum,
  description: z.string().max(500).optional(),
  detailedInstructions: z.string().optional(),
  priorityLevel: PriorityLevelEnum.default('MEDIUM'),
  duration: z.number().int().positive().optional(),
  durationUnit: DurationUnitEnum.optional(),
  requiresApproval: z.boolean().default(false),
  assigneeType: AssigneeTypeEnum,
  approverType: AssigneeTypeEnum.optional(),
  isConditional: z.boolean().default(false),
  conditionalLogic: z.array(conditionalLogicSchema).optional(),
  resources: z.array(resourceSchema).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateGlobalTaskSchema = z.object({
  taskName: z.string().min(1, 'Task name is required').max(255).optional(),
  taskType: TaskTypeEnum.optional(),
  description: z.string().max(500).optional(),
  detailedInstructions: z.string().optional(),
  priorityLevel: PriorityLevelEnum.optional(),
  duration: z.number().int().positive().optional(),
  durationUnit: DurationUnitEnum.optional(),
  requiresApproval: z.boolean().optional(),
  assigneeType: AssigneeTypeEnum.optional(),
  approverType: AssigneeTypeEnum.optional(),
  isConditional: z.boolean().optional(),
  conditionalLogic: z.array(conditionalLogicSchema).optional(),
  resources: z.array(resourceSchema).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const getGlobalTaskByIdSchema = z.object({
  taskId: z.string().uuid('Invalid task ID format'),
});

export const getGlobalTasksQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  search: z.string().optional(),
  taskType: TaskTypeEnum.optional(),
  assigneeType: AssigneeTypeEnum.optional(),
  priorityLevel: PriorityLevelEnum.optional(),
  tags: z.string().optional(), // Comma-separated tags
  isActive: z.string().transform((val) => val === 'true').optional(),
});

// Workflow Template Schemas
export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isDefault: z.boolean().default(false),
  templateData: z.record(z.unknown()).optional(), // JSON object
});

export const updateWorkflowTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
  templateData: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const getWorkflowTemplateByIdSchema = z.object({
  templateId: z.string().uuid('Invalid template ID format'),
});

// Workflow Schemas
export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(255),
  description: z.string().max(500).optional(),
  templateId: z.string().uuid().optional(),
  autoStart: z.boolean().default(false),
  estimatedDuration: z.number().int().positive().optional(),
  isConditional: z.boolean().default(false),
  conditionalLogic: z.array(conditionalLogicSchema).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(255).optional(),
  description: z.string().max(500).optional(),
  status: WorkflowStatusEnum.optional(),
  autoStart: z.boolean().optional(),
  estimatedDuration: z.number().int().positive().optional(),
  isConditional: z.boolean().optional(),
  conditionalLogic: z.array(conditionalLogicSchema).optional(),
  isActive: z.boolean().optional(),
});

export const getWorkflowByIdSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
});

export const getWorkflowsQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  search: z.string().optional(),
  status: WorkflowStatusEnum.optional(),
  templateId: z.string().uuid().optional(),
  isActive: z.string().transform((val) => val === 'true').optional(),
});

// Workflow Task Assignment Schemas
export const assignTaskToWorkflowSchema = z.object({
  globalTaskId: z.string().uuid('Invalid task ID format'),
  orderIndex: z.number().int().min(0),
  isRequired: z.boolean().default(true),
  deadlineDays: z.number().int().positive().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  customInstructions: z.string().optional(),
  customDuration: z.number().int().positive().optional(),
  customDurationUnit: DurationUnitEnum.optional(),
  customAssigneeType: AssigneeTypeEnum.optional(),
  customApproverType: AssigneeTypeEnum.optional(),
});

export const updateWorkflowTaskSchema = z.object({
  orderIndex: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  deadlineDays: z.number().int().positive().optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  customInstructions: z.string().optional(),
  customDuration: z.number().int().positive().optional(),
  customDurationUnit: DurationUnitEnum.optional(),
  customAssigneeType: AssigneeTypeEnum.optional(),
  customApproverType: AssigneeTypeEnum.optional(),
});

export const updateTaskOrderSchema = z.object({
  newOrderIndex: z.number().int().min(0),
});

export const addTaskDependencySchema = z.object({
  dependencyTaskId: z.string().uuid('Invalid task ID format'),
});

export const getWorkflowTaskByIdSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  taskId: z.string().uuid('Invalid task ID format'),
});

// Workflow Instance Schemas
export const createWorkflowInstanceSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  employeeId: z.string().uuid('Invalid employee ID format'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateWorkflowInstanceSchema = z.object({
  status: WorkflowInstanceStatusEnum.optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const getWorkflowInstanceByIdSchema = z.object({
  instanceId: z.string().uuid('Invalid instance ID format'),
});

export const getWorkflowInstancesQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  employeeId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  status: WorkflowInstanceStatusEnum.optional(),
  assignedBy: z.string().uuid().optional(),
});

// Type exports
export type CreateGlobalTaskInput = z.infer<typeof createGlobalTaskSchema>;
export type UpdateGlobalTaskInput = z.infer<typeof updateGlobalTaskSchema>;
export type GetGlobalTaskByIdInput = z.infer<typeof getGlobalTaskByIdSchema>;
export type GetGlobalTasksQueryInput = z.infer<typeof getGlobalTasksQuerySchema>;

export type CreateWorkflowTemplateInput = z.infer<typeof createWorkflowTemplateSchema>;
export type UpdateWorkflowTemplateInput = z.infer<typeof updateWorkflowTemplateSchema>;
export type GetWorkflowTemplateByIdInput = z.infer<typeof getWorkflowTemplateByIdSchema>;

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type GetWorkflowByIdInput = z.infer<typeof getWorkflowByIdSchema>;
export type GetWorkflowsQueryInput = z.infer<typeof getWorkflowsQuerySchema>;

export type AssignTaskToWorkflowInput = z.infer<typeof assignTaskToWorkflowSchema>;
export type UpdateWorkflowTaskInput = z.infer<typeof updateWorkflowTaskSchema>;
export type UpdateTaskOrderInput = z.infer<typeof updateTaskOrderSchema>;
export type AddTaskDependencyInput = z.infer<typeof addTaskDependencySchema>;
export type GetWorkflowTaskByIdInput = z.infer<typeof getWorkflowTaskByIdSchema>;

export type CreateWorkflowInstanceInput = z.infer<typeof createWorkflowInstanceSchema>;
export type UpdateWorkflowInstanceInput = z.infer<typeof updateWorkflowInstanceSchema>;
export type GetWorkflowInstanceByIdInput = z.infer<typeof getWorkflowInstanceByIdSchema>;
export type GetWorkflowInstancesQueryInput = z.infer<typeof getWorkflowInstancesQuerySchema>;

export type ResourceType = z.infer<typeof resourceSchema>;
export type ConditionalLogicType = z.infer<typeof conditionalLogicSchema>;
// Onboarding Instance Management Schemas
export const createOnboardingInstanceSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID format'),
  workflow_id: z.string().uuid('Invalid workflow ID format'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  priority_level: PriorityLevelEnum.default('MEDIUM'),
  onboarding_manager_id: z.string().uuid('Invalid manager ID format').optional(),
  additional_notes: z.string().max(1000).optional(),
});

export const updateOnboardingInstanceSchema = z.object({
  status: WorkflowInstanceStatusEnum.optional(),
  priority_level: PriorityLevelEnum.optional(),
  onboarding_manager_id: z.string().uuid('Invalid manager ID format').optional(),
  additional_notes: z.string().max(1000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

export const assignManagerSchema = z.object({
  manager_id: z.string().uuid('Invalid manager ID format'),
});

export const updateTaskStatusSchema = z.object({
  status: TaskInstanceStatusEnum,
  comments: z.string().max(1000).optional(),
  completion_notes: z.string().max(1000).optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.string(),
  })).optional(),
});

export const getOnboardingInstanceByIdSchema = z.object({
  onboarding_instance_id: z.string().uuid('Invalid instance ID format'),
});

export const getEmployeeOnboardingSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID format'),
});

export const getEmployeeTaskSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID format'),
  task_id: z.string().uuid('Invalid task ID format'),
});

export const getManagerTasksSchema = z.object({
  manager_id: z.string().uuid('Invalid manager ID format'),
});

export const getOnboardingInstancesQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  employee_id: z.string().uuid().optional(),
  workflow_id: z.string().uuid().optional(),
  status: WorkflowInstanceStatusEnum.optional(),
  priority_level: PriorityLevelEnum.optional(),
  assigned_by: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
});

// New type exports for onboarding instance management
export type CreateOnboardingInstanceInput = z.infer<typeof createOnboardingInstanceSchema>;
export type UpdateOnboardingInstanceInput = z.infer<typeof updateOnboardingInstanceSchema>;
export type AssignManagerInput = z.infer<typeof assignManagerSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type GetOnboardingInstanceByIdInput = z.infer<typeof getOnboardingInstanceByIdSchema>;
export type GetEmployeeOnboardingInput = z.infer<typeof getEmployeeOnboardingSchema>;
export type GetEmployeeTaskInput = z.infer<typeof getEmployeeTaskSchema>;
export type GetManagerTasksInput = z.infer<typeof getManagerTasksSchema>;
export type GetOnboardingInstancesQueryInput = z.infer<typeof getOnboardingInstancesQuerySchema>;

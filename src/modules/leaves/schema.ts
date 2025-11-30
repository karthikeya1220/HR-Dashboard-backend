import { z } from 'zod';
import { LeaveType, LeaveRequestStatus, LeaveApprovalLevel, LeaveCreditType } from '@prisma/client';

// Base validation helpers
const positiveNumber = z.number().min(0, 'Must be a positive number');
const requiredString = z.string().min(1, 'Field is required');
const emailFormat = z.string().email('Invalid email format');
const dateFormat = z.string().datetime('Invalid date format').or(z.date());

// Leave Type Enum Schema
export const leaveTypeSchema = z.nativeEnum(LeaveType);

// Leave Request Status Enum Schema
export const leaveRequestStatusSchema = z.nativeEnum(LeaveRequestStatus);

// Leave Approval Level Enum Schema
export const leaveApprovalLevelSchema = z.nativeEnum(LeaveApprovalLevel);

// Leave Credit Type Enum Schema
export const leaveCreditTypeSchema = z.nativeEnum(LeaveCreditType);

// Leave Policy Schemas
export const createLeavePolicySchema = z
  .object({
    code: z
      .string()
      .min(2, 'Policy code must be at least 2 characters')
      .max(10, 'Policy code must not exceed 10 characters')
      .regex(
        /^[A-Z0-9_]+$/,
        'Policy code must contain only uppercase letters, numbers, and underscores'
      ),
    name: requiredString.max(100, 'Policy name must not exceed 100 characters'),
    leaveType: leaveTypeSchema,
    description: z.string().max(500, 'Description must not exceed 500 characters').optional(),

    // Quota and Credits
    quota: positiveNumber.max(365, 'Quota cannot exceed 365 days').optional(),
    creditType: leaveCreditTypeSchema.default('YEARLY'),
    accrualRate: z
      .number()
      .min(0)
      .max(31, 'Accrual rate cannot exceed 31 days per month')
      .optional(),

    // Carry Forward Rules
    carryForward: z.boolean().default(false),
    maxCarryForward: positiveNumber.max(365, 'Carry forward cannot exceed 365 days').optional(),
    carryForwardExpiry: positiveNumber.max(365, 'Expiry cannot exceed 365 days').optional(),

    // Usage Rules
    encashable: z.boolean().default(false),
    encashLimitPerYear: positiveNumber.max(365, 'Encash limit cannot exceed 365 days').optional(),
    halfDayAllowed: z.boolean().default(true),
    allowNegative: z.boolean().default(false),
    maxNegativeAllowed: positiveNumber.max(30, 'Negative limit cannot exceed 30 days').optional(),

    // Approval Workflow
    approvalLevel: leaveApprovalLevelSchema.default('MANAGER'),
    autoApprovalEnabled: z.boolean().default(false),
    autoApprovalConditions: z
      .object({
        maxDays: positiveNumber.max(30).optional(),
        advanceNotice: positiveNumber.max(365).optional(),
        allowWeekends: z.boolean().optional(),
        allowHolidays: z.boolean().optional(),
        maxConsecutive: positiveNumber.max(30).optional(),
      })
      .optional(),

    // Notice and Documentation
    noticePeriodDays: positiveNumber.max(365, 'Notice period cannot exceed 365 days').default(0),
    documentationRequired: z.boolean().default(false),
    documentationRules: z
      .object({
        minimumDays: positiveNumber.optional(),
        medicalCertRequired: z.boolean().optional(),
        supportingDocuments: z.array(z.string()).optional(),
      })
      .optional(),

    // Applicability
    applicableLocations: z.array(z.string()).default([]),
    applicableDepartments: z.array(z.string()).default([]),
    applicableRoles: z.array(z.string()).default([]),

    // Special Rules
    usageWindowDays: positiveNumber.max(365, 'Usage window cannot exceed 365 days').optional(),
    expiryDays: positiveNumber.max(365, 'Expiry cannot exceed 365 days').optional(),
    salaryDeduction: z.boolean().default(false),

    // Metadata
    effectiveFrom: dateFormat.optional(),
    effectiveUntil: dateFormat.optional(),
    createdBy: requiredString.optional(),
  })
  .refine(
    (data) => {
      // Validate carry forward logic
      if (data.carryForward && !data.maxCarryForward) {
        return false;
      }
      return true;
    },
    {
      message: 'maxCarryForward is required when carryForward is enabled',
      path: ['maxCarryForward'],
    }
  )
  .refine(
    (data) => {
      // Validate negative balance logic
      if (data.allowNegative && !data.maxNegativeAllowed) {
        return false;
      }
      return true;
    },
    {
      message: 'maxNegativeAllowed is required when allowNegative is enabled',
      path: ['maxNegativeAllowed'],
    }
  )
  .refine(
    (data) => {
      // Validate encashment logic
      if (data.encashable && !data.encashLimitPerYear) {
        return false;
      }
      return true;
    },
    {
      message: 'encashLimitPerYear is required when encashable is enabled',
      path: ['encashLimitPerYear'],
    }
  )
  .refine(
    (data) => {
      // Validate effective dates
      if (data.effectiveFrom && data.effectiveUntil) {
        const from = new Date(data.effectiveFrom);
        const until = new Date(data.effectiveUntil);
        return from < until;
      }
      return true;
    },
    {
      message: 'effectiveUntil must be after effectiveFrom',
      path: ['effectiveUntil'],
    }
  );

export const updateLeavePolicySchema = z.object({
  id: requiredString,
  code: z
    .string()
    .min(2, 'Policy code must be at least 2 characters')
    .max(10, 'Policy code must not exceed 10 characters')
    .regex(
      /^[A-Z0-9_]+$/,
      'Policy code must contain only uppercase letters, numbers, and underscores'
    )
    .optional(),
  name: z.string().max(100, 'Policy name must not exceed 100 characters').optional(),
  leaveType: leaveTypeSchema.optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),

  // Quota and Credits
  quota: positiveNumber.max(365, 'Quota cannot exceed 365 days').optional(),
  creditType: leaveCreditTypeSchema.optional(),
  accrualRate: z.number().min(0).max(31, 'Accrual rate cannot exceed 31 days per month').optional(),

  // Carry Forward Rules
  carryForward: z.boolean().optional(),
  maxCarryForward: positiveNumber.max(365, 'Carry forward cannot exceed 365 days').optional(),
  carryForwardExpiry: positiveNumber.max(365, 'Expiry cannot exceed 365 days').optional(),

  // Usage Rules
  encashable: z.boolean().optional(),
  encashLimitPerYear: positiveNumber.max(365, 'Encash limit cannot exceed 365 days').optional(),
  halfDayAllowed: z.boolean().optional(),
  allowNegative: z.boolean().optional(),
  maxNegativeAllowed: positiveNumber.max(30, 'Negative limit cannot exceed 30 days').optional(),

  // Approval Workflow
  approvalLevel: leaveApprovalLevelSchema.optional(),
  autoApprovalEnabled: z.boolean().optional(),
  autoApprovalConditions: z
    .object({
      maxDays: positiveNumber.max(30).optional(),
      advanceNotice: positiveNumber.max(365).optional(),
      allowWeekends: z.boolean().optional(),
      allowHolidays: z.boolean().optional(),
      maxConsecutive: positiveNumber.max(30).optional(),
    })
    .optional(),

  // Notice and Documentation
  noticePeriodDays: positiveNumber.max(365, 'Notice period cannot exceed 365 days').optional(),
  documentationRequired: z.boolean().optional(),
  documentationRules: z
    .object({
      minimumDays: positiveNumber.optional(),
      medicalCertRequired: z.boolean().optional(),
      supportingDocuments: z.array(z.string()).optional(),
    })
    .optional(),

  // Applicability
  applicableLocations: z.array(z.string()).optional(),
  applicableDepartments: z.array(z.string()).optional(),
  applicableRoles: z.array(z.string()).optional(),

  // Special Rules
  usageWindowDays: positiveNumber.max(365, 'Usage window cannot exceed 365 days').optional(),
  expiryDays: positiveNumber.max(365, 'Expiry cannot exceed 365 days').optional(),
  salaryDeduction: z.boolean().optional(),

  // Metadata
  effectiveFrom: dateFormat.optional(),
  effectiveUntil: dateFormat.optional(),
  version: z.number().min(1).optional(),
});

// Leave Request Schemas
export const createLeaveRequestSchema = z
  .object({
    employeeId: requiredString,
    policyId: requiredString,
    leaveType: leaveTypeSchema,
    startDate: dateFormat,
    endDate: dateFormat,
    reason: requiredString
      .min(10, 'Reason must be at least 10 characters')
      .max(1000, 'Reason must not exceed 1000 characters'),
    isHalfDay: z.boolean().default(false),
    halfDaySession: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
    emergencyContact: z
      .object({
        name: requiredString,
        phone: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone format'),
        relationship: requiredString,
      })
      .optional(),
    workHandover: z.string().max(2000, 'Work handover must not exceed 2000 characters').optional(),
    attachments: z
      .array(
        z.object({
          filename: requiredString,
          url: z.string().url('Invalid URL format'),
          size: positiveNumber,
          mimeType: requiredString,
        })
      )
      .optional(),
    ipAddress: z.string().ip().optional(),
    userAgent: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate date logic
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      return startDate <= endDate;
    },
    {
      message: 'End date must be after or equal to start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      // Validate half day logic
      if (data.isHalfDay) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff === 0; // Half day must be for single day only
      }
      return true;
    },
    {
      message: 'Half day leave can only be applied for a single day',
      path: ['isHalfDay'],
    }
  )
  .refine(
    (data) => {
      // Validate half day session
      if (data.isHalfDay && !data.halfDaySession) {
        return false;
      }
      return true;
    },
    {
      message: 'Half day session is required for half day leaves',
      path: ['halfDaySession'],
    }
  );

export const updateLeaveRequestSchema = z.object({
  id: requiredString,
  reason: z.string().min(10).max(1000).optional(),
  workHandover: z.string().max(2000).optional(),
  attachments: z
    .array(
      z.object({
        filename: requiredString,
        url: z.string().url(),
        size: positiveNumber,
        mimeType: requiredString,
      })
    )
    .optional(),
  emergencyContact: z
    .object({
      name: requiredString,
      phone: z.string().regex(/^\+?[\d\s\-()]+$/),
      relationship: requiredString,
    })
    .optional(),
});

export const approveLeaveRequestSchema = z
  .object({
    id: requiredString,
    action: z.enum(['APPROVE', 'REJECT']),
    comments: z.string().max(1000, 'Comments must not exceed 1000 characters').optional(),
    approverRole: z.enum(['MANAGER', 'HR']),
    ipAddress: z.string().ip().optional(),
    userAgent: z.string().optional(),
  })
  .refine(
    (data) => {
      // Comments required for rejection
      if (data.action === 'REJECT' && !data.comments) {
        return false;
      }
      return true;
    },
    {
      message: 'Comments are required when rejecting a leave request',
      path: ['comments'],
    }
  );

export const cancelLeaveRequestSchema = z.object({
  id: requiredString,
  reason: requiredString
    .min(10, 'Cancellation reason must be at least 10 characters')
    .max(500, 'Reason must not exceed 500 characters'),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
});

// Leave Balance Schemas
export const createLeaveBalanceSchema = z.object({
  employeeId: requiredString,
  policyId: requiredString,
  fiscalYear: z.number().min(2020).max(2050, 'Invalid fiscal year'),
  totalEntitlement: z.number().min(0).max(365, 'Entitlement cannot exceed 365 days'),
  carriedForward: z.number().min(0).max(365, 'Carried forward cannot exceed 365 days').default(0),
  updatedBy: requiredString,
});

export const updateLeaveBalanceSchema = z
  .object({
    id: requiredString,
    totalEntitlement: z.number().min(0).max(365).optional(),
    carriedForward: z.number().min(0).max(365).optional(),
    usedLeaves: z.number().min(0).max(365).optional(),
    encashedThisYear: z.number().min(0).max(365).optional(),
    updatedBy: requiredString,
  })
  .refine(
    (data) => {
      // Ensure at least one field is being updated
      const fieldsToUpdate = [
        'totalEntitlement',
        'carriedForward',
        'usedLeaves',
        'encashedThisYear',
      ];
      return fieldsToUpdate.some((field) => data[field as keyof typeof data] !== undefined);
    },
    {
      message: 'At least one field must be updated',
    }
  );

// Leave Settings Schemas
export const createLeaveSettingsSchema = z
  .object({
    fiscalYearStart: z
      .string()
      .regex(/^\d{2}-\d{2}$/, 'Fiscal year start must be in DD-MM format')
      .default('01-04'),
    weekendDays: z
      .array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']))
      .min(1, 'At least one weekend day is required')
      .max(6, 'Maximum 6 weekend days allowed')
      .default(['SATURDAY', 'SUNDAY']),
    workingHoursPerDay: z.number().min(1).max(24, 'Working hours cannot exceed 24').default(8.0),
    halfDayHours: z.number().min(0.5).max(12, 'Half day hours cannot exceed 12').default(4.0),

    // Company Configuration
    companyLocations: z.array(z.string()).default([]),
    probationRestrictions: z.boolean().default(false),
    probationPeriodMonths: z
      .number()
      .min(1)
      .max(24, 'Probation period cannot exceed 24 months')
      .default(6),
    negativeLeaveAllowed: z.boolean().default(false),
    maxNegativeLeave: positiveNumber.max(30, 'Negative leave cannot exceed 30 days').default(0),

    // Approval and Workflow
    autoApprovalEnabled: z.boolean().default(false),
    autoApprovalRules: z
      .object({
        maxDays: positiveNumber.optional(),
        advanceNotice: positiveNumber.optional(),
        allowWeekends: z.boolean().optional(),
        allowHolidays: z.boolean().optional(),
        departments: z.array(z.string()).optional(),
        leaveTypes: z.array(leaveTypeSchema).optional(),
      })
      .optional(),
    escalationEnabled: z.boolean().default(false),
    escalationAfterDays: positiveNumber.max(30, 'Escalation cannot exceed 30 days').default(3),
    escalationRecipients: z.array(emailFormat).default([]),

    // Notification Settings
    emailNotifications: z.boolean().default(true),
    inAppNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false),
    reminderEnabled: z.boolean().default(true),
    reminderBeforeDays: positiveNumber.max(30, 'Reminder cannot exceed 30 days').default(7),
    notificationTemplates: z
      .object({
        leaveApplied: z.string().optional(),
        leaveApproved: z.string().optional(),
        leaveRejected: z.string().optional(),
        leaveCancelled: z.string().optional(),
        leaveReminder: z.string().optional(),
      })
      .optional(),

    // Holiday and Calendar
    holidayCalendarEnabled: z.boolean().default(true),
    nationalHolidays: z
      .array(
        z.object({
          date: dateFormat,
          name: requiredString,
          description: z.string().optional(),
        })
      )
      .optional(),
    regionalHolidays: z
      .object({
        location: requiredString,
        holidays: z.array(
          z.object({
            date: dateFormat,
            name: requiredString,
            description: z.string().optional(),
          })
        ),
      })
      .array()
      .optional(),
    optionalHolidays: z
      .array(
        z.object({
          date: dateFormat,
          name: requiredString,
          description: z.string().optional(),
          locations: z.array(z.string()).default([]),
        })
      )
      .optional(),

    // Attendance Integration
    attendanceIntegration: z.boolean().default(false),
    autoAbsentIfNoCheckIn: z.boolean().default(true),
    autoLWPIfNoLeave: z.boolean().default(true),
    gracePeriodHours: z.number().min(0).max(72, 'Grace period cannot exceed 72 hours').default(48),
    lateMarkRules: z
      .object({
        enabled: z.boolean().default(false),
        graceMinutes: z.number().min(0).max(60).default(15),
        deductionRules: z
          .array(
            z.object({
              minutesLate: z.number().min(1),
              deductionType: z.enum(['MINUTES', 'HOURS', 'HALF_DAY']),
              deductionValue: z.number().min(0),
            })
          )
          .optional(),
      })
      .optional(),

    // Compliance and Security
    require2FA: z.boolean().default(false),
    auditLogRetention: z
      .number()
      .min(365)
      .max(3650, 'Retention cannot exceed 10 years')
      .default(2555),
    sessionTimeout: z
      .number()
      .min(5)
      .max(480, 'Session timeout must be between 5 and 480 minutes')
      .default(30),
    maxBackdatedDays: positiveNumber.max(365, 'Backdated limit cannot exceed 365 days').default(7),

    // HR Override Permissions
    hrCanEditBalance: z.boolean().default(true),
    hrCanForceApprove: z.boolean().default(true),
    hrCanModifyCalendar: z.boolean().default(true),
    hrCanAdjustAttendance: z.boolean().default(true),
    hrCanAddSpecialLeaves: z.boolean().default(true),

    // Encashment Settings
    encashmentEnabled: z.boolean().default(false),
    encashmentPeriod: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY']).optional(),
    encashmentCalculation: z.enum(['BASIC_SALARY', 'GROSS_SALARY']).optional(),
    maxEncashmentPercent: z
      .number()
      .min(0)
      .max(100, 'Encashment percentage cannot exceed 100')
      .optional(),

    // Metadata
    lastUpdatedBy: requiredString,
    createdBy: requiredString,
  })
  .refine(
    (data) => {
      // Validate half day hours vs working hours
      return data.halfDayHours <= data.workingHoursPerDay;
    },
    {
      message: 'Half day hours cannot exceed working hours per day',
      path: ['halfDayHours'],
    }
  )
  .refine(
    (data) => {
      // Validate encashment settings
      if (
        data.encashmentEnabled &&
        (!data.encashmentPeriod || !data.encashmentCalculation || !data.maxEncashmentPercent)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'Encashment period, calculation method, and max percentage are required when encashment is enabled',
      path: ['encashmentEnabled'],
    }
  )
  .refine(
    (data) => {
      // Validate escalation settings
      if (data.escalationEnabled && data.escalationRecipients.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Escalation recipients are required when escalation is enabled',
      path: ['escalationRecipients'],
    }
  );

export const updateLeaveSettingsSchema = z.object({
  id: requiredString,
  fiscalYearStart: z
    .string()
    .regex(/^\d{2}-\d{2}$/, 'Fiscal year start must be in DD-MM format')
    .optional(),
  weekendDays: z
    .array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']))
    .min(1, 'At least one weekend day is required')
    .max(6, 'Maximum 6 weekend days allowed')
    .optional(),
  workingHoursPerDay: z.number().min(1).max(24, 'Working hours cannot exceed 24').optional(),
  halfDayHours: z.number().min(0.5).max(12, 'Half day hours cannot exceed 12').optional(),

  // Company Configuration
  companyLocations: z.array(z.string()).optional(),
  probationRestrictions: z.boolean().optional(),
  probationPeriodMonths: z
    .number()
    .min(1)
    .max(24, 'Probation period cannot exceed 24 months')
    .optional(),
  negativeLeaveAllowed: z.boolean().optional(),
  maxNegativeLeave: positiveNumber.max(30, 'Negative leave cannot exceed 30 days').optional(),

  // Approval and Workflow
  autoApprovalEnabled: z.boolean().optional(),
  autoApprovalRules: z
    .object({
      maxDays: positiveNumber.optional(),
      advanceNotice: positiveNumber.optional(),
      allowWeekends: z.boolean().optional(),
      allowHolidays: z.boolean().optional(),
      departments: z.array(z.string()).optional(),
      leaveTypes: z.array(leaveTypeSchema).optional(),
    })
    .optional(),
  escalationEnabled: z.boolean().optional(),
  escalationAfterDays: positiveNumber.max(30, 'Escalation cannot exceed 30 days').optional(),
  escalationRecipients: z.array(emailFormat).optional(),

  // Notification Settings
  emailNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderBeforeDays: positiveNumber.max(30, 'Reminder cannot exceed 30 days').optional(),
  notificationTemplates: z
    .object({
      leaveApplied: z.string().optional(),
      leaveApproved: z.string().optional(),
      leaveRejected: z.string().optional(),
      leaveCancelled: z.string().optional(),
      leaveReminder: z.string().optional(),
    })
    .optional(),

  // Holiday and Calendar
  holidayCalendarEnabled: z.boolean().optional(),
  nationalHolidays: z
    .array(
      z.object({
        date: dateFormat,
        name: requiredString,
        description: z.string().optional(),
      })
    )
    .optional(),
  regionalHolidays: z
    .object({
      location: requiredString,
      holidays: z.array(
        z.object({
          date: dateFormat,
          name: requiredString,
          description: z.string().optional(),
        })
      ),
    })
    .array()
    .optional(),
  optionalHolidays: z
    .array(
      z.object({
        date: dateFormat,
        name: requiredString,
        description: z.string().optional(),
        locations: z.array(z.string()).default([]),
      })
    )
    .optional(),

  // Attendance Integration
  attendanceIntegration: z.boolean().optional(),
  autoAbsentIfNoCheckIn: z.boolean().optional(),
  autoLWPIfNoLeave: z.boolean().optional(),
  gracePeriodHours: z.number().min(0).max(72, 'Grace period cannot exceed 72 hours').optional(),
  lateMarkRules: z
    .object({
      enabled: z.boolean().default(false),
      graceMinutes: z.number().min(0).max(60).default(15),
      deductionRules: z
        .array(
          z.object({
            minutesLate: z.number().min(1),
            deductionType: z.enum(['MINUTES', 'HOURS', 'HALF_DAY']),
            deductionValue: z.number().min(0),
          })
        )
        .optional(),
    })
    .optional(),

  // Compliance and Security
  require2FA: z.boolean().optional(),
  auditLogRetention: z.number().min(365).max(3650, 'Retention cannot exceed 10 years').optional(),
  sessionTimeout: z
    .number()
    .min(5)
    .max(480, 'Session timeout must be between 5 and 480 minutes')
    .optional(),
  maxBackdatedDays: positiveNumber.max(365, 'Backdated limit cannot exceed 365 days').optional(),

  // HR Override Permissions
  hrCanEditBalance: z.boolean().optional(),
  hrCanForceApprove: z.boolean().optional(),
  hrCanModifyCalendar: z.boolean().optional(),
  hrCanAdjustAttendance: z.boolean().optional(),
  hrCanAddSpecialLeaves: z.boolean().optional(),

  // Encashment Settings
  encashmentEnabled: z.boolean().optional(),
  encashmentPeriod: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY']).optional(),
  encashmentCalculation: z.enum(['BASIC_SALARY', 'GROSS_SALARY']).optional(),
  maxEncashmentPercent: z
    .number()
    .min(0)
    .max(100, 'Encashment percentage cannot exceed 100')
    .optional(),

  // Metadata
  lastUpdatedBy: requiredString,
});

// Holiday Schemas
export const createHolidaySchema = z
  .object({
    name: requiredString.max(100, 'Holiday name must not exceed 100 characters'),
    date: dateFormat,
    type: z.enum(['FIXED', 'OPTIONAL', 'REGIONAL']),
    description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
    applicableLocations: z.array(z.string()).default([]),
    isNationalHoliday: z.boolean().default(false),
    isOptional: z.boolean().default(false),
    fiscalYear: z.number().min(2020).max(2050),
    createdBy: requiredString,
  })
  .refine(
    (data) => {
      // Regional holidays must have locations
      if (data.type === 'REGIONAL' && data.applicableLocations.length === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Regional holidays must specify applicable locations',
      path: ['applicableLocations'],
    }
  );

export const updateHolidaySchema = z.object({
  id: requiredString,
  name: z.string().max(100, 'Holiday name must not exceed 100 characters').optional(),
  date: dateFormat.optional(),
  type: z.enum(['FIXED', 'OPTIONAL', 'REGIONAL']).optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  applicableLocations: z.array(z.string()).optional(),
  isNationalHoliday: z.boolean().optional(),
  isOptional: z.boolean().optional(),
  fiscalYear: z.number().min(2020).max(2050).optional(),
});

// Query Schemas
export const getLeaveRequestsQuerySchema = z.object({
  page: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().min(1).default(1)
  ),
  limit: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().min(1).max(100).default(20)
  ),
  employeeId: z.string().optional(),
  status: leaveRequestStatusSchema.optional(),
  leaveType: leaveTypeSchema.optional(),
  startDate: dateFormat.optional(),
  endDate: dateFormat.optional(),
  department: z.string().optional(),
  sortBy: z.enum(['appliedAt', 'startDate', 'endDate', 'status']).default('appliedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const getLeaveBalanceQuerySchema = z.object({
  employeeId: z.string().optional(),
  fiscalYear: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().min(2020).max(2050).optional()
  ),
  department: z.string().optional(),
  includeInactive: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true';
    }
    return val;
  }, z.boolean().default(false)),
});

export const getLeaveAnalyticsQuerySchema = z.object({
  fiscalYear: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().min(2020).max(2050)
  ),
  department: z.string().optional(),
  location: z.string().optional(),
  month: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z.number().min(1).max(12).optional()
  ),
  leaveType: leaveTypeSchema.optional(),
  granularity: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
});

// Response Type Definitions
export type CreateLeavePolicyInput = z.infer<typeof createLeavePolicySchema>;
export type UpdateLeavePolicyInput = z.infer<typeof updateLeavePolicySchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type ApproveLeaveRequestInput = z.infer<typeof approveLeaveRequestSchema>;
export type CancelLeaveRequestInput = z.infer<typeof cancelLeaveRequestSchema>;
export type CreateLeaveBalanceInput = z.infer<typeof createLeaveBalanceSchema>;
export type UpdateLeaveBalanceInput = z.infer<typeof updateLeaveBalanceSchema>;
export type CreateLeaveSettingsInput = z.infer<typeof createLeaveSettingsSchema>;
export type UpdateLeaveSettingsInput = z.infer<typeof updateLeaveSettingsSchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type GetLeaveRequestsQuery = z.infer<typeof getLeaveRequestsQuerySchema>;
export type GetLeaveBalanceQuery = z.infer<typeof getLeaveBalanceQuerySchema>;
export type GetLeaveAnalyticsQuery = z.infer<typeof getLeaveAnalyticsQuerySchema>;

// Schema for route validation without ID field
export const approveLeaveRequestBodySchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    comments: z.string().max(1000, 'Comments must not exceed 1000 characters').optional(),
    approverRole: z.enum(['MANAGER', 'HR']),
    ipAddress: z.string().ip().optional(),
    userAgent: z.string().optional(),
  })
  .refine(
    (data) => {
      // Comments required for rejection
      if (data.action === 'REJECT' && !data.comments) {
        return false;
      }
      return true;
    },
    {
      message: 'Comments are required when rejecting a leave request',
      path: ['comments'],
    }
  );

export const updateLeaveBalanceBodySchema = z
  .object({
    totalEntitlement: z.number().positive().optional(),
    carriedForward: z.number().min(0).optional(),
    usedLeaves: z.number().min(0).optional(),
    encashedThisYear: z.number().min(0).optional(),
    updatedBy: requiredString,
  })
  .refine(
    (data) => {
      // At least one field must be provided for update
      return (
        data.totalEntitlement !== undefined ||
        data.carriedForward !== undefined ||
        data.usedLeaves !== undefined ||
        data.encashedThisYear !== undefined
      );
    },
    {
      message: 'At least one field must be provided for update',
      path: ['root'],
    }
  );

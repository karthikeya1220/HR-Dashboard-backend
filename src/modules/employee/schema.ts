import { z } from 'zod';

// Enums for validation
export const GenderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
export const MaritalStatusEnum = z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']);
export const EmergencyContactRelationshipEnum = z.enum(['SPOUSE', 'PARENT', 'SIBLING', 'FRIEND', 'OTHER']);
export const DepartmentEnum = z.enum(['HR', 'ENGINEERING', 'SALES', 'UI', 'DEVELOPER', 'OTHER']);
export const EmploymentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT']);
export const RoleEnum = z.enum(['EMPLOYEE', 'MANAGER', 'ADMIN']);

// Date validation helper - accepts dd/mm/yyyy format
const dateStringSchema = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Date must be in dd/mm/yyyy format');

// Education history schema
const educationSchema = z.object({
  institution: z.string().min(1, 'Institution name is required'),
  degree: z.string().min(1, 'Degree is required'),
  fieldOfStudy: z.string().optional(),
  startYear: z.number().int().min(1900).max(new Date().getFullYear()),
  endYear: z.number().int().min(1900).max(new Date().getFullYear() + 10).optional(),
  grade: z.string().optional(),
});

// Certification schema
const certificationSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuingOrganization: z.string().min(1, 'Issuing organization is required'),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  credentialId: z.string().optional(),
});

// Work experience schema
const workExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  position: z.string().min(1, 'Position is required'),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

// Schema for creating Supabase user account only (Step 1)
export const createSupabaseUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: RoleEnum.default('EMPLOYEE'),
});

// Schema for complete employee profile creation (Two-step process)
export const createFullEmployeeSchema = z.object({
  // Personal Information (Required fields marked with *)
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: dateStringSchema,
  gender: GenderEnum,
  maritalStatus: MaritalStatusEnum,
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits'),
  emailAddress: z.string().email('Invalid email format'),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: EmergencyContactRelationshipEnum.optional(),
  emergencyContactPhone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  
  // Employment Information (Required fields marked with *)
  jobTitle: z.string().min(1, 'Job title is required'),
  department: DepartmentEnum,
  departmentOther: z.string().optional(),
  employmentType: EmploymentTypeEnum,
  hireDate: dateStringSchema,
  workLocation: z.string().min(1, 'Work location is required'),
  reportingManager: z.string().optional(),
  salaryGrade: z.string().optional(),
  
  // User account information
  role: RoleEnum.default('EMPLOYEE'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  
  // Additional Information (All optional)
  educationHistory: z.array(educationSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  skills: z.array(z.string()).optional(),
  previousWorkExperience: z.array(workExperienceSchema).optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  routingNumber: z.string().optional(),
}).refine((data) => {
  // If department is OTHER, departmentOther must be provided
  if (data.department === 'OTHER' && !data.departmentOther) {
    return false;
  }
  return true;
}, {
  message: 'Department other field is required when department is OTHER',
  path: ['departmentOther'],
}).refine((data) => {
  // If emergency contact name is provided, relationship should also be provided
  if (data.emergencyContactName && !data.emergencyContactRelationship) {
    return false;
  }
  return true;
}, {
  message: 'Emergency contact relationship is required when emergency contact name is provided',
  path: ['emergencyContactRelationship'],
});

// Schema for creating employee profile with existing Supabase ID
export const createEmployeeSchema = z.object({
  supabaseId: z.string().min(1, 'Supabase user ID is required'),
  
  // Personal Information (Required fields marked with *)
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: dateStringSchema,
  gender: GenderEnum,
  maritalStatus: MaritalStatusEnum,
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits'),
  email: z.string().email('Invalid email format'),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: EmergencyContactRelationshipEnum.optional(),
  emergencyContactPhone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  
  // Employment Information (Required fields marked with *)
  jobTitle: z.string().min(1, 'Job title is required'),
  department: DepartmentEnum,
  departmentOther: z.string().optional(),
  employmentType: EmploymentTypeEnum,
  hireDate: dateStringSchema,
  workLocation: z.string().min(1, 'Work location is required'),
  reportingManager: z.string().optional(),
  salaryGrade: z.string().optional(),
  
  // Additional Information (All optional)
  educationHistory: z.array(educationSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  skills: z.array(z.string()).optional(),
  previousWorkExperience: z.array(workExperienceSchema).optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  routingNumber: z.string().optional(),
}).refine((data) => {
  // If department is OTHER, departmentOther must be provided
  if (data.department === 'OTHER' && !data.departmentOther) {
    return false;
  }
  return true;
}, {
  message: 'Department other field is required when department is OTHER',
  path: ['departmentOther'],
}).refine((data) => {
  // If emergency contact name is provided, relationship should also be provided
  if (data.emergencyContactName && !data.emergencyContactRelationship) {
    return false;
  }
  return true;
}, {
  message: 'Emergency contact relationship is required when emergency contact name is provided',
  path: ['emergencyContactRelationship'],
});

// Schema for updating employee profile
export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  dateOfBirth: dateStringSchema.optional(),
  gender: GenderEnum.optional(),
  maritalStatus: MaritalStatusEnum.optional(),
  contactNumber: z.string().min(10, "Contact number must be at least 10 digits").optional(),
  email: z.string().email("Invalid email format").optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: EmergencyContactRelationshipEnum.optional(),
  emergencyContactPhone: z.string().optional(),
  currentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  jobTitle: z.string().min(1, "Job title is required").optional(),
  department: DepartmentEnum.optional(),
  departmentOther: z.string().optional(),
  employmentType: EmploymentTypeEnum.optional(),
  hireDate: dateStringSchema.optional(),
  workLocation: z.string().min(1, "Work location is required").optional(),
  reportingManager: z.string().optional(),
  salaryGrade: z.string().optional(),
  educationHistory: z.array(educationSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  skills: z.array(z.string()).optional(),
  previousWorkExperience: z.array(workExperienceSchema).optional(),
  bankAccountNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  routingNumber: z.string().optional(),
});

// Schema for getting employee by ID
export const getEmployeeByIdSchema = z.object({
  id: z.string().uuid('Invalid employee ID format'),
});

// Schema for employee query parameters
export const getEmployeesQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  search: z.string().optional(),
  department: DepartmentEnum.optional(),
  employmentType: EmploymentTypeEnum.optional(),
  isActive: z.string().transform((val) => val === 'true').optional(),
});

// Type exports
export type CreateSupabaseUserInput = z.infer<typeof createSupabaseUserSchema>;
export type CreateFullEmployeeInput = z.infer<typeof createFullEmployeeSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type GetEmployeeByIdInput = z.infer<typeof getEmployeeByIdSchema>;
export type GetEmployeesQueryInput = z.infer<typeof getEmployeesQuerySchema>;
export type EducationRecord = z.infer<typeof educationSchema>;
export type CertificationRecord = z.infer<typeof certificationSchema>;
export type WorkExperienceRecord = z.infer<typeof workExperienceSchema>;
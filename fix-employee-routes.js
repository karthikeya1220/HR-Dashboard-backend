import fs from 'fs';

// Read the current route file
const routeFile = 'src/modules/employee/route.ts';
let content = fs.readFileSync(routeFile, 'utf8');

// Fix the route definitions by adding missing commas
const routeFixes = [
  { pattern: /router\.post\(\s*'\/add-emp'\s*verifyToken\s*requireAdmin\s*validateRequest\({ body: createSupabaseUserSchema }\)\s*EmployeeController\.createSupabaseUser\s*\);/g, 
    replacement: `router.post(
  '/add-emp',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createSupabaseUserSchema }),
  EmployeeController.createSupabaseUser
);` },
  
  { pattern: /router\.post\(\s*'\/employees'\s*verifyToken\s*requireAdmin\s*validateRequest\({ body: createEmployeeSchema }\)\s*EmployeeController\.createEmployee\s*\);/g,
    replacement: `router.post(
  '/employees',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createEmployeeSchema }),
  EmployeeController.createEmployee
);` },
  
  { pattern: /router\.get\(\s*'\/employees'\s*verifyToken\s*validateRequest\({ query: getEmployeesQuerySchema }\)\s*EmployeeController\.getEmployees\s*\);/g,
    replacement: `router.get(
  '/employees',
  verifyToken,
  validateRequest({ query: getEmployeesQuerySchema }),
  EmployeeController.getEmployees
);` },
  
  { pattern: /router\.get\(\s*'\/employees\/stats'\s*verifyToken\s*requireAdmin\s*EmployeeController\.getEmployeeStats\s*\);/g,
    replacement: `router.get(
  '/employees/stats',
  verifyToken,
  requireAdmin,
  EmployeeController.getEmployeeStats
);` },
  
  { pattern: /router\.get\(\s*'\/employees\/:id'\s*verifyToken\s*validateRequest\({ params: getEmployeeByIdSchema }\)\s*EmployeeController\.getEmployeeById\s*\);/g,
    replacement: `router.get(
  '/employees/:id',
  verifyToken,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.getEmployeeById
);` },
  
  { pattern: /router\.patch\(\s*'\/employees\/:id'\s*verifyToken\s*requireAdmin\s*validateRequest\({\s*params: getEmployeeByIdSchema\s*body: updateEmployeeSchema\s*}\)\s*EmployeeController\.updateEmployee\s*\);/g,
    replacement: `router.patch(
  '/employees/:id',
  verifyToken,
  requireAdmin,
  validateRequest({ 
    params: getEmployeeByIdSchema,
    body: updateEmployeeSchema 
  }),
  EmployeeController.updateEmployee
);` },
  
  { pattern: /router\.delete\(\s*'\/employees\/:id'\s*verifyToken\s*requireAdmin\s*validateRequest\({ params: getEmployeeByIdSchema }\)\s*EmployeeController\.deleteEmployee\s*\);/g,
    replacement: `router.delete(
  '/employees/:id',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.deleteEmployee
);` }
];

// Apply fixes
routeFixes.forEach(fix => {
  content = content.replace(fix.pattern, fix.replacement);
});

// Write back the fixed content
fs.writeFileSync(routeFile, content);
console.log('Fixed employee routes!');
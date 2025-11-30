import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTestData() {
  try {
    console.log('🚀 Setting up test data for leave management...');
    
    // Your Supabase User ID (replace with actual ID)
    const YOUR_USER_ID = '53367ec0-2b2e-49a4-a9b6-1469f6b9ebfd';
    
    // 1. Create/Update Employee record for your user
    const employee = await prisma.employee.upsert({
      where: { supabaseId: YOUR_USER_ID },
      update: {
        firstName: 'Test',
        lastName: 'Admin',
        email: 'praneethdevarasetty31@gmail.com',
        jobTitle: 'Full Stack Developer',
        department: 'ENGINEERING'
      },
      create: {
        supabaseId: YOUR_USER_ID,
        firstName: 'Test',
        middleName: null,
        lastName: 'Admin',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'MALE',
        maritalStatus: 'SINGLE',
        contactNumber: '+1234567890',
        email: 'praneethdevarasetty31@gmail.com',
        jobTitle: 'Full Stack Developer',
        department: 'ENGINEERING',
        employmentType: 'FULL_TIME',
        hireDate: new Date('2024-01-01'),
        workLocation: 'Remote'
      }
    });
    
    console.log('✅ Employee created/updated:', employee.id);

    // 2. Create Leave Policies
    const policies = await Promise.all([
      // Casual Leave Policy
      prisma.leavePolicy.upsert({
        where: { code: 'CL_2024' },
        update: {},
        create: {
          code: 'CL_2024',
          name: 'Casual Leave 2024',
          leaveType: 'CASUAL',
          quota: 25,
          description: 'Casual leave policy',
          isActive: true,
          carryForward: true,
          maxCarryForward: 5,
          encashable: false,
          noticePeriodDays: 7,
          createdBy: YOUR_USER_ID
        }
      }),
      
      // Sick Leave Policy  
      prisma.leavePolicy.upsert({
        where: { code: 'SL_2024' },
        update: {},
        create: {
          code: 'SL_2024',
          name: 'Sick Leave 2024',
          leaveType: 'SICK',
          quota: 12,
          description: 'Medical leave policy',
          isActive: true,
          carryForward: false,
          maxCarryForward: 0,
          encashable: false,
          noticePeriodDays: 0,
          createdBy: YOUR_USER_ID
        }
      }),
      
      // Earned Leave Policy
      prisma.leavePolicy.upsert({
        where: { code: 'EL_2024' },
        update: {},
        create: {
          code: 'EL_2024',
          name: 'Earned Leave 2024', 
          leaveType: 'EARNED',
          quota: 10,
          description: 'Earned leave policy',
          isActive: true,
          carryForward: false,
          maxCarryForward: 0,
          encashable: true,
          noticePeriodDays: 3,
          createdBy: YOUR_USER_ID
        }
      })
    ]);
    
    console.log('✅ Policies created:', policies.map(p => p.code));

    // 3. Create Leave Balances for the employee
    const balances = await Promise.all(
      policies.map(policy => 
        prisma.leaveBalance.upsert({
          where: {
            employeeId_policyId_fiscalYear: {
              employeeId: employee.id,
              policyId: policy.id,
              fiscalYear: 2024
            }
          },
          update: {},
          create: {
            employeeId: employee.id,
            policyId: policy.id,
            fiscalYear: 2024,
            totalEntitlement: policy.quota || 0,
            usedLeaves: 0,
            pendingLeaves: 0,
            availableBalance: policy.quota || 0
          }
        })
      )
    );
    
    console.log('✅ Balances created:', balances.length);

    // 4. Create a test manager employee
    const manager = await prisma.employee.upsert({
      where: { email: 'manager@test.com' },
      update: {},
      create: {
        supabaseId: 'manager-test-id',
        firstName: 'Test',
        lastName: 'Manager',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'MALE',
        maritalStatus: 'MARRIED',
        contactNumber: '+1234567891',
        email: 'manager@test.com',
        jobTitle: 'Engineering Manager',
        department: 'ENGINEERING',
        employmentType: 'FULL_TIME',
        hireDate: new Date('2023-01-01'),
        workLocation: 'Office'
      }
    });
    
    console.log('✅ Manager created:', manager.id);

    console.log('\n🎉 Test data setup complete!');
    console.log('\nTEST CREDENTIALS:');
    console.log(`Employee ID: ${employee.id}`);
    console.log(`Policy IDs: ${policies.map(p => p.id).join(', ')}`);
    console.log(`Manager ID: ${manager.id}`);
    
    return {
      employee,
      policies,
      balances,
      manager
    };
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
setupTestData();

export { setupTestData };
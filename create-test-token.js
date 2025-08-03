// Simple script to create a test JWT token for API testing
import jwt from 'jsonwebtoken';

const adminUser = {
  id: 'cf9fe180-c529-4759-9098-58a8aba738a4',
  email: 'admin@example.com',
  role: 'ADMIN',
  name: 'Admin User'
};

const secret = 'Ze71FJBfEiZsl1dGENnYqBTd2Q0aJkO9kYSwx1HqfEJ/91qHNmYL2Bj3y7vSApUXi6+O5ZJ2QPXE2mW7xBPzrA==';

const token = jwt.sign(adminUser, secret, { expiresIn: '24h' });

console.log('Admin User Details:');
console.log('Email:', adminUser.email);
console.log('Role:', adminUser.role);
console.log('');
console.log('JWT Token for testing:');
console.log(token);
console.log('');
console.log('Use this token in Swagger UI by clicking "Authorize" and entering:');
console.log('Bearer ' + token);
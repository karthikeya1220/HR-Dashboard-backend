import { config } from 'dotenv';
config({ path: '.env' });
const originalLog = console.log;
const originalError = console.error;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});
afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map

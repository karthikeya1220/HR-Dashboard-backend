// Global test setup
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env' });

// Mock console to reduce noise in tests
// eslint-disable-next-line no-console
const originalLog = console.log;
// eslint-disable-next-line no-console
const originalError = console.error;

beforeAll(() => {
  // eslint-disable-next-line no-console
  console.log = jest.fn();
  // eslint-disable-next-line no-console
  console.error = jest.fn();
});

afterAll(() => {
  // eslint-disable-next-line no-console
  console.log = originalLog;
  // eslint-disable-next-line no-console
  console.error = originalError;
});

// Global test timeout
jest.setTimeout(30000);

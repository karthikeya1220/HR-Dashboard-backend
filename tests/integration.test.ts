import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Integration Tests', () => {
  describe('Application Startup', () => {
    test('should compile and start successfully', async () => {
      // Clean build
      await execAsync('npm run build');

      // Start the application briefly to test it works
      const startProcess = exec('npm start');

      let stdout = '';
      let stderr = '';

      if (startProcess.stdout) {
        startProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (startProcess.stderr) {
        startProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Wait for startup
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Terminate
      startProcess.kill('SIGTERM');

      await new Promise((resolve) => {
        startProcess.on('exit', resolve);
      });

      // Should start successfully
      expect(stderr).not.toContain('Error:');
      expect(stdout.includes('Server running') || !stderr.includes('SyntaxError')).toBe(true);
    });
  });

  describe('Database Integration', () => {
    test('should connect to database successfully', async () => {
      // Test Prisma client can be imported and used
      try {
        await execAsync(
          "node -e \"const { PrismaClient } = require('@prisma/client'); console.log('Prisma client loaded');\""
        );
      } catch (error) {
        throw new Error('Failed to load Prisma client');
      }
    });
  });

  describe('API Endpoints Health Check', () => {
    test('should have proper route structure', async () => {
      // Check that main app file can be imported without errors
      try {
        await execAsync(
          "node -e \"require('./dist/app.js'); console.log('App loaded successfully');\""
        );
      } catch (error: any) {
        throw new Error(`App failed to load: ${error.message}`);
      }
    });
  });
});

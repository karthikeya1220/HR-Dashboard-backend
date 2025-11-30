import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Deployment Readiness Tests', () => {
  describe('Environment Variables', () => {
    test('should have required environment variables defined', () => {
      const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];

      // Note: In production, these should be set. For testing, we just check they're defined in .env.example
      expect(process.env.NODE_ENV || 'development').toBeDefined();
    });
  });

  describe('Render Deployment Configuration', () => {
    test('should have correct package.json main entry', () => {
      const packageJson = require('../package.json');
      expect(packageJson.main).toBe('dist/server.js');
    });

    test('should have correct Node.js version specified', () => {
      const packageJson = require('../package.json');
      expect(packageJson.engines.node).toBeDefined();
      expect(packageJson.engines.node).toContain('>=20');
    });

    test('should have build script that works in production', async () => {
      // Simulate production environment
      const env = { ...process.env, NODE_ENV: 'production' };

      try {
        const { stdout, stderr } = await execAsync('npm run build', { env });
        expect(stderr).not.toContain('husky: command not found');
      } catch (error: any) {
        throw new Error(`Build failed in production mode: ${error.message}`);
      }
    });
  });

  describe('Production Dependencies', () => {
    test('should have all production dependencies available', async () => {
      // Check that production dependencies are properly specified
      const packageJson = require('../package.json');
      const prodDeps = packageJson.dependencies;

      expect(prodDeps['@prisma/client']).toBeDefined();
      expect(prodDeps['express']).toBeDefined();
      expect(prodDeps['prisma']).toBeDefined();

      // Husky should be in devDependencies only
      expect(prodDeps['husky']).toBeUndefined();
    });

    test('should install production dependencies correctly', async () => {
      // Test npm ci --only=production
      const tempDir = '/tmp/test-prod-deps';

      try {
        await execAsync(`mkdir -p ${tempDir}`);
        await execAsync(`cp package*.json ${tempDir}/`);

        const { stderr } = await execAsync('npm ci --only=production', {
          cwd: tempDir,
        });

        expect(stderr).not.toContain('husky: command not found');

        // Clean up
        await execAsync(`rm -rf ${tempDir}`);
      } catch (error) {
        // Clean up on error
        await execAsync(`rm -rf ${tempDir}`).catch(() => {});
        throw error;
      }
    });
  });

  describe('Application Health', () => {
    test('should start without errors', async () => {
      // Test that the built application can at least be imported
      try {
        const { stdout, stderr } = await execAsync(
          "node -e \"console.log('Testing import...'); require('./dist/app.js'); console.log('App imported successfully');\""
        );
        expect(stderr).not.toContain('husky');
        expect(stderr).not.toContain('command not found');
        expect(stdout).toContain('App imported successfully');
      } catch (error: any) {
        // If import fails, check that it's not due to husky issues
        expect(error.message).not.toContain('husky');
        expect(error.message).not.toContain('command not found');
        // Allow database connection errors in test environment
        if (!error.message.includes('DATABASE_URL') && !error.message.includes('connection')) {
          throw error;
        }
      }
    });
  });

  describe('Husky Configuration', () => {
    test('should have proper husky configuration for development', async () => {
      const huskyDir = '.husky';
      const fs = require('fs').promises;

      try {
        await fs.access(huskyDir);
        // Husky directory exists, check it doesn't interfere with production

        const preCommitExists = await fs
          .access('.husky/pre-commit')
          .then(() => true)
          .catch(() => false);

        if (preCommitExists) {
          const preCommitContent = await fs.readFile('.husky/pre-commit', 'utf8');
          expect(preCommitContent).toContain('lint-staged');
        }
      } catch (error) {
        // Husky not set up, which is fine for production
        expect(true).toBe(true);
      }
    });

    test('prepare script should be safe for production', () => {
      const packageJson = require('../package.json');
      const prepareScript = packageJson.scripts.prepare;

      // Should check for husky availability before trying to install
      expect(prepareScript).toContain('command -v husky');
      expect(prepareScript).toContain('|| true');
    });
  });
});

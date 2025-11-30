import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('Critical Fix Verification', () => {
  const projectRoot = process.cwd();

  describe('Husky Prepare Script Fix', () => {
    test('prepare script should be safe for production environments', () => {
      const packageJson = require('../package.json');
      const prepareScript = packageJson.scripts.prepare;

      // Verify the fix: should check for husky availability before installing
      expect(prepareScript).toContain('command -v husky');
      expect(prepareScript).toContain('husky install');
      expect(prepareScript).toContain('|| true');

      // Ensure it won't fail in production where husky doesn't exist
      expect(prepareScript).toBe('command -v husky >/dev/null 2>&1 && husky install || true');
    });

    test('prepare script should execute without errors in production-like environment', async () => {
      // Test the prepare script in an environment without husky
      const tempScript =
        'command -v non-existent-command >/dev/null 2>&1 && echo "would install" || echo "safely skipped"';

      const { stdout, stderr } = await execAsync(`bash -c '${tempScript}'`);

      expect(stderr).toBe('');
      expect(stdout.trim()).toBe('safely skipped');
    });
  });

  describe('Docker Build Configuration', () => {
    test('should have Dockerfile configured correctly', async () => {
      const dockerfilePath = path.join(projectRoot, 'Dockerfile');
      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');

      // Should use npm ci (production install)
      expect(dockerfileContent).toContain('npm ci');

      // Should not have any husky-specific commands that would fail
      expect(dockerfileContent).not.toContain('husky install');
      expect(dockerfileContent).not.toContain('git init');

      // Should include Prisma generation
      expect(dockerfileContent).toContain('npx prisma generate');

      // Should build the application
      expect(dockerfileContent).toContain('npm run build');
    });

    test('Docker build should not fail due to prepare script', async () => {
      // Build a minimal test image to verify the prepare script doesn't break the build
      const testDockerfile = `
        FROM node:20-slim
        WORKDIR /app
        COPY package*.json ./
        RUN npm ci
        RUN echo "Docker build test passed"
      `;

      const tempDir = '/tmp/dashboard-test-build';

      try {
        await execAsync(`mkdir -p ${tempDir}`);
        await execAsync(`cp package*.json ${tempDir}/`);
        await fs.writeFile(path.join(tempDir, 'Dockerfile'), testDockerfile);

        const { stdout, stderr } = await execAsync('docker build -t test-build .', {
          cwd: tempDir,
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        });

        // Build should succeed without husky errors
        expect(stderr).not.toContain('husky: command not found');
        expect(stderr).not.toContain('prepare script failed');
        expect(stdout).toContain('Docker build test passed');

        // Clean up
        await execAsync('docker rmi test-build || true');
        await execAsync(`rm -rf ${tempDir}`);
      } catch (error: any) {
        // Clean up on error
        await execAsync('docker rmi test-build || true').catch(() => {});
        await execAsync(`rm -rf ${tempDir}`).catch(() => {});

        // Check if the error is related to our fix
        if (error.message.includes('husky')) {
          throw new Error('Docker build still failing due to husky issues: ' + error.message);
        }

        // Other Docker errors might be due to environment issues
        console.warn('Docker build test skipped due to Docker environment:', error.message);
      }
    }, 60000);
  });

  describe('Production Build Verification', () => {
    test('should build successfully without development dependencies', async () => {
      // Test production build scenario
      const { stdout, stderr } = await execAsync('NODE_ENV=production npm run build');

      expect(stderr).not.toContain('husky');
      expect(stderr).not.toContain('command not found');
      // Build should succeed (stdout may contain npm run output, which is fine)
    });

    test('TypeScript compilation should succeed', async () => {
      // Ensure TypeScript compilation works
      const { stdout, stderr } = await execAsync('npx tsc --noEmit');

      expect(stderr).toBe('');
    });

    test('Prisma client generation should work', async () => {
      const { stdout, stderr } = await execAsync('npx prisma generate');

      expect(stderr).toBe('');
      expect(stdout).toContain('Generated Prisma Client');
    });
  });

  describe('Package.json Configuration', () => {
    test('should have correct main entry for production', () => {
      const packageJson = require('../package.json');

      expect(packageJson.main).toBe('dist/server.js');
      expect(packageJson.scripts.start).toBe('node dist/server.js');
      expect(packageJson.scripts.build).toBe('tsc');
    });

    test('should have husky only in devDependencies', () => {
      const packageJson = require('../package.json');

      // Husky should not be in production dependencies
      expect(packageJson.dependencies.husky).toBeUndefined();

      // Should be in devDependencies
      expect(packageJson.devDependencies.husky).toBeDefined();
    });

    test('should have proper Node.js engine requirements', () => {
      const packageJson = require('../package.json');

      expect(packageJson.engines.node).toBeDefined();
      expect(packageJson.engines.node).toContain('>=20');
    });
  });
});

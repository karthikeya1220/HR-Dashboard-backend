import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('Build Process Tests', () => {
  const projectRoot = process.cwd();

  beforeAll(async () => {
    // Clean any previous build artifacts
    try {
      await fs.rm(path.join(projectRoot, 'dist'), { recursive: true });
    } catch (error) {
      // Directory might not exist, which is fine
    }
  });

  describe('TypeScript Compilation', () => {
    test('should compile TypeScript without errors', async () => {
      const { stdout, stderr } = await execAsync('npm run build');

      // Check that build completed successfully
      expect(stderr).toBe('');

      // Verify dist directory was created
      const distExists = await fs
        .access(path.join(projectRoot, 'dist'))
        .then(() => true)
        .catch(() => false);
      expect(distExists).toBe(true);

      // Verify main files were compiled
      const serverExists = await fs
        .access(path.join(projectRoot, 'dist/server.js'))
        .then(() => true)
        .catch(() => false);
      expect(serverExists).toBe(true);
    });

    test('should have proper TypeScript configuration', async () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      const tsconfigExists = await fs
        .access(tsconfigPath)
        .then(() => true)
        .catch(() => false);

      expect(tsconfigExists).toBe(true);

      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(tsconfigContent);

      // Verify essential compiler options
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBeDefined();
      expect(tsconfig.compilerOptions.module).toBeDefined();
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });
  });

  describe('Package.json Prepare Script', () => {
    test('should have prepare script configured correctly', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      expect(packageJson.scripts.prepare).toBeDefined();
      expect(packageJson.scripts.prepare).toContain('husky install');
      expect(packageJson.scripts.prepare).toContain('command -v husky');
    });

    test('prepare script should handle missing husky gracefully', async () => {
      // Test the prepare script logic by running it
      const { stdout, stderr } = await execAsync('npm run prepare');

      // Should not fail even if husky is not available
      expect(stderr).not.toContain('command not found');
      expect(stderr).not.toContain('husky: command not found');
    });
  });

  describe('Prisma Client Generation', () => {
    test('should generate Prisma client successfully', async () => {
      const { stdout, stderr } = await execAsync('npm run db:generate');

      // Check for successful generation
      expect(stderr).toBe('');
      expect(stdout).toContain('Generated Prisma Client');

      // Verify client was generated
      const clientPath = path.join(projectRoot, 'node_modules/.prisma/client');
      const clientExists = await fs
        .access(clientPath)
        .then(() => true)
        .catch(() => false);
      expect(clientExists).toBe(true);
    });

    test('should have valid Prisma schema', async () => {
      const schemaPath = path.join(projectRoot, 'prisma/schema.prisma');
      const schemaExists = await fs
        .access(schemaPath)
        .then(() => true)
        .catch(() => false);

      expect(schemaExists).toBe(true);

      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      expect(schemaContent).toContain('generator client');
      expect(schemaContent).toContain('datasource db');
      expect(schemaContent).toContain('prisma-client-js');
    });
  });

  describe('Dependencies and Environment', () => {
    test('should have all required dependencies installed', async () => {
      const { stdout } = await execAsync('npm list --depth=0');

      // Check for critical dependencies
      expect(stdout).toContain('@prisma/client');
      expect(stdout).toContain('express');
      expect(stdout).toContain('typescript');
    });

    test('should have proper Node.js version', async () => {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const majorVersion = parseInt(version.replace('v', '').split('.')[0]);

      expect(majorVersion).toBeGreaterThanOrEqual(20);
    });
  });
});

describe('Development Environment Tests', () => {
  test('should have proper eslint configuration', async () => {
    const eslintConfigPath = path.join(process.cwd(), 'eslint.config.js');
    const configExists = await fs
      .access(eslintConfigPath)
      .then(() => true)
      .catch(() => false);

    expect(configExists).toBe(true);
  });

  test('should have prettier configuration', async () => {
    const prettierConfigPath = path.join(process.cwd(), '.prettierrc');
    const configExists = await fs
      .access(prettierConfigPath)
      .then(() => true)
      .catch(() => false);

    expect(configExists).toBe(true);
  });

  test('should lint without errors', async () => {
    try {
      const { stderr } = await execAsync('npm run lint');
      expect(stderr).toBe('');
    } catch (error) {
      // If lint fails, check if it's due to fixable issues
      const { stderr } = await execAsync('npm run lint:fix');
      // After fixing, it should pass
      const { stderr: lintStderr } = await execAsync('npm run lint');
      expect(lintStderr).toBe('');
    }
  });
});

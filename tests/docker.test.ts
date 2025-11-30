import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

describe('Docker Build Tests', () => {
  const projectRoot = process.cwd();
  const imageName = 'dashboard-backend-test';

  // Increase timeout for Docker operations
  const dockerTimeout = 180000; // 3 minutes

  beforeAll(async () => {
    // Clean up any existing test images
    try {
      await execAsync(`docker rmi ${imageName} || true`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Clean up test image
    try {
      await execAsync(`docker rmi ${imageName} || true`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Docker Configuration', () => {
    test('should have valid Dockerfile', async () => {
      const dockerfilePath = path.join(projectRoot, 'Dockerfile');
      const dockerfileExists = await fs
        .access(dockerfilePath)
        .then(() => true)
        .catch(() => false);

      expect(dockerfileExists).toBe(true);

      const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
      expect(dockerfileContent).toContain('FROM node:');
      expect(dockerfileContent).toContain('WORKDIR /app');
      expect(dockerfileContent).toContain('npm ci');
      expect(dockerfileContent).toContain('npx prisma generate');
    });

    test('should have .dockerignore file', async () => {
      const dockerignorePath = path.join(projectRoot, '.dockerignore');
      const dockerignoreExists = await fs
        .access(dockerignorePath)
        .then(() => true)
        .catch(() => false);

      expect(dockerignoreExists).toBe(true);

      const dockerignoreContent = await fs.readFile(dockerignorePath, 'utf8');
      expect(dockerignoreContent).toContain('node_modules');
      expect(dockerignoreContent).toContain('.git');
    });
  });

  describe('Docker Build Process', () => {
    test(
      'should build Docker image successfully',
      async () => {
        const buildCommand = `docker build -t ${imageName} .`;

        const { stdout, stderr } = await execAsync(buildCommand, {
          cwd: projectRoot,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // Check that build completed without critical errors
        expect(stderr).not.toContain('husky: command not found');
        expect(stderr).not.toContain('prepare script failed');
        expect(stdout).toContain('Successfully tagged');

        // Verify image was created
        const { stdout: imagesOutput } = await execAsync(`docker images ${imageName}`);
        expect(imagesOutput).toContain(imageName);
      },
      dockerTimeout
    );

    test(
      'should handle husky prepare script correctly in Docker',
      async () => {
        // Build with verbose output to check prepare script behavior
        const buildProcess = spawn('docker', ['build', '-t', `${imageName}-verbose`, '.'], {
          cwd: projectRoot,
          stdio: 'pipe',
        });

        let stdout = '';
        let stderr = '';

        buildProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        buildProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        await new Promise((resolve, reject) => {
          buildProcess.on('close', (code) => {
            if (code === 0) {
              resolve(code);
            } else {
              reject(new Error(`Build failed with code ${code}`));
            }
          });
        });

        // The prepare script should run without errors
        expect(stderr).not.toContain('husky: command not found');
        expect(stderr).not.toContain('prepare: command failed');

        // Clean up verbose image
        try {
          await execAsync(`docker rmi ${imageName}-verbose || true`);
        } catch (error) {
          // Ignore cleanup errors
        }
      },
      dockerTimeout
    );
  });

  describe('Docker Image Validation', () => {
    test('should have correct working directory', async () => {
      const { stdout } = await execAsync(`docker run --rm ${imageName} pwd`);
      expect(stdout.trim()).toBe('/app');
    });

    test('should have Node.js available', async () => {
      const { stdout } = await execAsync(`docker run --rm ${imageName} node --version`);
      expect(stdout).toMatch(/^v\d+\.\d+\.\d+/);
    });

    test('should have built application files', async () => {
      const { stdout } = await execAsync(`docker run --rm ${imageName} ls -la dist/`);
      expect(stdout).toContain('server.js');
    });

    test('should have Prisma client generated', async () => {
      const { stdout } = await execAsync(
        `docker run --rm ${imageName} ls -la node_modules/.prisma/`
      );
      expect(stdout).toContain('client');
    });
  });

  describe('Production Environment Simulation', () => {
    test('should run without development dependencies', async () => {
      // Check that the image can run the application
      const runProcess = spawn(
        'docker',
        [
          'run',
          '--rm',
          '-p',
          '3005:3005',
          '-e',
          'NODE_ENV=production',
          imageName,
          'node',
          'dist/server.js',
        ],
        {
          stdio: 'pipe',
        }
      );

      let stdout = '';
      let stderr = '';

      runProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Let it run for a few seconds then kill
      setTimeout(() => {
        runProcess.kill('SIGTERM');
      }, 5000);

      await new Promise((resolve) => {
        runProcess.on('close', () => {
          resolve(true);
        });
      });

      // Should start without errors
      expect(stderr).not.toContain('husky');
      expect(stderr).not.toContain('command not found');
      expect(stdout.includes('Server running') || !stderr.includes('Error:')).toBe(true);
    }, 15000);
  });
});

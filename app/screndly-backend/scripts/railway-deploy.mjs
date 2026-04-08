import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const railwayCliPath = path.resolve('node_modules', '@railway', 'cli', 'bin', 'railway.js');

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.on('error', (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const attachLogs = args.includes('--attach');
  const railwayArgs = args.filter((arg) => arg !== '--skip-build' && arg !== '--attach');

  if (!skipBuild) {
    console.log('[railway:deploy] Building backend before deploy...');
    await run('npm', ['run', 'build'], 'Backend build');
  }

  console.log('[railway:deploy] Checking Railway link status...');
  try {
    await run('node', [railwayCliPath, 'status'], 'Railway status');
  } catch (error) {
    console.error('[railway:deploy] Railway is not ready in this workspace.');
    console.error('Run `npm run railway:login` and `npm run railway:link` in app/screndly-backend first, then retry.');
    throw error;
  }

  console.log('[railway:deploy] Deploying backend to Railway...');
  const finalRailwayArgs = ['up', '.', '--path-as-root'];

  if (!attachLogs) {
    finalRailwayArgs.push('--detach');
  }

  finalRailwayArgs.push(...railwayArgs);

  await run('node', [railwayCliPath, ...finalRailwayArgs], 'Railway deploy');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[36m%s\x1b[0m', '[START] Iniciando SplitLedger: Laravel (8000) + React/TS (5173) + Split-Reasoner AI Engine (8100)...');

// Start Split-Reasoner Python AI Engine
const aiEngine = spawn('uv', ['run', 'uvicorn', 'app.main:app', '--port=8100', '--reload'], {
  cwd: path.join(rootDir, 'ai_engine'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Start Laravel backend
const backend = spawn('php', ['artisan', 'serve', '--port=8000'], {
  cwd: path.join(rootDir, 'backend'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Start Vite frontend
const client = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', '[STOP] Deteniendo procesos de SplitLedger...');
  aiEngine.kill('SIGINT');
  backend.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

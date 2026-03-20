/**
 * Cross-platform backend starter. Spawns uvicorn from backend/venv.
 * Used by root "npm start" so both backend and frontend run in one terminal.
 */
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const isWin = process.platform === 'win32';
const uvicornPath = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'uvicorn.exe')
  : path.join(backendDir, 'venv', 'bin', 'uvicorn');

const fs = require('fs');
if (!fs.existsSync(uvicornPath)) {
  console.error('[backend] Virtual env not found. From project root run:');
  console.error('  cd backend');
  console.error('  python -m venv venv');
  console.error('  .\\venv\\Scripts\\Activate.ps1  (Windows) or source venv/bin/activate (Unix)');
  console.error('  pip install -r requirements.txt');
  process.exit(1);
}

const child = spawn(uvicornPath, ['app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (err) => {
  console.error('[backend] Failed to start:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== null && code !== 0) process.exit(code);
  if (signal) process.exit(1);
});

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow = null;
let pythonProcess = null;

const BACKEND_PORT = 8000;
const FRONTEND_URL = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;

function waitForBackend(retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(`http://localhost:${BACKEND_PORT}/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (retries-- > 0) setTimeout(attempt, delay);
        else reject(new Error('Backend did not start in time'));
      }).on('error', () => {
        if (retries-- > 0) setTimeout(attempt, delay);
        else reject(new Error('Backend unreachable'));
      });
    };
    attempt();
  });
}

function startPythonSidecar() {
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '../backend');

  const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(backendPath, 'main.py');

  pythonProcess = spawn(pythonExecutable, ['-u', scriptPath], {
    cwd: backendPath,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log('[Python]', data.toString().trim());
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('[Python ERR]', data.toString().trim());
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[Python] Exited with code ${code}`);
    pythonProcess = null;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../frontend/public/icon.png'),
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    startPythonSidecar();
    await waitForBackend();
    console.log('[Electron] Backend ready');
  } catch (err) {
    console.error('[Electron] Backend failed to start:', err.message);
  }

  await mainWindow.loadURL(FRONTEND_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) pythonProcess.kill();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});

ipcMain.handle('get-backend-url', () => `http://localhost:${BACKEND_PORT}`);

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('get-app-version', () => app.getVersion());

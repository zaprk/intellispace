import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let backendProcess: any = null;

// Start the backend server
function startBackend() {
  if (isDev) {
    // In dev, the backend is started separately via npm scripts
    return;
  }
  
  // In production, spawn the backend process
  const backendPath = path.join(__dirname, '../backend/server.js');
  backendProcess = spawn('node', [backendPath], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'inherit'
  });
  
  backendProcess.on('error', (err: Error) => {
    console.error('Failed to start backend:', err);
    dialog.showErrorBox('Backend Error', 'Failed to start the backend server');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Create application menu
  const menuTemplate: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Import Agent',
          click: () => {
            mainWindow?.webContents.send('menu-import-agent');
          }
        },
        {
          label: 'Export Agent',
          click: () => {
            mainWindow?.webContents.send('menu-export-agent');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Memory Panel',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            mainWindow?.webContents.send('menu-toggle-memory');
          }
        },
        {
          label: 'Toggle Agent List',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow?.webContents.send('menu-toggle-agents');
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Agents',
      submenu: [
        {
          label: 'New Agent',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-agent');
          }
        },
        {
          label: 'Manage Agents',
          click: () => {
            mainWindow?.webContents.send('menu-manage-agents');
          }
        },
        { type: 'separator' },
        {
          label: 'Agent Marketplace',
          click: () => {
            mainWindow?.webContents.send('menu-agent-marketplace');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'LLM Settings',
          click: () => {
            mainWindow?.webContents.send('menu-llm-settings');
          }
        },
        {
          label: 'Plugin Manager',
          click: () => {
            mainWindow?.webContents.send('menu-plugin-manager');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Conversation',
          click: () => {
            mainWindow?.webContents.send('menu-export-conversation');
          }
        },
        {
          label: 'Clear Memory',
          click: () => {
            mainWindow?.webContents.send('menu-clear-memory');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            require('electron').shell.openExternal('https://intellispace.docs');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            mainWindow?.webContents.send('menu-show-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'About IntelliSpace',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About IntelliSpace',
              message: 'IntelliSpace MVP',
              detail: 'Version 0.1.0\n\nThe AI Agent Operating System\n\nBuilt with Electron, React, and TypeScript',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About IntelliSpace', role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide IntelliSpace', accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Shift+H', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// File operations
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, options);
  return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, options);
  return result;
});

// Window controls
ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('close-window', () => {
  mainWindow?.close();
});

// Agent operations (these will communicate with the backend)
ipcMain.handle('create-agent', async (event, agentData) => {
  // Forward to backend via HTTP request
  try {
    const response = await fetch('http://localhost:3001/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentData)
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to create agent:', error);
    throw error;
  }
});

ipcMain.handle('update-agent', async (event, id, updates) => {
  try {
    const response = await fetch(`http://localhost:3001/api/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to update agent:', error);
    throw error;
  }
});

ipcMain.handle('delete-agent', async (event, id) => {
  try {
    const response = await fetch(`http://localhost:3001/api/agents/${id}`, {
      method: 'DELETE'
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to delete agent:', error);
    throw error;
  }
});

// Export for TypeScript
export { };
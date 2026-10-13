/**
 * Zkong Desktop Application - Unofficial • by Nazjar Dev
 * Native Windows Desktop Application
 * Electron Main Process with Windows 11 Acrylic Theme, System Tray,
 * Auto-Starting Backend Supervisor, and Native OS Integration.
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let phpProcess = null;
const PORT = 5050;
const APP_URL = `http://127.0.0.1:${PORT}/`;
const BASE_DIR = path.dirname(__dirname); // zkong-platform directory

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

/**
 * Check if the server is currently responding on port 5050
 */
function checkBackendHealth() {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${PORT}/api/status`, { timeout: 1500 }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

const { startEmbeddedServer } = require('./embedded_server');
const { supervisor } = require('./middleware_supervisor');

/**
 * Automatically launch the self-contained embedded Node.js engine and ZKong Middleware
 */
async function ensureBackendRunning() {
    const isRunning = await checkBackendHealth();
    if (isRunning) {
        console.log(`[Backend Supervisor] Portul ${PORT} este deja activ și răspunde.`);
    } else {
        console.log(`[Backend Supervisor] Pornire server nativ autonom embedded pe portul ${PORT}...`);
        try {
            await startEmbeddedServer(PORT);
            console.log(`[Backend Supervisor] Serverul nativ autonom a pornit cu succes pe portul ${PORT}!`);
        } catch (err) {
            console.error('[Backend Supervisor] Eroare la pornirea serverului autonom:', err);
        }
    }

    console.log('[Backend Supervisor] Inițializare ZKong Middleware integrat (Port 8003 & Redis)...');
    try {
        await supervisor.ensureRunning();
        console.log('[Backend Supervisor] ZKong Middleware este activat și integrat în aplicația PC!');
    } catch (err) {
        console.error('[Backend Supervisor] Eroare inițializare middleware:', err);
    }

    return true;
}

/**
 * Create the main application window
 */
function createMainWindow() {
    const iconPath = path.join(__dirname, 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1100,
        minHeight: 700,
        backgroundColor: '#0a0e17',
        icon: iconPath,
        title: 'Zkong Desktop Application - Unofficial • by Nazjar Dev',
        // Native Windows 11 Controls Overlay
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#94a3b8',
            height: 38
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false // allow local iframe preview
        },
        show: false
    });

    // Elegant window reveal when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Close to tray behavior
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    mainWindow.loadURL(APP_URL);
}

/**
 * Setup Windows System Tray icon & context menu
 */
function createSystemTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('Zkong Desktop Application - Unofficial • by Nazjar Dev');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Zkong Desktop Application - Unofficial (by Nazjar Dev)',
            enabled: false
        },
        { type: 'separator' },
        {
            label: '📊 Deschide Fereastra Principală',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: '➕ Adaugă Produs Nou',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.send('app-action', 'open-create-product');
                }
            }
        },
        {
            label: '🏷️ Alocare Etichetă ESL',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.webContents.send('app-action', 'open-bind-tag');
                }
            }
        },
        {
            label: '⚡ Sincronizează Prețuri ZKong Cloud',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.webContents.send('app-action', 'sync-cloud');
                }
            }
        },
        {
            label: '🧮 Calculator Inteligent Preț/Litru',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.webContents.send('app-action', 'open-calculator');
                }
            }
        },
        { type: 'separator' },
        {
            label: '🔄 Reîncarcă Aplicația (F5)',
            click: () => {
                if (mainWindow) mainWindow.reload();
            }
        },
        {
            label: '🛠️ Instrumente Dezvoltator (DevTools)',
            click: () => {
                if (mainWindow) mainWindow.webContents.toggleDevTools();
            }
        },
        { type: 'separator' },
        {
            label: '❌ Închide Aplicația Definitiv',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

/**
 * Register Native IPC Handlers
 */
function setupIpcHandlers() {
    ipcMain.on('window-control', (event, action) => {
        if (!mainWindow) return;
        switch (action) {
            case 'minimize':
                mainWindow.minimize();
                break;
            case 'maximize':
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                } else {
                    mainWindow.maximize();
                }
                break;
            case 'close':
                mainWindow.hide();
                break;
        }
    });

    ipcMain.handle('window-is-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    ipcMain.on('show-notification', (event, { title, body }) => {
        if (Notification.isSupported()) {
            new Notification({
                title: title || 'Zkong Desktop Application',
                body: body || '',
                icon: path.join(__dirname, 'icon.png')
            }).show();
        }
    });
}

// App Lifecycle
app.whenReady().then(async () => {
    setupIpcHandlers();
    await ensureBackendRunning();
    createMainWindow();
    createSystemTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('before-quit', async () => {
    app.isQuitting = true;
    try {
        await supervisor.cleanup();
    } catch (e) {}
    if (phpProcess) {
        try {
            phpProcess.kill();
        } catch (e) {}
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Keeps running in tray unless explicit quit
    }
});

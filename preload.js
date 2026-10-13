/**
 * Zkong Desktop Application - Unofficial • Electron Preload Script
 * Exposes safe Native Window controls and IPC communication to the renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    },
    // Window Controls
    minimize: () => ipcRenderer.send('window-control', 'minimize'),
    maximize: () => ipcRenderer.send('window-control', 'maximize'),
    close: () => ipcRenderer.send('window-control', 'close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    
    // System Actions
    openExternal: (url) => ipcRenderer.send('open-external', url),
    showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

    // App Action Handlers from Tray or Shortcuts
    onAction: (callback) => {
        ipcRenderer.on('app-action', (event, action) => callback(action));
    }
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/html/index.html'));

  // Manejador para emparejamiento Web Bluetooth en Electron
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      // Priorizar dispositivos con nombre que sugieran impresoras térmicas
      const printerDevice = deviceList.find(d => 
        /pos|printer|thermal|mpt|xp|zj|58|80|bt/i.test(d.deviceName || '')
      ) || deviceList[0];
      callback(printerDevice.deviceId);
    } else {
      callback('');
    }
  });
}

// IPC: Obtener lista de impresoras del sistema operativo (USB, Red, etc.)
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error("Error al obtener impresoras:", err);
    return [];
  }
});

// IPC: Imprimir silenciosamente en una impresora específica
ipcMain.handle('print-to-device', async (event, { deviceName, silent = true }) => {
  if (!mainWindow) return { success: false, error: 'No window' };
  return new Promise((resolve) => {
    mainWindow.webContents.print({
      silent: silent,
      printBackground: true,
      deviceName: deviceName
    }, (success, errorType) => {
      resolve({ success, errorType });
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

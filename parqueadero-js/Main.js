const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Contraseña de programador para desbloquear código fuente y herramientas de desarrollo
const PROGRAMMER_PASSWORD = "1092530175kj$";

// Inicializar y garantizar la ruta de base de datos fuera de app.asar con permisos de lectura y escritura
function inicializarRutaDB() {
  const isPackaged = app.isPackaged || __dirname.includes('app.asar');
  if (!isPackaged) {
    process.env.PARKING_DB_PATH = path.join(__dirname, 'src/db.json');
    return process.env.PARKING_DB_PATH;
  }

  // 1. Probar carpeta portable 'data' junto al ejecutable
  const dirExe = path.dirname(process.execPath);
  const dirDataPortable = path.join(dirExe, 'data');
  try {
    if (!fs.existsSync(dirDataPortable)) {
      fs.mkdirSync(dirDataPortable, { recursive: true });
    }
    const testFile = path.join(dirDataPortable, '.perm_test');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    process.env.PARKING_DB_PATH = path.join(dirDataPortable, 'db.json');
  } catch (e) {
    // 2. Si la carpeta del ejecutable no es escribible, usar app.getPath('userData')
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    process.env.PARKING_DB_PATH = path.join(userDataPath, 'db.json');
  }

  // Si no existe aún en la ruta externa, copiar la plantilla base desde src/db.json
  if (!fs.existsSync(process.env.PARKING_DB_PATH)) {
    const seedPath = path.join(__dirname, 'src/db.json');
    if (fs.existsSync(seedPath)) {
      try {
        fs.copyFileSync(seedPath, process.env.PARKING_DB_PATH);
      } catch (err) {
        console.error("No se pudo copiar db.json inicial:", err);
      }
    }
  }

  return process.env.PARKING_DB_PATH;
}

function createWindow() {
  inicializarRutaDB();

  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    resizable: true,
    title: "Parking La Primera - Sistema de Gestión",
    icon: fs.existsSync(path.join(__dirname, 'sistem parking.ico')) 
      ? path.join(__dirname, 'sistem parking.ico') 
      : path.join(__dirname, 'sistem parking.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // Controlado por contraseña de programador
    }
  });

  // Ocultar barra de menú por defecto para bloquear acceso no autorizado al código
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, 'src/html/index.html'));

  // Bloquear acceso a herramientas de desarrollador por atajos de teclado sin contraseña
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevToolsShortcut = 
      input.key === 'F12' || 
      (input.control && input.shift && (input.key === 'I' || input.key === 'i' || input.key === 'J' || input.key === 'j')) ||
      (input.control && (input.key === 'u' || input.key === 'U'));

    if (isDevToolsShortcut) {
      event.preventDefault();
      solicitarDesbloqueoProgramador();
    }
  });

  // Manejador para emparejamiento Web Bluetooth en Electron
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      const printerDevice = deviceList.find(d => 
        /pos|printer|thermal|mpt|xp|zj|58|80|bt/i.test(d.deviceName || '')
      ) || deviceList[0];
      callback(printerDevice.deviceId);
    } else {
      callback('');
    }
  });
}

// Función para solicitar desbloqueo con la contraseña de programador
function solicitarDesbloqueoProgramador() {
  if (!mainWindow) return;
  mainWindow.webContents.send('solicitar-clave-programador');
}

// IPC: Verificar clave de programador para abrir DevTools o acceder al código
ipcMain.handle('desbloquear-modo-programador', async (event, claveIngresada) => {
  if (claveIngresada === PROGRAMMER_PASSWORD) {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
    return { ok: true, mensaje: "Acceso de programador concedido. Herramientas y código desbloqueados." };
  } else {
    return { ok: false, mensaje: "Contraseña de programador incorrecta. Acceso denegado." };
  }
});

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

app.whenReady().then(() => {
  createWindow();

  // Atajo global Ctrl+Alt+P para programador
  globalShortcut.register('CommandOrControl+Alt+P', () => {
    solicitarDesbloqueoProgramador();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

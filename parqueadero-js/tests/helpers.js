/**
 * ============================================================================
 * HELPERS Y ADAPTADORES DE PRUEBA - PARKING LA PRIMERA
 * ============================================================================
 * Aislamiento de entorno, gestión de ciclo de vida de fixtures y stubs de respaldo.
 * 
 * SUPUESTOS DE NEGOCIO DEL PLAN DE PRUEBAS:
 * 1. UNIDAD DE FRACCIÓN: 60 minutos con tolerancia de gracia estricta de 6 minutos (RF04).
 *    - 60 min -> 1 fracción ($3.000).
 *    - 65 min -> 1 fracción ($3.000).
 *    - 66 min -> 1 fracción ($3.000) [Límite de gracia].
 *    - 67 min -> 2 fracciones ($6.000) [Supera tolerancia].
 * 2. SALIDA MENSUALIDAD: Un cliente con mensualidad o media mensualidad activa
 *    liquida cobro = $0 al registrar salida (RF04, RF05).
 * 3. VIGENCIA DE SUSCRIPCIÓN: El registro de cliente asigna fechaInicio = hoy y
 *    fechaVencimiento calculada a +30 días calendario por defecto (RF05).
 * 4. ACTUALIZACIÓN POR VENCIMIENTO: Todo cliente cuya fechaVencimiento sea anterior
 *    al timestamp de evaluación actual transiciona de 'Activo' a 'Inactivo' (RF05).
 * 5. VACIADO DE REGISTROS: El vaciado diario elimina registros de rotación diaria
 *    (registros = 0) pero PRESERVA clientes frecuentes, tarifas y configuración.
 * 6. AISLAMIENTO: Las pruebas operan exclusivamente sobre 'db.test.json'.
 *    El archivo real 'db.json' nunca es alterado.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FIXTURE_FILE, FIXTURE_DATA, calcularHashSHA256 } = require('./fixtures');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEST_DB_PATH = path.join(__dirname, 'db.test.json');
const BACKUP_DB_PATH = path.join(__dirname, 'db.test.backup.json');

// Intentar importar la clase nativa ParkingDatabase de src/js/database.js
let ParkingDatabaseClass = null;
let nativeDbError = null;

try {
    const dbModule = require('../src/js/database.js');
    ParkingDatabaseClass = dbModule.ParkingDatabase || dbModule;
} catch (err) {
    nativeDbError = err;
}

/**
 * Reset de la base de datos de prueba a partir del fixture maestro.
 * Garantiza idempotencia e independencia entre pruebas individuales.
 */
function resetTestDb() {
    fs.copyFileSync(FIXTURE_FILE, TEST_DB_PATH);
    return TEST_DB_PATH;
}

/**
 * Lee el contenido actual de db.test.json
 */
function readTestDb() {
    if (!fs.existsSync(TEST_DB_PATH)) return null;
    const content = fs.readFileSync(TEST_DB_PATH, 'utf-8');
    return JSON.parse(content);
}

/**
 * Sobrescribe db.test.json con datos específicos
 */
function writeTestDb(data) {
    fs.writeFileSync(TEST_DB_PATH, JSON.stringify(data, null, 4), 'utf-8');
    return true;
}

/**
 * Realiza un backup de db.test.json para pruebas de integridad (CP-029)
 */
function backupTestDb() {
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.copyFileSync(TEST_DB_PATH, BACKUP_DB_PATH);
        return true;
    }
    return false;
}

/**
 * Restaura el backup de prueba
 */
function restoreTestDbBackup() {
    if (fs.existsSync(BACKUP_DB_PATH)) {
        fs.copyFileSync(BACKUP_DB_PATH, TEST_DB_PATH);
        return true;
    }
    return false;
}

/**
 * Limpieza de archivos temporales generados durante la suite
 */
function cleanupTestFiles() {
    [TEST_DB_PATH, BACKUP_DB_PATH].forEach(f => {
        if (fs.existsSync(f)) {
            try { fs.unlinkSync(f); } catch (e) {}
        }
    });
}

/**
 * Crea una nueva instancia de la base de datos apuntando a db.test.json
 */
function createDbInstance(customPath = TEST_DB_PATH) {
    if (ParkingDatabaseClass && typeof ParkingDatabaseClass === 'function') {
        return new ParkingDatabaseClass(customPath);
    }
    return null;
}

/**
 * ADAPTADOR Y STUBS DOCUMENTADOS
 * Si la base de datos real carece de una función de negocio esperada por el plan,
 * este adaptador la provee de acuerdo a las reglas del plan y marca `usando_stub = true`.
 */
class BusinessAdapter {
    constructor(dbInstance) {
        this.db = dbInstance;
        this.usando_stub = false;
    }

    normalizarPlaca(placa) {
        if (this.db && typeof this.db.normalizarPlaca === 'function') {
            return this.db.normalizarPlaca(placa);
        }
        this.usando_stub = true;
        if (!placa || typeof placa !== 'string') return '';
        return placa.trim().toUpperCase().replace(/[\s-]/g, '');
    }

    validarPlaca(placa) {
        if (this.db && typeof this.db.validarPlaca === 'function') {
            return this.db.validarPlaca(placa);
        }
        this.usando_stub = true;
        const norm = this.normalizarPlaca(placa);
        if (!norm || norm.length < 5 || norm.length > 7) return false;
        const regex = /^[A-Z]{3}[0-9]{3}$|^[A-Z]{3}[0-9]{2}[A-Z]$|^[A-Z0-9]{5,7}$/;
        return regex.test(norm);
    }

    validarTarifa(valor) {
        if (this.db && typeof this.db.validarTarifa === 'function') {
            return this.db.validarTarifa(valor);
        }
        this.usando_stub = true;
        if (valor === undefined || valor === null || valor === '') return false;
        const num = Number(valor);
        if (isNaN(num)) return false;
        return num > 0;
    }

    calcularTarifa(tipoVehiculo, tipoServicio, minutos, tarifas, duracionFraccion = 60) {
        if (this.db && typeof this.db.calcularTarifa === 'function') {
            return this.db.calcularTarifa(tipoVehiculo, tipoServicio, minutos, tarifas, duracionFraccion);
        }
        this.usando_stub = true;
        const tipo = (tipoVehiculo || 'CARRO').toUpperCase();
        const serv = (tipoServicio || 'fraccion').toLowerCase();
        const precios = tarifas ? (tarifas[tipo] || tarifas[tipo.toLowerCase()]) : null;
        if (!precios) return 0;

        if (serv === 'fraccion' || serv === 'comun') {
            let cantidadFracciones = Math.floor(minutos / duracionFraccion);
            let minutosSobrantes = minutos % duracionFraccion;
            if (minutosSobrantes > 6) {
                cantidadFracciones += 1;
            }
            if (cantidadFracciones === 0) {
                cantidadFracciones = 1;
            }
            return cantidadFracciones * (precios.fraccion || 0);
        } else if (serv === 'dia') {
            return precios.dia || 0;
        } else if (serv === 'media_mensualidad' || serv === 'media') {
            return precios.media_mensualidad || precios.media || 0;
        } else if (serv === 'mensualidad') {
            return precios.mensualidad || 0;
        }
        return 0;
    }

    validarCredenciales(usuario, clave) {
        if (this.db && typeof this.db.validarCredenciales === 'function') {
            return this.db.validarCredenciales(usuario, clave);
        }
        this.usando_stub = true;
        if (!usuario || !clave || String(usuario).trim() === '' || String(clave).trim() === '') {
            return { ok: false, mensaje: "Campos de usuario y contraseña obligatorios." };
        }
        const data = this.db ? this.db.obtenerDatos() : readTestDb();
        if (!data || !data.usuarios) return { ok: false, mensaje: "No hay usuarios." };

        const user = data.usuarios.find(u => u.usuario.toLowerCase() === String(usuario).trim().toLowerCase());
        if (!user) return { ok: false, mensaje: "Usuario inexistente." };

        const hash = calcularHashSHA256(clave);
        const pass = user.password || user.clave || '';
        const valida = (pass === clave) || (pass.toLowerCase() === hash.toLowerCase());

        if (!valida) return { ok: false, mensaje: "Contraseña incorrecta." };

        const rol = (user.rol || 'cajero').toLowerCase();
        return {
            ok: true,
            rol: (rol === 'administrador' || rol === 'admin') ? 'Administrador' : 'Cajero',
            usuario: user.usuario,
            nombre: user.nombre || user.usuario
        };
    }

    puedeAcceder(rol, recurso) {
        if (this.db && typeof this.db.puedeAcceder === 'function') {
            return this.db.puedeAcceder(rol, recurso);
        }
        this.usando_stub = true;
        if (!rol || !recurso) return false;
        const rolNorm = String(rol).toLowerCase();
        const recNorm = String(recurso).toLowerCase();

        if (rolNorm === 'administrador' || rolNorm === 'admin') return true;

        const restringidosAdmin = ['tarifas', 'usuarios', 'vaciado', 'configuracion', 'historial_completo', 'reportes_completos'];
        if (restringidosAdmin.includes(recNorm)) return false;

        const permitidosCajero = ['registrar', 'cobrar', 'menu', 'inicio', 'tickets', 'consultar_placa'];
        return permitidosCajero.includes(recNorm);
    }

    estaPlacaDentro(placa) {
        if (this.db && typeof this.db.estaPlacaDentro === 'function') {
            return this.db.estaPlacaDentro(placa);
        }
        this.usando_stub = true;
        const norm = this.normalizarPlaca(placa);
        const data = this.db ? this.db.obtenerDatos() : readTestDb();
        if (!data || !data.registros) return false;
        return data.registros.some(r => r.placa === norm && !r.salida);
    }

    aplicarVaciado(claveAdmin) {
        if (this.db && typeof this.db.aplicarVaciado === 'function') {
            return this.db.aplicarVaciado(claveAdmin);
        }
        if (this.db && typeof this.db.vaciarRegistrosDia === 'function') {
            return this.db.vaciarRegistrosDia(claveAdmin);
        }
        this.usando_stub = true;
        const data = readTestDb();
        const passReal = (data.config && data.config.passwordAdmin) ? data.config.passwordAdmin : "Adm@2026test";
        if (claveAdmin !== passReal) {
            return { exito: false, mensaje: "Contraseña incorrecta." };
        }
        const eliminados = data.registros.length;
        data.registros = [];
        writeTestDb(data);
        return { exito: true, registrosEliminados: eliminados, clientesConservados: data.clientes.length };
    }

    actualizarSuscripcionesVencidas() {
        if (this.db && typeof this.db.actualizarSuscripcionesVencidas === 'function') {
            return this.db.actualizarSuscripcionesVencidas();
        }
        this.usando_stub = true;
        const data = this.db ? this.db.obtenerDatos() : readTestDb();
        const ahora = new Date();
        let mod = 0;
        if (data.clientes) {
            data.clientes.forEach(c => {
                if (c.fechaVencimiento && new Date(c.fechaVencimiento) < ahora) {
                    c.estado = 'Inactivo';
                    mod++;
                }
            });
            if (this.db) this.db.guardarDatos(data);
            else writeTestDb(data);
        }
        return { modificados: mod, clientes: data.clientes };
    }
}

module.exports = {
    ROOT_DIR,
    TEST_DB_PATH,
    BACKUP_DB_PATH,
    resetTestDb,
    readTestDb,
    writeTestDb,
    backupTestDb,
    restoreTestDbBackup,
    cleanupTestFiles,
    createDbInstance,
    BusinessAdapter,
    calcularHashSHA256
};

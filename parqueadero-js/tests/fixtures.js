/**
 * ============================================================================
 * FIXTURES DE PRUEBA - PARKING LA PRIMERA
 * ============================================================================
 * Plantilla de datos ficticios estandarizados según el Plan de Pruebas.
 * Aislamiento total: Se utiliza para inicializar 'db.test.json' en cada prueba.
 * NUNCA toca el 'db.json' real del entorno de producción.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Directorios y rutas fijas
const ROOT_DIR = path.resolve(__dirname, '..');
const FIXTURE_FILE = path.join(__dirname, 'db.fixture.json');

// Helper para calcular hash SHA-256 (64 caracteres hexadecimales)
function calcularHashSHA256(texto) {
    return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

// Datos maestros ficticios estandarizados por el Plan de Pruebas
const FIXTURE_DATA = {
    usuarios: [
        {
            usuario: "cajero_test",
            password: calcularHashSHA256("Caj@2026test"),
            rol: "cajero",
            nombre: "Cajero de Pruebas"
        },
        {
            usuario: "admin_test",
            password: calcularHashSHA256("Adm@2026test"),
            rol: "administrador",
            nombre: "Administrador de Pruebas"
        }
    ],
    tarifas: {
        CARRO: {
            fraccion: 3000,
            dia: 15000,
            media_mensualidad: 70000,
            mensualidad: 120000,
            media: 70000
        },
        MOTO: {
            fraccion: 1500,
            dia: 8000,
            media_mensualidad: 35000,
            mensualidad: 60000,
            media: 35000
        },
        carro: {
            fraccion: 3000,
            dia: 15000,
            media_mensualidad: 70000,
            mensualidad: 120000,
            media: 70000
        },
        moto: {
            fraccion: 1500,
            dia: 8000,
            media_mensualidad: 35000,
            mensualidad: 60000,
            media: 35000
        }
    },
    registros: [],
    clientes: [
        {
            cedula: "1000000001",
            nombre: "Cliente Frecuente Mensual",
            telefono: "3000000001",
            placa: "JKL222",
            servicio: "mensualidad",
            tipoSuscripcion: "Mensualidad",
            estado: "Activo",
            fechaInicio: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            fechaVencimiento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            cedula: "1000000002",
            nombre: "Cliente Media Mensualidad",
            telefono: "3000000002",
            placa: "MNO333",
            servicio: "media_mensualidad",
            tipoSuscripcion: "Media Mensualidad",
            estado: "Activo",
            fechaInicio: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            fechaVencimiento: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()
        }
    ],
    config: {
        passwordAdmin: "Adm@2026test"
    }
};

/**
 * Genera físicamente el archivo db.fixture.json en disco
 */
function generarFixtureFile() {
    fs.writeFileSync(FIXTURE_FILE, JSON.stringify(FIXTURE_DATA, null, 4), 'utf-8');
    return FIXTURE_FILE;
}

// Inicializar al cargar módulo
generarFixtureFile();

module.exports = {
    FIXTURE_FILE,
    FIXTURE_DATA,
    calcularHashSHA256,
    generarFixtureFile
};

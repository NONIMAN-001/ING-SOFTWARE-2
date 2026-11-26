const path = require('path');
const fs = require('fs');
const { ParkingDatabase } = require('../../src/js/database.js');

describe('Pruebas Unitarias de Lógica Matemática y Negocio - Parking La Primera', () => {
    let db;
    let tempDbPath;

    beforeEach(() => {
        tempDbPath = path.join(__dirname, `../temp_unit_db_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
        db = new ParkingDatabase(tempDbPath);
    });

    afterEach(() => {
        if (fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch (e) {}
        }
    });

    /**
     * CP-010 – Normalizar la placa (mayúsculas y sin espacios)
     * Requisito: RF02 Registro de ingreso de vehículos
     * Tipo: Unitaria automatizada (Jest), partición de equivalencia
     */
    describe('CP-010: Normalización de placas vehiculares', () => {
        it('CP-010: Debe normalizar correctamente placas con espacios, minúsculas y guiones', () => {
            const entradas = [
                " abc 123 ",
                "abc123",
                "AbC123",
                "ABC-123"
            ];
            const esperado = "ABC123";

            entradas.forEach(entrada => {
                const resultado = db.normalizarPlaca(entrada);
                console.log(`[CP-010] Input: "${entrada}" -> Normalizado: "${resultado}"`);
                expect(resultado).toBe(esperado);
            });
        });

        it('CP-010: Debe normalizar placas de motos con letra final', () => {
            const entrada = "  xyz-98e ";
            const resultado = db.normalizarPlaca(entrada);
            console.log(`[CP-010] Moto Input: "${entrada}" -> Normalizado: "${resultado}"`);
            expect(resultado).toBe("XYZ98E");
        });
    });

    /**
     * CP-012 – Rechazar placa vacía o con formato inválido
     * Requisito: RF02 Registro de ingreso de vehículos
     * Tipo: Funcional negativa, valores límite y particiones inválidas
     */
    describe('CP-012: Validación estricta de formatos de placa', () => {
        it('CP-012: Debe rechazar placas vacías, demasiado cortas, largas o con caracteres especiales', () => {
            const invalidas = ["", "   ", "AB", "ABCDEFGHIJ", "@@#123"];
            
            invalidas.forEach(placa => {
                const esValida = db.validarPlaca(placa);
                console.log(`[CP-012] Placa inválida: "${placa}" -> Válida: ${esValida}`);
                expect(esValida).toBe(false);
            });
        });

        it('CP-012: Debe aceptar placas válidas de carro y moto', () => {
            expect(db.validarPlaca("ABC123")).toBe(true);
            expect(db.validarPlaca("ABC12D")).toBe(true);
        });
    });

    /**
     * CP-015 – Cobrar fracción dentro de la tolerancia de 6 minutos
     * Requisito: RF04 Cálculo automatizado de cobros con tarifa vigente y tolerancia
     * Tipo: Unitaria automatizada (Jest), valores límite
     * Precondiciones: Fracción carro = $3.000, unidad = 60 min con tolerancia de 6 min.
     */
    describe('CP-015: Cobro de fracción dentro de la tolerancia de 6 minutos', () => {
        const tarifas = {
            CARRO: { fraccion: 3000, dia: 15000, mensualidad: 120000 },
            MOTO:  { fraccion: 1500, dia: 8000, mensualidad: 60000 }
        };

        it('CP-015: Permanencia de 1h 00m (60 min) debe cobrar exactamente 1 fracción ($3.000)', () => {
            const minutos = 60;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-015] Permanencia 60 min -> Cobro: $${cobro} (Esperado: $3000)`);
            expect(cobro).toBe(3000);
        });

        it('CP-015: Permanencia de 1h 05m (65 min) debe cobrar exactamente 1 fracción ($3.000)', () => {
            const minutos = 65;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-015] Permanencia 65 min -> Cobro: $${cobro} (Esperado: $3000)`);
            expect(cobro).toBe(3000);
        });

        it('CP-015: Permanencia de 1h 06m (66 min) debe cobrar exactamente 1 fracción ($3.000 - tolerancia de 6 min)', () => {
            const minutos = 66;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-015] Permanencia 66 min (Tolerancia límite) -> Cobro: $${cobro} (Esperado: $3000)`);
            expect(cobro).toBe(3000);
        });
    });

    /**
     * CP-016 – Cobrar fracción adicional al superar la tolerancia de 6 minutos
     * Requisito: RF04 Cálculo automatizado de cobros con tarifa vigente y tolerancia
     * Tipo: Unitaria automatizada (Jest), valores límite
     */
    describe('CP-016: Cobro de fracción adicional al superar la tolerancia', () => {
        const tarifas = {
            CARRO: { fraccion: 3000, dia: 15000, mensualidad: 120000 }
        };

        it('CP-016: Permanencia de 1h 07m (67 min) supera la tolerancia y cobra 2 fracciones ($6.000)', () => {
            const minutos = 67;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-016] Permanencia 67 min -> Cobro: $${cobro} (Esperado: $6000)`);
            expect(cobro).toBe(6000);
        });

        it('CP-016: Permanencia de 2h 06m (126 min) está dentro de la tolerancia de la 2da fracción ($6.000)', () => {
            const minutos = 126;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-016] Permanencia 126 min -> Cobro: $${cobro} (Esperado: $6000)`);
            expect(cobro).toBe(6000);
        });

        it('CP-016: Permanencia de 2h 07m (127 min) supera la tolerancia y cobra 3 fracciones ($9.000)', () => {
            const minutos = 127;
            const cobro = db.calcularTarifa('CARRO', 'fraccion', minutos, tarifas, 60);
            console.log(`[CP-016] Permanencia 127 min -> Cobro: $${cobro} (Esperado: $9000)`);
            expect(cobro).toBe(9000);
        });
    });

    /**
     * CP-017 – Cobrar servicio por día según el tipo de vehículo
     * Requisito: RF04 Cálculo automatizado de cobros
     * Tipo: Funcional, tabla de decisión (tipo de vehículo x servicio)
     */
    describe('CP-017: Cálculo de tarifas de servicio por día', () => {
        const tarifas = {
            CARRO: { dia: 15000 },
            MOTO:  { dia: 8000 }
        };

        it('CP-017: Debe cobrar tarifa plana de día para carro ($15.000)', () => {
            const cobro = db.calcularTarifa('CARRO', 'dia', 480, tarifas);
            console.log(`[CP-017] Carro Día (480 min) -> Cobro: $${cobro} (Esperado: $15000)`);
            expect(cobro).toBe(15000);
        });

        it('CP-017: Debe cobrar tarifa plana de día para moto ($8.000)', () => {
            const cobro = db.calcularTarifa('MOTO', 'dia', 480, tarifas);
            console.log(`[CP-017] Moto Día (480 min) -> Cobro: $${cobro} (Esperado: $8000)`);
            expect(cobro).toBe(8000);
        });
    });

    /**
     * CP-032 – Rechazar valores de tarifa inválidos
     * Requisito: RF08 Gestión de tarifas por el administrador
     * Tipo: Funcional negativa, valores límite
     */
    describe('CP-032: Rechazo de valores de tarifa inválidos', () => {
        it('CP-032: Debe rechazar valores 0, negativos, strings no numéricos y vacíos', () => {
            const valoresInvalidos = [0, -1000, "abc", "", null, undefined];

            valoresInvalidos.forEach(val => {
                const valido = db.validarTarifa(val);
                console.log(`[CP-032] Tarifa inválida: "${val}" -> Válida: ${valido}`);
                expect(valido).toBe(false);
            });
        });

        it('CP-032: Debe aceptar montos positivos válidos', () => {
            expect(db.validarTarifa(3000)).toBe(true);
            expect(db.validarTarifa("15000")).toBe(true);
        });
    });
});

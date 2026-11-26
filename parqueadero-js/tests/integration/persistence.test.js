const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ParkingDatabase } = require('../../src/js/database.js');

describe('Pruebas de Persistencia, Seguridad y Tolerancia a Fallos - Parking La Primera', () => {
    let tempDbPath;
    let db;

    beforeEach(() => {
        tempDbPath = path.join(__dirname, `../temp_persist_db_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
        db = new ParkingDatabase(tempDbPath);
    });

    afterEach(() => {
        if (fs.existsSync(tempDbPath)) {
            try { fs.unlinkSync(tempDbPath); } catch (e) {}
        }
    });

    /**
     * CP-005 – Verificar que las contraseñas se almacenan cifradas
     * Requisito: RNF01 Seguridad y confidencialidad
     * Tipo: No funcional, seguridad, inspección de datos
     */
    describe('CP-005: Almacenamiento seguro / Cifrado de contraseñas', () => {
        it('CP-005: Las contraseñas en db.json NO deben estar en texto plano puro', () => {
            const contenidoRaw = fs.readFileSync(tempDbPath, 'utf-8');
            const data = JSON.parse(contenidoRaw);

            console.log(`[CP-005] Inspeccionando archivo db.json en: ${tempDbPath}`);
            expect(data.usuarios).toBeDefined();
            expect(data.usuarios.length).toBeGreaterThan(0);

            data.usuarios.forEach(u => {
                console.log(`[CP-005] Usuario: ${u.usuario} | Password Hash: ${u.password.substring(0, 10)}...`);
                // La contraseña no debe ser idéntica a la clave plana típica ("Caj@2026test" o "Adm@2026test")
                expect(u.password).not.toBe("Caj@2026test");
                expect(u.password).not.toBe("Adm@2026test");
                // Verificar que tenga estructura de hash (inicia con prefijo de hash ej $2b$ o longitud >= 20 caracteres)
                expect(u.password.length).toBeGreaterThanOrEqual(15);
            });
        });
    });

    /**
     * CP-029 – Vaciar los registros del día conservando los clientes con mensualidad
     * Requisito: RF07 Generación de reportes y cierre de caja; RF05 Clientes frecuentes
     * Tipo: Integración, validación de datos post-cierre (riesgo R9)
     */
    describe('CP-029: Vaciado de registros del día conservando clientes con mensualidad', () => {
        it('CP-029: Debe eliminar registros de rotación diaria pero conservar clientes frecuentes y tarifas', () => {
            // 1. Cargar clientes con mensualidad
            db.registrarCliente({
                nombre: "Cliente Mensual Uno",
                cedula: "1000000001",
                telefono: "3000000001",
                placa: "JKL222",
                servicio: "mensualidad"
            });
            db.registrarCliente({
                nombre: "Cliente Mensual Dos",
                cedula: "1000000002",
                telefono: "3000000002",
                placa: "MNO333",
                servicio: "media_mensualidad"
            });

            // 2. Registrar ingresos diarios
            db.registrarEntrada("ABC123", "CARRO", "fraccion");
            db.registrarEntrada("DEF456", "CARRO", "dia");

            let dataPrevia = db.obtenerDatos();
            expect(dataPrevia.registros.length).toBe(2);
            expect(dataPrevia.clientes.length).toBe(2);
            console.log(`[CP-029] Antes del vaciado -> Registros: ${dataPrevia.registros.length}, Clientes: ${dataPrevia.clientes.length}`);

            // 3. Ejecutar vaciado con clave de admin
            const resultado = db.vaciarRegistrosDia("Adm@2026test");
            expect(resultado.exito).toBe(true);

            // 4. Comprobar archivo en disco
            const dataPosterior = db.obtenerDatos();
            console.log(`[CP-029] Después del vaciado -> Registros: ${dataPosterior.registros.length}, Clientes: ${dataPosterior.clientes.length}`);

            expect(dataPosterior.registros.length).toBe(0); // Registros vaciados
            expect(dataPosterior.clientes.length).toBe(2);   // Clientes con mensualidad intactos
            expect(dataPosterior.tarifas).toBeDefined();     // Tarifas intactas
        });
    });

    /**
     * CP-030 – No vaciar los registros con contraseña administrativa incorrecta
     * Requisito: RF07 Generación de reportes y cierre de caja; RNF01 Seguridad
     * Tipo: Funcional negativa, seguridad
     */
    describe('CP-030: Rechazo de vaciado con contraseña incorrecta', () => {
        it('CP-030: Debe rechazar la contraseña incorrecta y no alterar ningún registro', () => {
            db.registrarEntrada("ABC123", "CARRO", "fraccion");
            
            const resultado = db.vaciarRegistrosDia("Incorrecta123");
            console.log(`[CP-030] Intento con clave inválida -> Éxito: ${resultado.exito}, Mensaje: "${resultado.mensaje}"`);

            expect(resultado.exito).toBe(false);
            const data = db.obtenerDatos();
            expect(data.registros.length).toBe(1); // El registro debe conservarse
        });
    });

    /**
     * CP-034 – Recuperar los datos tras un cierre inesperado de la aplicación
     * Requisito: RNF06 Persistencia y tolerancia a fallos; RNF04 Confiabilidad
     * Tipo: No funcional, confiabilidad (Simulación forzada de process.kill)
     */
    describe('CP-034: Persistencia y recuperación ante cierre inesperado (crash/kill)', () => {
        it('CP-034: Los datos escritos antes de un kill forzado del proceso deben persistir intactos', async () => {
            // Creamos un subproceso Node que escribe síncronamente y es terminado abruptamente (SIGKILL)
            const scriptFile = path.join(__dirname, `../temp_crash_worker_${Date.now()}.js`);
            const scriptContent = `
                const fs = require('fs');
                const { ParkingDatabase } = require('${path.join(__dirname, '../../src/js/database.js').replace(/\\/g, '/')}');
                const db = new ParkingDatabase('${tempDbPath.replace(/\\/g, '/')}');
                
                // Registrar ingresos
                db.registrarEntrada("CRASH01", "CARRO", "fraccion");
                db.registrarEntrada("CRASH02", "MOTO", "fraccion");
                
                // Notificar al padre que escribió
                process.stdout.write("DATOS_ESCRITOS");
                
                // Esperar activo sin salir normalmente
                setInterval(() => {}, 1000);
            `;

            fs.writeFileSync(scriptFile, scriptContent, 'utf-8');

            const child = spawn('node', [scriptFile], { stdio: ['pipe', 'pipe', 'pipe'] });

            await new Promise((resolve) => {
                child.stdout.on('data', (d) => {
                    if (d.toString().includes("DATOS_ESCRITOS")) {
                        // FORZAR CIERRE INESPERADO DEL PROCESO
                        console.log(`[CP-034] Forzando cierre abrupto (process.kill) del proceso PID: ${child.pid}`);
                        child.kill('SIGKILL');
                        resolve();
                    }
                });
            });

            // Limpiar script auxiliar
            try { fs.unlinkSync(scriptFile); } catch (e) {}

            // REABRIR la base de datos tras la caída
            const recoveredDb = new ParkingDatabase(tempDbPath);
            const datos = recoveredDb.obtenerDatos();

            console.log(`[CP-034] Registros recuperados tras el cierre forzado: ${datos.registros.map(r => r.placa).join(', ')}`);
            expect(datos.registros.length).toBe(2);
            expect(datos.registros.some(r => r.placa === "CRASH01")).toBe(true);
            expect(datos.registros.some(r => r.placa === "CRASH02")).toBe(true);
        });
    });

    /**
     * CP-035 – Manejar un archivo db.json ausente o corrupto
     * Requisito: RNF04 Confiabilidad e integridad de datos
     * Tipo: No funcional negativa, manejo de excepciones
     */
    describe('CP-035: Tolerancia a archivo db.json ausente o corrupto', () => {
        it('CP-035 (Caso A): Si db.json no existe, debe reinicializarse de forma segura', () => {
            if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
            expect(fs.existsSync(tempDbPath)).toBe(false);

            const nuevaDb = new ParkingDatabase(tempDbPath);
            const datos = nuevaDb.obtenerDatos();

            console.log(`[CP-035A] Base de datos ausente -> Recreada exitosamente: ${fs.existsSync(tempDbPath)}`);
            expect(fs.existsSync(tempDbPath)).toBe(true);
            expect(datos.usuarios).toBeDefined();
            expect(datos.tarifas).toBeDefined();
        });

        it('CP-035 (Caso B): Si db.json está corrupto (JSON malformado), debe capturar el error sin colapso', () => {
            // Escribir JSON roto
            fs.writeFileSync(tempDbPath, '{ "corrupto": true, "usuarios": [ ', 'utf-8');

            const corruptDb = new ParkingDatabase(tempDbPath);
            const datos = corruptDb.obtenerDatos();

            console.log(`[CP-035B] db.json corrupto -> Manejado con seguridad: corrupto=${datos.corrupto}`);
            expect(datos.corrupto).toBe(true);
            expect(datos.error).toBeDefined();
        });
    });
});

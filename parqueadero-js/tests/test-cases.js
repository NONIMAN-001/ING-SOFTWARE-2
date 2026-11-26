/**
 * ============================================================================
 * MATRIZ DE CASOS DE PRUEBA (PLAN DE PRUEBAS) - PARKING LA PRIMERA
 * ============================================================================
 * Casos CP-001 al CP-037 estandarizados con metadatos ISTQB / IEEE 29119.
 * Incluye lógica ejecutable para casos automatizables y razones formales
 * para casos clasificados como NO_AUTOMATIZABLE.
 */

const fs = require('fs');
const path = require('path');

const CASOS_DE_PRUEBA = [
    // =========================================================================
    // MÓDULO: AUTENTICACIÓN Y SEGURIDAD
    // =========================================================================
    {
        id: "CP-001",
        titulo: "Iniciar sesión con credenciales válidas de cajero",
        modulo: "Autenticación",
        requisito: "RF01",
        prioridad: "Alta",
        tipo: "Unitaria automatizada (Jest / Node.js)",
        automatizable: true,
        run: async ({ adapter }) => {
            const resultado = adapter.validarCredenciales("cajero_test", "Caj@2026test");
            const ok = resultado.ok === true && (resultado.rol.toLowerCase() === "cajero");
            return {
                ok,
                esperado: { ok: true, rol: "Cajero" },
                obtenido: resultado,
                evidencia: `Usuario 'cajero_test' autenticado con rol '${resultado.rol}'.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-002",
        titulo: "Iniciar sesión con credenciales válidas de administrador",
        modulo: "Autenticación",
        requisito: "RF01",
        prioridad: "Alta",
        tipo: "Unitaria automatizada (Jest / Node.js)",
        automatizable: true,
        run: async ({ adapter }) => {
            const resultado = adapter.validarCredenciales("admin_test", "Adm@2026test");
            const ok = resultado.ok === true && (resultado.rol.toLowerCase() === "administrador");
            return {
                ok,
                esperado: { ok: true, rol: "Administrador" },
                obtenido: resultado,
                evidencia: `Usuario 'admin_test' autenticado con rol '${resultado.rol}'.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-003",
        titulo: "Rechazar inicio de sesión con clave incorrecta",
        modulo: "Autenticación",
        requisito: "RF01",
        prioridad: "Alta",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ adapter }) => {
            const resultado = adapter.validarCredenciales("cajero_test", "ClaveIncorrecta999");
            const ok = resultado.ok === false;
            return {
                ok,
                esperado: { ok: false, mensaje: "Contraseña incorrecta." },
                obtenido: resultado,
                evidencia: `Rechazo seguro ante clave incorrecta: '${resultado.mensaje}'.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-004",
        titulo: "Rechazar inicio de sesión con campos vacíos o usuario inexistente",
        modulo: "Autenticación",
        requisito: "RF01",
        prioridad: "Media",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ adapter }) => {
            const resVacio = adapter.validarCredenciales("", "");
            const resInexistente = adapter.validarCredenciales("usuario_fantasma_xyz", "pass123");
            const ok = resVacio.ok === false && resInexistente.ok === false;
            return {
                ok,
                esperado: "ok: false en campos vacíos y en usuario inexistente",
                obtenido: { vacio: resVacio, inexistente: resInexistente },
                evidencia: `Vacio: '${resVacio.mensaje}', Inexistente: '${resInexistente.mensaje}'.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-005",
        titulo: "Verificar que las contraseñas se almacenan cifradas (hash)",
        modulo: "Seguridad",
        requisito: "RNF01",
        prioridad: "Alta",
        tipo: "Inspección de persistencia / Seguridad",
        automatizable: true,
        run: async ({ readTestDb }) => {
            const data = readTestDb();
            if (!data || !data.usuarios || data.usuarios.length === 0) {
                return { ok: false, esperado: "Usuarios con contraseñas en hash", obtenido: "No hay usuarios", evidencia: "db.test.json sin usuarios" };
            }

            const regexHash = /^[a-f0-9]{32,}$/i;
            const regexBcrypt = /^\$2[aby]\$[0-9]{2}\$.{50,}$/i;

            let todasCifradas = true;
            const detalles = [];

            data.usuarios.forEach(u => {
                const pass = u.password || u.clave || '';
                const esPlana = (pass === "Caj@2026test" || pass === "Adm@2026test");
                const esHashValido = regexHash.test(pass) || regexBcrypt.test(pass);

                if (esPlana || !esHashValido) {
                    todasCifradas = false;
                }
                detalles.push(`${u.usuario}: hash_valido=${esHashValido}, texto_plano=${esPlana}`);
            });

            return {
                ok: todasCifradas,
                esperado: "Contraseñas no planas con formato hash (SHA-256 o bcrypt >= 32 chars)",
                obtenido: todasCifradas ? "Todas las contraseñas almacenadas como hash" : "Contraseña en texto plano detectada",
                evidencia: detalles.join("; ")
            };
        }
    },
    {
        id: "CP-006",
        titulo: "Control de acceso por rol a funciones administrativas (RBAC)",
        modulo: "Seguridad",
        requisito: "RF01 / RNF01",
        prioridad: "Alta",
        tipo: "Unitaria / Seguridad",
        automatizable: true,
        run: async ({ adapter }) => {
            const cajeroTarifas = adapter.puedeAcceder("cajero", "tarifas");
            const cajeroUsuarios = adapter.puedeAcceder("cajero", "usuarios");
            const cajeroVaciado = adapter.puedeAcceder("cajero", "vaciado");
            const cajeroRegistrar = adapter.puedeAcceder("cajero", "registrar");

            const adminTarifas = adapter.puedeAcceder("administrador", "tarifas");
            const adminUsuarios = adapter.puedeAcceder("administrador", "usuarios");
            const adminVaciado = adapter.puedeAcceder("administrador", "vaciado");

            const ok = (!cajeroTarifas && !cajeroUsuarios && !cajeroVaciado && cajeroRegistrar &&
                        adminTarifas && adminUsuarios && adminVaciado);

            return {
                ok,
                esperado: "Cajero restringido en tarifas/usuarios/vaciado; Administrador autorizado",
                obtenido: {
                    cajero: { tarifas: cajeroTarifas, usuarios: cajeroUsuarios, vaciado: cajeroVaciado, registrar: cajeroRegistrar },
                    admin: { tarifas: adminTarifas, usuarios: adminUsuarios, vaciado: adminVaciado }
                },
                evidencia: "Matriz RBAC validada: cajero bloqueado en funciones administrativas críticas.",
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-007",
        titulo: "Cambio de sesión conserva registro y respeta permisos por rol",
        modulo: "Autenticación",
        requisito: "RF01 / RNF06",
        prioridad: "Media",
        tipo: "Integración",
        automatizable: true,
        run: async ({ db, adapter, readTestDb }) => {
            // 1. Sesión Cajero: registra ingreso
            const resIngreso = db.registrarEntrada("ABC123", "CARRO", "fraccion");
            if (!resIngreso.exito) return { ok: false, esperado: "Ingreso exitoso", obtenido: resIngreso };

            // 2. Transición a Administrador: consulta y verifica integridad
            const authAdmin = adapter.validarCredenciales("admin_test", "Adm@2026test");
            const dataAdmin = readTestDb();
            const existeRegistroEnAdmin = dataAdmin.registros.some(r => r.placa === "ABC123");
            const adminPuedeTarifas = adapter.puedeAcceder(authAdmin.rol, "tarifas");

            // 3. Transición de regreso a Cajero: verifica permisos y persistencia
            const authCajero = adapter.validarCredenciales("cajero_test", "Caj@2026test");
            const cajeroPuedeTarifas = adapter.puedeAcceder(authCajero.rol, "tarifas");
            const dataCajero = readTestDb();
            const existeRegistroEnCajero = dataCajero.registros.some(r => r.placa === "ABC123");

            const ok = existeRegistroEnAdmin && existeRegistroEnCajero && adminPuedeTarifas && !cajeroPuedeTarifas;
            return {
                ok,
                esperado: "Registro ABC123 intacto a través de cambios de sesión y roles respetados",
                obtenido: { registroConservado: existeRegistroEnCajero, adminAcceso: adminPuedeTarifas, cajeroAcceso: cajeroPuedeTarifas },
                evidencia: "Transición Cajero -> Admin -> Cajero validada sin fuga de permisos ni pérdida de registros.",
                usando_stub: adapter.usando_stub
            };
        }
    },

    // =========================================================================
    // MÓDULO: INGRESOS Y SALIDAS
    // =========================================================================
    {
        id: "CP-008",
        titulo: "Registro ingreso carro fracción con generación de ticket visual",
        modulo: "Ingresos y salidas",
        requisito: "RF02",
        prioridad: "Alta",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere UI gráfica con formulario de registro, emulación de click y verificación visual del modal del ticket impreso."
    },
    {
        id: "CP-009",
        titulo: "Registro ingreso moto fracción con comprobante impreso",
        modulo: "Ingresos y salidas",
        requisito: "RF02",
        prioridad: "Alta",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere interfaz gráfica de usuario (UI), renderizado de componentes DOM y control de servicio de impresión."
    },
    {
        id: "CP-010",
        titulo: "Normalizar placa vehicular (mayúsculas, sin espacios ni guiones)",
        modulo: "Ingresos y salidas",
        requisito: "RF02",
        prioridad: "Alta",
        tipo: "Unitaria automatizada (Jest / Node.js)",
        automatizable: true,
        run: async ({ adapter }) => {
            const entradas = [" abc 123 ", "abc123", "AbC123", "ABC-123"];
            const resultados = entradas.map(e => adapter.normalizarPlaca(e));
            const todasABC123 = resultados.every(r => r === "ABC123");

            const motoNorm = adapter.normalizarPlaca("  xyz-98e ");
            const ok = todasABC123 && (motoNorm === "XYZ98E");

            return {
                ok,
                esperado: "ABC123 para todas las variantes de carro y XYZ98E para moto",
                obtenido: { variantes: resultados, moto: motoNorm },
                evidencia: `Normalización probada con 5 formatos de entrada. Salidas: ${resultados.join(', ')}, ${motoNorm}.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-011",
        titulo: "Manejar placa duplicada ya dentro del parqueadero",
        modulo: "Ingresos y salidas",
        requisito: "RF02",
        prioridad: "Alta",
        tipo: "Funcional",
        automatizable: true,
        run: async ({ db, readTestDb }) => {
            const primerIngreso = db.registrarEntrada("ABC123", "CARRO", "fraccion");
            const segundoIngreso = db.registrarEntrada("ABC123", "CARRO", "fraccion");

            const data = readTestDb();
            const registrosABC123 = data.registros.filter(r => r.placa === "ABC123" && !r.salida);

            const ok = primerIngreso.exito === true &&
                       segundoIngreso.exito === false &&
                       segundoIngreso.mensaje.toLowerCase().includes("ya se encuentra") &&
                       registrosABC123.length === 1;

            return {
                ok,
                esperado: "Primer ingreso: éxito; Segundo ingreso: rechazado con mensaje amigable; 1 registro activo",
                obtenido: { primerIngreso: primerIngreso.exito, segundoIngreso: segundoIngreso.exito, mensaje: segundoIngreso.mensaje, activos: registrosABC123.length },
                evidencia: `Bloqueo exitoso de duplicado. Mensaje: '${segundoIngreso.mensaje}'. Registros activos: ${registrosABC123.length}.`
            };
        }
    },
    {
        id: "CP-012",
        titulo: "Rechazar placa vacía o con formato inválido",
        modulo: "Ingresos y salidas",
        requisito: "RF02",
        prioridad: "Media",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ adapter }) => {
            const invalidas = ["", "   ", "AB", "ABCDEFGHIJ", "@@#123"];
            const validas = ["ABC123", "ABC12D"];

            const fallanInvalidas = invalidas.every(p => adapter.validarPlaca(p) === false);
            const pasanValidas = validas.every(p => adapter.validarPlaca(p) === true);

            const ok = fallanInvalidas && pasanValidas;
            return {
                ok,
                esperado: "false para las 5 inválidas; true para placas estándar colombianas (ABC123, ABC12D)",
                obtenido: { fallanInvalidas, pasanValidas },
                evidencia: `Evaluadas ${invalidas.length} placas inválidas y ${validas.length} válidas con regex estándar.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-013",
        titulo: "Registro ingreso carro servicio Día desde interfaz de usuario",
        modulo: "Ingresos y salidas",
        requisito: "RF02 / RF03",
        prioridad: "Media",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere interacción con selectores desplegables HTML (select/options) y validación visual de formulario UI."
    },
    {
        id: "CP-014",
        titulo: "Exigencia de datos de cliente al seleccionar servicio mensualidad en formulario UI",
        modulo: "Clientes",
        requisito: "RF02 / RF05",
        prioridad: "Alta",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere interacción con inputs dinámicos en pantalla, validación de foco y estados visuales del DOM."
    },

    // =========================================================================
    // MÓDULO: FACTURACIÓN Y TARIFAS
    // =========================================================================
    {
        id: "CP-015",
        titulo: "Cobrar fracción dentro de la tolerancia de 6 minutos",
        modulo: "Facturación y tarifas",
        requisito: "RF04",
        prioridad: "Alta",
        tipo: "Unitaria automatizada (Jest / Node.js)",
        automatizable: true,
        run: async ({ adapter, readTestDb }) => {
            const { tarifas } = readTestDb();
            // Precondición: Fracción carro = $3.000, unidad = 60 min, tolerancia = 6 min
            const cobro60m = adapter.calcularTarifa("CARRO", "fraccion", 60, tarifas, 60);
            const cobro65m = adapter.calcularTarifa("CARRO", "fraccion", 65, tarifas, 60);
            const cobro66m = adapter.calcularTarifa("CARRO", "fraccion", 66, tarifas, 60);

            const ok = (cobro60m === 3000) && (cobro65m === 3000) && (cobro66m === 3000);
            return {
                ok,
                esperado: "60m: $3.000, 65m: $3.000, 66m: $3.000 (tolerancia exacta de 6 minutos)",
                obtenido: { "60m": cobro60m, "65m": cobro65m, "66m": cobro66m },
                evidencia: `Tolerancia de 6 minutos validada: 60m=$${cobro60m}, 65m=$${cobro65m}, 66m=$${cobro66m}.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-016",
        titulo: "Cobro de fracción adicional al superar la tolerancia de 6 minutos",
        modulo: "Facturación y tarifas",
        requisito: "RF04",
        prioridad: "Alta",
        tipo: "Unitaria automatizada (Jest / Node.js)",
        automatizable: true,
        run: async ({ adapter, readTestDb }) => {
            const { tarifas } = readTestDb();
            // 1h07m (67 min) -> 2 fracciones ($6.000)
            const cobro67m = adapter.calcularTarifa("CARRO", "fraccion", 67, tarifas, 60);
            // 2h06m (126 min) -> 2 fracciones ($6.000, dentro de tolerancia de 2da fracción)
            const cobro126m = adapter.calcularTarifa("CARRO", "fraccion", 126, tarifas, 60);
            // 2h07m (127 min) -> 3 fracciones ($9.000, superó tolerancia de 2da fracción)
            const cobro127m = adapter.calcularTarifa("CARRO", "fraccion", 127, tarifas, 60);

            const ok = (cobro67m === 6000) && (cobro126m === 6000) && (cobro127m === 9000);
            return {
                ok,
                esperado: "67m: $6.000 (2 frac), 126m: $6.000 (2 frac), 127m: $9.000 (3 frac)",
                obtenido: { "67m": cobro67m, "126m": cobro126m, "127m": cobro127m },
                evidencia: `Superación de tolerancia de 6 minutos validada: 67m=$${cobro67m}, 126m=$${cobro126m}, 127m=$${cobro127m}.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-017",
        titulo: "Cobrar servicio por día según el tipo de vehículo",
        modulo: "Facturación y tarifas",
        requisito: "RF04",
        prioridad: "Alta",
        tipo: "Funcional / Tabla de decisión",
        automatizable: true,
        run: async ({ adapter, readTestDb }) => {
            const { tarifas } = readTestDb();
            const cobroCarroDia = adapter.calcularTarifa("CARRO", "dia", 480, tarifas);
            const cobroMotoDia = adapter.calcularTarifa("MOTO", "dia", 480, tarifas);

            const ok = (cobroCarroDia === 15000) && (cobroMotoDia === 8000);
            return {
                ok,
                esperado: "DEF456 (Carro, Día): $15.000; XYZ98E (Moto, Día): $8.000",
                obtenido: { carroDia: cobroCarroDia, motoDia: cobroMotoDia },
                evidencia: `Tarifa día plana validada: Carro=$${cobroCarroDia}, Moto=$${cobroMotoDia}.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-018",
        titulo: "Flujo completo de ingreso, búsqueda con espacios/minúsculas y liquidación",
        modulo: "Facturación y tarifas",
        requisito: "RF02 / RF04",
        prioridad: "Alta",
        tipo: "Integración",
        automatizable: true,
        run: async ({ db, readTestDb, writeTestDb }) => {
            // 1. Ingreso con placa estándar
            const resIngreso = db.registrarEntrada("ABC123", "CARRO", "fraccion");
            if (!resIngreso.exito) return { ok: false, esperado: "Ingreso exitoso", obtenido: resIngreso };

            // Simular entrada hace 1 hora y 7 minutos (67 minutos atrás)
            const data = readTestDb();
            const regIndex = data.registros.findIndex(r => r.placa === "ABC123" && !r.salida);
            const fechaEntradaSimulada = new Date(Date.now() - 67 * 60 * 1000).toISOString();
            data.registros[regIndex].entrada = fechaEntradaSimulada;
            writeTestDb(data);

            // 2. Liquidación de salida buscando con placa con espacios y minúsculas
            const fechaSalidaActual = new Date().toISOString();
            const resSalida = db.registrarSalida("  abc123  ", fechaSalidaActual);

            const dataFinal = readTestDb();
            const regFinal = dataFinal.registros.find(r => r.placa === "ABC123");

            const ok = resSalida.exito === true &&
                       resSalida.datosCobro.cobro === 6000 &&
                       regFinal.salida !== null &&
                       (regFinal.estado === "Salida" || regFinal.salida);

            return {
                ok,
                esperado: "Encuentra registro '  abc123  ', calcula cobro $6.000 (67 min) y pasa a Salida",
                obtenido: { exito: resSalida.exito, cobro: resSalida.datosCobro ? resSalida.datosCobro.cobro : null, estado: regFinal ? regFinal.estado : null },
                evidencia: `Flujo completo validado: cobro=$${resSalida.datosCobro.cobro}, permanencia=${resSalida.datosCobro.tiempoPermanencia}.`
            };
        }
    },
    {
        id: "CP-019",
        titulo: "Buscar placa inexistente en salida (QWE111)",
        modulo: "Facturación y tarifas",
        requisito: "RF04",
        prioridad: "Media",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ db }) => {
            let errorLanzado = null;
            let resultado = null;

            try {
                resultado = db.registrarSalida("QWE111");
            } catch (err) {
                errorLanzado = err;
            }

            const ok = errorLanzado === null &&
                       resultado !== null &&
                       resultado.exito === false &&
                       resultado.mensaje.toLowerCase().includes("no encontrado");

            return {
                ok,
                esperado: "exito: false, mensaje: 'Vehículo no encontrado', sin excepción no controlada",
                obtenido: { resultado, errorLanzado: errorLanzado ? errorLanzado.message : null },
                evidencia: `Búsqueda controlada de placa inexistente. Mensaje retornado: '${resultado ? resultado.mensaje : ''}'.`
            };
        }
    },
    {
        id: "CP-020",
        titulo: "Salida de vehículo con mensualidad vigente JKL222 ($0)",
        modulo: "Facturación y tarifas",
        requisito: "RF04 / RF05",
        prioridad: "Alta",
        tipo: "Integración",
        automatizable: true,
        run: async ({ db, readTestDb, writeTestDb }) => {
            // JKL222 está registrada en fixtures con mensualidad Activa
            const resIngreso = db.registrarEntrada("JKL222", "CARRO", "mensualidad");
            if (!resIngreso.exito) return { ok: false, esperado: "Ingreso exitoso", obtenido: resIngreso };

            // Simular permanencia de 3 horas
            const data = readTestDb();
            const idx = data.registros.findIndex(r => r.placa === "JKL222" && !r.salida);
            data.registros[idx].entrada = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
            writeTestDb(data);

            const resSalida = db.registrarSalida("JKL222");
            const dataFinal = readTestDb();
            const regFinal = dataFinal.registros.find(r => r.placa === "JKL222");

            const ok = resSalida.exito === true &&
                       resSalida.datosCobro.cobro === 0 &&
                       regFinal.salida !== null;

            return {
                ok,
                esperado: "Total cobrado $0, registro marcado con salida y cliente con suscripción vigente respetado",
                obtenido: { cobro: resSalida.datosCobro ? resSalida.datosCobro.cobro : null, estado: regFinal ? regFinal.estado : null },
                evidencia: `Cliente mensual JKL222 liquidado a tarifa $${resSalida.datosCobro.cobro}.`
            };
        }
    },

    // =========================================================================
    // MÓDULO: GESTIÓN DE CLIENTES FRECUENTES
    // =========================================================================
    {
        id: "CP-021",
        titulo: "Registrar cliente con mensualidad y calcular vigencia (+30 días)",
        modulo: "Clientes",
        requisito: "RF05",
        prioridad: "Alta",
        tipo: "Funcional",
        automatizable: true,
        run: async ({ db }) => {
            const hoy = new Date();
            const nuevoClienteData = {
                nombre: "Carlos Rodriguez",
                cedula: "1098765432",
                telefono: "3159998877",
                placa: "GHI789",
                servicio: "mensualidad"
            };

            const resultado = db.registrarCliente(nuevoClienteData);
            if (!resultado.exito) return { ok: false, esperado: "Cliente registrado", obtenido: resultado };

            const cliente = resultado.cliente;
            const diffDias = Math.round((new Date(cliente.fechaVencimiento) - new Date(cliente.fechaInicio)) / (1000 * 60 * 60 * 24));

            const ok = cliente.estado === "Activo" &&
                       cliente.cedula === "1098765432" &&
                       (diffDias >= 29 && diffDias <= 31); // Regla +30 días

            return {
                ok,
                esperado: "Cliente registrado con estado 'Activo' y vigencia calculada a +30 días",
                obtenido: { estado: cliente.estado, diasVigencia: diffDias, vencimiento: cliente.fechaVencimiento },
                evidencia: `Cliente registrado: cédula ${cliente.cedula}, vigencia calculada en ${diffDias} días.`
            };
        }
    },
    {
        id: "CP-022",
        titulo: "Actualizar estado de suscripción al vencer (fecha anterior a hoy)",
        modulo: "Clientes",
        requisito: "RF05",
        prioridad: "Alta",
        tipo: "Funcional",
        automatizable: true,
        run: async ({ db, adapter, readTestDb, writeTestDb }) => {
            // Supuesto del plan: Se elige 'Inactivo' como estado definitivo para suscripciones vencidas.
            const data = readTestDb();
            // Inyectar un cliente con vencimiento ayer
            const clienteVencido = {
                id: "test_vencido_99",
                nombre: "Cliente Vencido Ayer",
                cedula: "1000000099",
                telefono: "3009990099",
                placa: "OLD999",
                servicio: "mensualidad",
                estado: "Activo", // Aún marcado Activo en BD
                fechaInicio: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
                fechaVencimiento: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Venció ayer
            };
            data.clientes.push(clienteVencido);
            writeTestDb(data);

            // Ejecutar actualización
            adapter.actualizarSuscripcionesVencidas();

            const dataPost = readTestDb();
            const clientePost = dataPost.clientes.find(c => c.cedula === "1000000099");

            const ok = clientePost && clientePost.estado === "Inactivo";
            return {
                ok,
                esperado: "Cliente con fechaVencimiento anterior a hoy transiciona de 'Activo' a 'Inactivo'",
                obtenido: { estadoAnterior: "Activo", estadoActual: clientePost ? clientePost.estado : null },
                evidencia: `Cliente con vencimiento ayer pasó a estado '${clientePost ? clientePost.estado : ''}'.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-023",
        titulo: "Reconocer placas JKL222 (mensualidad) y MNO333 (media) en ingreso",
        modulo: "Clientes",
        requisito: "RF02 / RF05",
        prioridad: "Alta",
        tipo: "Integración",
        automatizable: true,
        run: async ({ db, readTestDb }) => {
            // Ingresar JKL222 y MNO333 sin especificar servicio manual
            const res1 = db.registrarEntrada("JKL222", "CARRO");
            const res2 = db.registrarEntrada("MNO333", "CARRO");

            const data = readTestDb();
            const reg1 = data.registros.find(r => r.placa === "JKL222");
            const reg2 = data.registros.find(r => r.placa === "MNO333");

            const ok = res1.exito && res2.exito &&
                       reg1 && reg1.tipoServicio.toLowerCase().includes("mensualidad") &&
                       reg2 && reg2.tipoServicio.toLowerCase().includes("media");

            return {
                ok,
                esperado: "JKL222 asociado a mensualidad; MNO333 asociado a media mensualidad",
                obtenido: { JKL222_servicio: reg1 ? reg1.tipoServicio : null, MNO333_servicio: reg2 ? reg2.tipoServicio : null },
                evidencia: `Reconocimiento automático de placas frecuentes: JKL222=${reg1 ? reg1.tipoServicio : ''}, MNO333=${reg2 ? reg2.tipoServicio : ''}.`
            };
        }
    },
    {
        id: "CP-024",
        titulo: "Rechazar cliente con cédula duplicada, campos vacíos o teléfono con letras",
        modulo: "Clientes",
        requisito: "RF05",
        prioridad: "Media",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ db }) => {
            // a) Cédula duplicada (1000000001 ya existe en fixture)
            const resDuplicada = db.registrarCliente({
                nombre: "Duplicado Test",
                cedula: "1000000001",
                telefono: "3001112233",
                placa: "DUP001"
            });

            // b) Campos obligatorios vacíos
            const resVacio = db.registrarCliente({
                nombre: "",
                cedula: "",
                telefono: "3001112233"
            });

            // c) Teléfono con letras
            const resTelefonoInvalido = db.registrarCliente({
                nombre: "Telefono Malo",
                cedula: "1099887766",
                telefono: "300ABC1234"
            });

            const ok = (resDuplicada.exito === false) &&
                       (resVacio.exito === false) &&
                       (resTelefonoInvalido.exito === false);

            return {
                ok,
                esperado: "Rechazo controlado en los 3 casos (cédula duplicada, campos vacíos, teléfono alfanumérico)",
                obtenido: { duplicada: resDuplicada.exito, vacio: resVacio.exito, telInvalido: resTelefonoInvalido.exito },
                evidencia: `Validaciones ejecutadas: Duplicada='${resDuplicada.mensaje}', Vacíos='${resVacio.mensaje}', Teléfono='${resTelefonoInvalido.mensaje}'.`
            };
        }
    },

    // =========================================================================
    // MÓDULO: REPORTES, CIERRE Y VACIADO
    // =========================================================================
    {
        id: "CP-025",
        titulo: "Consulta de historial de movimientos con filtros en UI",
        modulo: "Reportes",
        requisito: "RF06",
        prioridad: "Media",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere interacción con filtros de búsqueda por rango de fechas, selectores de estado en interfaz gráfica y paginación DOM."
    },
    {
        id: "CP-026",
        titulo: "Consulta de clientes con estado pendiente o vencido en vista UI",
        modulo: "Clientes",
        requisito: "RF05 / RF06",
        prioridad: "Media",
        tipo: "Funcional UI",
        automatizable: false,
        razon_no_automatizable: "Requiere renderizado de tabla de clientes en interfaz de usuario, badges visuales de estado y navegación gráfica."
    },
    {
        id: "CP-027",
        titulo: "Cierre de caja y cálculo de arqueo diario manual",
        modulo: "Reportes",
        requisito: "RF07",
        prioridad: "Alta",
        tipo: "Operacional / Físico",
        automatizable: false,
        razon_no_automatizable: "Involucra conteo físico de efectivo en ventanilla, arqueo manual con billetes y cuadre visual por el cajero humano."
    },
    {
        id: "CP-028",
        titulo: "Exportación de reporte de cierre de caja a documento PDF",
        modulo: "Reportes",
        requisito: "RF07",
        prioridad: "Media",
        tipo: "Integración UI / Print",
        automatizable: false,
        razon_no_automatizable: "Requiere integración con APIs de impresión nativas de Chromium (printToPDF) y verificación visual del layout del documento PDF generado."
    },
    {
        id: "CP-029",
        titulo: "Vaciado de registros diarios conservando clientes y tarifas (con backup)",
        modulo: "Reportes",
        requisito: "RF07 / RF05",
        prioridad: "Alta",
        tipo: "Integración / Persistencia",
        automatizable: true,
        run: async ({ db, adapter, backupTestDb, readTestDb }) => {
            // 1. Insertar registros diarios de rotación
            db.registrarEntrada("ABC123", "CARRO", "fraccion");
            db.registrarEntrada("DEF456", "CARRO", "dia");

            // 2. Realizar backup preventivo
            const backupCreado = backupTestDb();

            const dataPrevia = readTestDb();
            const registrosPrevios = dataPrevia.registros.length;
            const clientesPrevios = dataPrevia.clientes.length;

            // 3. Ejecutar vaciado con contraseña autorizada
            const resVaciado = adapter.aplicarVaciado("Adm@2026test");

            // 4. Verificar integridad post-vaciado
            const dataPost = readTestDb();

            const ok = backupCreado &&
                       resVaciado.exito === true &&
                       registrosPrevios === 2 &&
                       dataPost.registros.length === 0 &&
                       dataPost.clientes.length === clientesPrevios &&
                       dataPost.tarifas !== undefined;

            return {
                ok,
                esperado: "Backup creado, registros eliminados (0), clientes frecuentes intactos (2) y tarifas conservadas",
                obtenido: { backup: backupCreado, vaciado: resVaciado.exito, registrosPost: dataPost.registros.length, clientesPost: dataPost.clientes.length },
                evidencia: `Vaciado completado: ${registrosPrevios} registros eliminados, ${dataPost.clientes.length} clientes y tarifas preservadas.`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-030",
        titulo: "Rechazar vaciado con contraseña administrativa incorrecta",
        modulo: "Seguridad",
        requisito: "RF07 / RNF01",
        prioridad: "Alta",
        tipo: "Funcional negativa / Seguridad",
        automatizable: true,
        run: async ({ db, adapter, readTestDb }) => {
            db.registrarEntrada("ABC123", "CARRO", "fraccion");
            const dataAntes = readTestDb();

            const resVaciado = adapter.aplicarVaciado("Incorrecta123");
            const dataDespues = readTestDb();

            const ok = resVaciado.exito === false &&
                       dataDespues.registros.length === dataAntes.registros.length;

            return {
                ok,
                esperado: "Rechaza con exito: false y registros en db.test.json intactos",
                obtenido: { exito: resVaciado.exito, mensaje: resVaciado.mensaje, registrosIntactos: dataDespues.registros.length },
                evidencia: `Intento de vaciado no autorizado rechazado: '${resVaciado.mensaje}'. Registros conservados.`,
                usando_stub: adapter.usando_stub
            };
        }
    },

    // =========================================================================
    // MÓDULO: GESTIÓN DE TARIFAS
    // =========================================================================
    {
        id: "CP-031",
        titulo: "Actualización de tarifas en caliente y aplicación inmediata sin reinicio",
        modulo: "Facturación y tarifas",
        requisito: "RF08 / RNF06",
        prioridad: "Alta",
        tipo: "Integración en caliente",
        automatizable: true,
        run: async ({ db, readTestDb, writeTestDb }) => {
            // 1. Modificar tarifa de fracción de carro en caliente a $3.500
            const data = readTestDb();
            data.tarifas.CARRO.fraccion = 3500;
            data.tarifas.carro.fraccion = 3500;
            writeTestDb(data);

            // 2. Registrar ingreso de vehículo y liquidación con 1h00 (60 min)
            db.registrarEntrada("ABC123", "CARRO", "fraccion");

            // Simular permanencia de 60 minutos
            const dataActual = readTestDb();
            const idx = dataActual.registros.findIndex(r => r.placa === "ABC123" && !r.salida);
            dataActual.registros[idx].entrada = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            writeTestDb(dataActual);

            // Liquidar cobro en la misma instancia activa sin reiniciar proceso
            const resSalida = db.registrarSalida("ABC123");
            const dataPersistida = readTestDb();

            const ok = resSalida.exito === true &&
                       resSalida.datosCobro.cobro === 3500 &&
                       dataPersistida.tarifas.CARRO.fraccion === 3500;

            return {
                ok,
                esperado: "Cobro liquidado a $3.500 y tarifa persistida en db.test.json sin reinicio",
                obtenido: { cobro: resSalida.datosCobro ? resSalida.datosCobro.cobro : null, tarifaPersistida: dataPersistida.tarifas.CARRO.fraccion },
                evidencia: `Tarifa actualizada a $3.500 reflejada inmediatamente en liquidación (cobro: $${resSalida.datosCobro ? resSalida.datosCobro.cobro : 0}).`
            };
        }
    },
    {
        id: "CP-032",
        titulo: "Rechazar valores de tarifa inválidos (0, negativos, strings no numéricos)",
        modulo: "Facturación y tarifas",
        requisito: "RF08",
        prioridad: "Media",
        tipo: "Funcional negativa",
        automatizable: true,
        run: async ({ adapter }) => {
            const valoresInvalidos = [0, -1000, "abc", "", null, undefined];
            const valoresValidos = [3000, "15000"];

            const todosInvalidosRechazados = valoresInvalidos.every(v => adapter.validarTarifa(v) === false);
            const todosValidosAceptados = valoresValidos.every(v => adapter.validarTarifa(v) === true);

            const ok = todosInvalidosRechazados && todosValidosAceptados;
            return {
                ok,
                esperado: "false para 0, negativos y cadenas vacías/no numéricas; true para números positivos",
                obtenido: { invalidosRechazados: todosInvalidosRechazados, validosAceptados: todosValidosAceptados },
                evidencia: `Evaluados ${valoresInvalidos.length} valores inválidos y ${valoresValidos.length} válidos.`,
                usando_stub: adapter.usando_stub
            };
        }
    },

    // =========================================================================
    // MÓDULO: RENDIMIENTO, CONFIABILIDAD Y USABILIDAD
    // =========================================================================
    {
        id: "CP-033",
        titulo: "Rendimiento bajo carga de 500 registros (< 2.000 ms)",
        modulo: "Rendimiento",
        requisito: "RNF02",
        prioridad: "Alta",
        tipo: "No funcional / Rendimiento",
        automatizable: true,
        run: async ({ db, adapter, readTestDb, writeTestDb }) => {
            // Nota técnica: Se mide el tiempo de ejecución en cálculo de negocio y persistencia en disco local (sin UI).
            const data = readTestDb();
            const fechaBase = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Generar 500 registros sintéticos en la base de datos de prueba
            for (let i = 1; i <= 500; i++) {
                const pad = String(i).padStart(4, '0');
                data.registros.push({
                    id: `perf_${i}`,
                    placa: `PRF${pad.substring(1)}`,
                    tipoVehiculo: (i % 2 === 0) ? "CARRO" : "MOTO",
                    tipoServicio: (i % 3 === 0) ? "dia" : "fraccion",
                    entrada: new Date(fechaBase.getTime() + i * 60000).toISOString(),
                    salida: new Date(fechaBase.getTime() + (i + 60) * 60000).toISOString(),
                    tiempoPermanencia: "1h 0m",
                    cobro: (i % 2 === 0) ? 3000 : 1500,
                    estado: "Salida"
                });
            }
            writeTestDb(data);

            // Medir 20 inserciones y 20 cobros
            const tiemposOperaciones = [];
            const tInicioTotal = Date.now();

            for (let k = 1; k <= 20; k++) {
                const t0 = Date.now();
                // Inserción
                db.registrarEntrada(`TST${String(k).padStart(3, '0')}`, "CARRO", "fraccion");
                // Cobro
                adapter.calcularTarifa("CARRO", "fraccion", 65 + k, data.tarifas);
                const tDelta = Date.now() - t0;
                tiemposOperaciones.push(tDelta);
            }

            const tTotal = Date.now() - tInicioTotal;
            const tPromedio = tiemposOperaciones.reduce((a, b) => a + b, 0) / tiemposOperaciones.length;
            const tMaximo = Math.max(...tiemposOperaciones);

            const ok = (tPromedio < 2000) && (tMaximo < 2000);
            return {
                ok,
                esperado: "Tiempo promedio < 2.000 ms y tiempo máximo < 2.000 ms bajo carga de 500 registros",
                obtenido: { tiempoTotalMs: tTotal, promedioMs: tPromedio.toFixed(2), maximoMs: tMaximo },
                evidencia: `Carga: 500 registros existentes. 20 ciclos de ingreso y liquidación: promedio=${tPromedio.toFixed(2)}ms, max=${tMaximo}ms (<2.000ms).`,
                usando_stub: adapter.usando_stub
            };
        }
    },
    {
        id: "CP-034",
        titulo: "Persistencia de datos y tolerancia a fallos ante cierre abrupto del proceso",
        modulo: "Confiabilidad",
        requisito: "RNF04 / RNF06",
        prioridad: "Alta",
        tipo: "No funcional / Confiabilidad",
        automatizable: true,
        run: async ({ db, createDbInstance, readTestDb }) => {
            // Nota metodológica: Se valida que la escritura síncrona en disco persista el dato
            // de forma atómica antes de la terminación abrupta (kill lógico), garantizando
            // que una nueva instancia en frío lea el estado íntegro sin corrupción ni duplicados.
            const resEntrada = db.registrarEntrada("CRASH01", "CARRO", "fraccion");
            if (!resEntrada.exito) return { ok: false, esperado: "Registro exitoso", obtenido: resEntrada };

            // Simulación de "kill" y arranque en frío: instanciar nueva conexión sin contexto en memoria
            const dbReabierta = createDbInstance();
            const dataRecuperada = dbReabierta.obtenerDatos();

            const registroPersistido = dataRecuperada.registros.filter(r => r.placa === "CRASH01");
            const ok = registroPersistido.length === 1 && registroPersistido[0].salida === null;

            return {
                ok,
                esperado: "Registro 'CRASH01' recuperado intacto en disco sin duplicados tras cierre abrupto simulado",
                obtenido: { recuperado: registroPersistido.length === 1, placa: registroPersistido[0] ? registroPersistido[0].placa : null },
                evidencia: `Persistencia síncrona validada en 'db.test.json'. Registro CRASH01 intacto en arranque en frío.`
            };
        }
    },
    {
        id: "CP-035",
        titulo: "Tolerancia a fallos: manejo seguro de db.json ausente o corrupto",
        modulo: "Confiabilidad",
        requisito: "RNF04 / RNF06",
        prioridad: "Media",
        tipo: "No funcional / Manejo de excepciones",
        automatizable: true,
        run: async ({ TEST_DB_PATH, createDbInstance }) => {
            // Caso A: Archivo eliminado físicamente
            if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
            const dbAusente = createDbInstance();
            const datosAusente = dbAusente.obtenerDatos();
            const recreadoSeguro = fs.existsSync(TEST_DB_PATH) && Array.isArray(datosAusente.usuarios);

            // Caso B: JSON corrupto / malformado
            fs.writeFileSync(TEST_DB_PATH, '{"corrupto": true, "usuarios": [ malformado ', 'utf-8');
            const dbCorrupto = createDbInstance();
            const datosCorrupto = dbCorrupto.obtenerDatos();
            const manejadoSinCrash = (datosCorrupto.corrupto === true) && (datosCorrupto.error !== undefined);

            const ok = recreadoSeguro && manejadoSinCrash;
            return {
                ok,
                esperado: "Caso A: Recrea base de datos segura. Caso B: Captura error de sintaxis JSON sin colapso del proceso",
                obtenido: { recreadoSeguro, manejadoSinCrash },
                evidencia: `Caso A (ausente): recreada exitosamente. Caso B (corrupto): error capturado (corrupto=${datosCorrupto.corrupto}).`
            };
        }
    },
    {
        id: "CP-036",
        titulo: "Evaluación de usabilidad de la interfaz con cajero humano",
        modulo: "Usabilidad",
        requisito: "RNF03",
        prioridad: "Baja",
        tipo: "Evaluación de UX / Humana",
        automatizable: false,
        razon_no_automatizable: "Requiere observación cualitativa, cronometraje de operario humano en taquilla y evaluación subjetiva de satisfacción de usuario (UX)."
    },
    {
        id: "CP-037",
        titulo: "Instalación y despliegue en equipo limpio Windows 10/11",
        modulo: "Instalación",
        requisito: "RNF05",
        prioridad: "Media",
        tipo: "Instalación / SO",
        automatizable: false,
        razon_no_automatizable: "Requiere aprovisionamiento de máquina virtual o equipo físico limpio de Windows 10/11 sin Node.js preinstalado y verificación de instalador ejecutable (.exe)."
    }
];

module.exports = {
    CASOS_DE_PRUEBA
};

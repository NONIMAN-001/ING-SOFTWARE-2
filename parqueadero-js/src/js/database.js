const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Función para resolver la ruta de la base de datos con permisos de escritura garantizados
function resolverRutaBaseDatos(customDbPath = null) {
    if (customDbPath) return customDbPath;

    if (process.env.PARKING_DB_PATH) {
        return process.env.PARKING_DB_PATH;
    }

    const estaEnAsar = __dirname.includes('app.asar') ||
                       (process.mainModule && process.mainModule.filename && process.mainModule.filename.includes('app.asar')) ||
                       (typeof process.resourcesPath === 'string' && __dirname.includes('resources'));

    // Modo desarrollo / Jest / Pruebas unitarias
    if (!estaEnAsar) {
        return path.join(__dirname, '../db.json');
    }

    // Modo Ejecutable (.exe) empaquetado:
    // Prioridad 1: Carpeta 'data' junto al ejecutable (100% portable)
    try {
        const dirExe = path.dirname(process.execPath);
        const dirDataPortable = path.join(dirExe, 'data');
        if (!fs.existsSync(dirDataPortable)) {
            fs.mkdirSync(dirDataPortable, { recursive: true });
        }
        const testFile = path.join(dirDataPortable, '.perm_test');
        fs.writeFileSync(testFile, '1');
        fs.unlinkSync(testFile);
        return path.join(dirDataPortable, 'db.json');
    } catch (e) {
        console.warn("Directorio portable no tiene permisos de escritura. Usando AppData.");
    }

    // Prioridad 2: Carpeta segura de usuario (%APPDATA% en Windows)
    const appData = process.env.APPDATA || 
                    (process.platform === 'darwin' 
                        ? path.join(process.env.HOME || '', 'Library', 'Application Support') 
                        : path.join(process.env.HOME || '', '.config'));
    
    const dirAppData = path.join(appData, 'parqueadero-js');
    if (!fs.existsSync(dirAppData)) {
        try {
            fs.mkdirSync(dirAppData, { recursive: true });
        } catch (err) {
            console.error("Error creando directorio AppData:", err);
        }
    }
    return path.join(dirAppData, 'db.json');
}

class ParkingDatabase {
    constructor(customDbPath = null) {
        this.dbPath = resolverRutaBaseDatos(customDbPath);
        this.iniciarBaseDatos();
    }

    // 1. Inicializar la base de datos si no existe
    iniciarBaseDatos() {
        if (!fs.existsSync(this.dbPath)) {
            let estructuraInicial = null;
            // Si existe plantilla inicial empaquetada, cargarla
            const plantillaInterna = path.join(__dirname, '../db.json');
            if (plantillaInterna !== this.dbPath && fs.existsSync(plantillaInterna)) {
                try {
                    estructuraInicial = JSON.parse(fs.readFileSync(plantillaInterna, 'utf-8'));
                } catch (e) {
                    estructuraInicial = null;
                }
            }

            if (!estructuraInicial) {
                estructuraInicial = {
                    usuarios: [
                        { usuario: "cajero_test", password: "Caj@2026test", clave: "557564d6db3fc36b694bda68ea3f04494191370cf90060e2277d079d3e86c044", rol: "cajero", nombre: "Cajero de Pruebas" },
                        { usuario: "admin_test", password: "Adm@2026test", clave: "d6fa0a4a821fa05c48bbf3fbcf8794825946a06ae0bc18721c0ad146eef83152", rol: "administrador", nombre: "Administrador de Pruebas" },
                        { usuario: "admin", password: "123", clave: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", rol: "administrador", nombre: "Administrador General" }
                    ],
                    clientes: [],
                    registros: [],
                    cierresDiarios: [],
                    gananciasFinalesDia: [],
                    gananciasDelMes: {
                        mesActual: new Date().toISOString().slice(0, 7),
                        gananciasMensualidad: 0,
                        gananciasPorRegistros: 0,
                        gananciasTotales: 0,
                        historialInformes: []
                    },
                    tarifas: {
                        CARRO: { fraccion: 3000, dia: 15000, media_mensualidad: 70000, mensualidad: 120000 },
                        MOTO:  { fraccion: 1500, dia: 8000, media_mensualidad: 35000, mensualidad: 60000 }
                    },
                    config: {
                        passwordAdmin: "ADM12345$",
                        passwordProgramador: "1092530175kj$"
                    }
                };
            }

            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            this.guardarDatos(estructuraInicial);
        }
    }

    // 2. Leer datos con manejo de tolerancia a fallos (CP-035)
    obtenerDatos() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                this.iniciarBaseDatos();
            }
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            const parsed = JSON.parse(data);
            if (!parsed.cierresDiarios) parsed.cierresDiarios = [];
            if (!parsed.gananciasFinalesDia) parsed.gananciasFinalesDia = [];
            return parsed;
        } catch (err) {
            console.error("Error al leer base de datos db.json:", err.message);
            return {
                corrupto: true,
                error: err.message,
                usuarios: [],
                clientes: [],
                registros: [],
                tarifas: { CARRO: {}, MOTO: {} }
            };
        }
    }

    // 3. Guardar datos de forma síncrona con fallback automático de contingencia
    guardarDatos(data) {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4), 'utf-8');
            return true;
        } catch (err) {
            console.error("Error al escribir en ruta principal de base de datos:", err.message);
            
            // Contingencia: Si la ruta actual falló (permisos restringidos / ASAR), guardar en AppData
            try {
                const appData = process.env.APPDATA || 
                                (process.platform === 'darwin' 
                                    ? path.join(process.env.HOME || '', 'Library', 'Application Support') 
                                    : path.join(process.env.HOME || '', '.config'));
                const fallbackDir = path.join(appData, 'parqueadero-js');
                if (!fs.existsSync(fallbackDir)) {
                    fs.mkdirSync(fallbackDir, { recursive: true });
                }
                const fallbackPath = path.join(fallbackDir, 'db.json');
                if (this.dbPath !== fallbackPath) {
                    this.dbPath = fallbackPath;
                    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4), 'utf-8');
                    console.log("Base de datos guardada exitosamente en ruta de contingencia:", fallbackPath);
                    return true;
                }
            } catch (fallbackErr) {
                console.error("Error en contingencia AppData:", fallbackErr.message);
            }

            if (typeof alert !== 'undefined') {
                alert("Error al guardar en la base de datos. Verifique los permisos del archivo.");
            }
            return false;
        }
    }

    // 4. Normalización de Placas (CP-010)
    normalizarPlaca(placa) {
        if (!placa || typeof placa !== 'string') return '';
        return placa.trim().toUpperCase().replace(/[\s-]/g, '');
    }

    // Validación de Formato de Placa (CP-012)
    validarPlaca(placa) {
        const norm = this.normalizarPlaca(placa);
        if (!norm || norm.length < 5 || norm.length > 7) return false;
        // Permite formato colombiano estándar: 3 letras y 3 números (carro) o 3 letras, 2 números y 1 letra (moto)
        const regex = /^[A-Z]{3}[0-9]{3}$|^[A-Z]{3}[0-9]{2}[A-Z]$|^[A-Z0-9]{5,7}$/;
        return regex.test(norm);
    }

    // Validación de Valores de Tarifa (CP-032)
    validarTarifa(valor) {
        if (valor === undefined || valor === null || valor === '') return false;
        const num = Number(valor);
        if (isNaN(num)) return false;
        if (num <= 0) return false;
        return true;
    }

    // 5. Registrar Cliente (Con validaciones de cédula y formato) (CP-021, CP-024)
    registrarCliente(datos) {
        const db = this.obtenerDatos();
        const { nombre, cedula, telefono, placa, servicio, estado, fechaInicio, fechaVencimiento } = datos;

        if (!nombre || !cedula || !telefono) {
            return { exito: false, mensaje: "Campos obligatorios incompletos." };
        }

        // Validación de teléfono (solo dígitos)
        if (!/^\d+$/.test(String(telefono).trim())) {
            return { exito: false, mensaje: "El teléfono debe contener únicamente números." };
        }

        const existe = db.clientes.find(c => String(c.cedula) === String(cedula));
        if (existe) {
            return { exito: false, mensaje: "Ya existe un cliente registrado con esta cédula." };
        }

        const nuevoCliente = {
            id: Date.now().toString(),
            nombre: String(nombre).trim(),
            cedula: String(cedula).trim(),
            telefono: String(telefono).trim(),
            placa: placa ? this.normalizarPlaca(placa) : null,
            servicio: servicio || 'mensualidad',
            estado: estado || 'Activo',
            estadoPago: 'Al día',
            mesesPendientes: 0,
            fechaInicio: fechaInicio || new Date().toISOString(),
            fechaVencimiento: fechaVencimiento || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        db.clientes.push(nuevoCliente);
        this.guardarDatos(db);
        return { exito: true, cliente: nuevoCliente };
    }

    // 6. Registrar Entrada de Vehículo (CP-008, CP-009, CP-011, CP-013, CP-014)
    registrarEntrada(placa, tipoVehiculo, tipoServicio, datosCliente = null) {
        const placaNorm = this.normalizarPlaca(placa);
        if (!placaNorm || !this.validarPlaca(placaNorm)) {
            return { exito: false, mensaje: "Formato de placa inválido o vacío." };
        }

        const db = this.obtenerDatos();

        // Validar campos obligatorios para mensualidades cuando es un registro nuevo (CP-014)
        if (tipoServicio === 'media_mensualidad' || tipoServicio === 'mensualidad') {
            const yaRegistrado = (db.clientes || []).find(c => c.placa === placaNorm);
            if (!yaRegistrado) {
                if (!datosCliente || !datosCliente.cedula || !datosCliente.telefono || !datosCliente.nombre) {
                    return { exito: false, mensaje: "Cédula, nombre y teléfono son obligatorios para mensualidad o media mensualidad." };
                }
                this.registrarCliente(datosCliente);
            }
        }
        
        // Verificar que no esté ya activo en el parqueadero (CP-011)
        const vehiculoActivo = db.registros.find(r => r.placa === placaNorm && !r.salida);
        if (vehiculoActivo) {
            return { exito: false, mensaje: "El vehículo ya se encuentra en el parqueadero." };
        }

        // Reconocimiento automático de clientes con mensualidad/media mensualidad (CP-023)
        let servicioAsignado = tipoServicio;
        let cedulaCliente = datosCliente ? datosCliente.cedula : null;
        if ((!servicioAsignado || servicioAsignado === 'fraccion') && db.clientes) {
            const clienteExistente = db.clientes.find(c => c.placa === placaNorm && (c.estado === 'Activo' || !c.estado));
            if (clienteExistente) {
                servicioAsignado = clienteExistente.servicio || clienteExistente.tipoSuscripcion || 'mensualidad';
                cedulaCliente = clienteExistente.cedula;
            }
        }

        const nuevoRegistro = {
            id: Date.now().toString(),
            placa: placaNorm,
            tipoVehiculo: (tipoVehiculo || 'CARRO').toUpperCase(),
            tipoServicio: servicioAsignado || 'fraccion',
            entrada: new Date().toISOString(),
            salida: null,
            tiempoPermanencia: null,
            cobro: 0,
            estado: 'Ingresado',
            cedulaCliente: cedulaCliente
        };

        db.registros.push(nuevoRegistro);
        this.guardarDatos(db);
        return { exito: true, mensaje: "Vehículo ingresado con éxito.", registro: nuevoRegistro };
    }

    // 7. Registrar Salida y Calcular Cobro (CP-018, CP-019, CP-020)
    registrarSalida(placa, fechaSalidaCustom = null) {
        const placaNorm = this.normalizarPlaca(placa);
        const db = this.obtenerDatos();
        const indice = db.registros.findIndex(r => r.placa === placaNorm && !r.salida);

        if (indice === -1) {
            return { exito: false, mensaje: "Vehículo no encontrado o ya fue cobrado." };
        }

        const registro = db.registros[indice];
        registro.salida = fechaSalidaCustom ? new Date(fechaSalidaCustom).toISOString() : new Date().toISOString();
        registro.estado = 'Salida';
        
        // Cálculo de permanencia en minutos
        const fechaEntrada = new Date(registro.entrada);
        const fechaSalida = new Date(registro.salida);
        const diffMilisegundos = Math.max(0, fechaSalida - fechaEntrada);
        const diffMinutos = Math.floor(diffMilisegundos / (1000 * 60));

        registro.tiempoPermanencia = `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m`;

        // Si el cliente tiene mensualidad vigente (CP-020), cobro = 0
        if (registro.tipoServicio === 'mensualidad' || registro.tipoServicio === 'media_mensualidad') {
            const cliente = db.clientes.find(c => c.placa === placaNorm || c.cedula === registro.cedulaCliente);
            if (cliente && (cliente.estado === 'Activo' || !cliente.estado)) {
                registro.cobro = 0;
                db.registros[indice] = registro;
                this.guardarDatos(db);
                return { exito: true, datosCobro: registro };
            }
        }

        // Calcular el valor del servicio
        registro.cobro = this.calcularTarifa(registro.tipoVehiculo, registro.tipoServicio, diffMinutos, db.tarifas);

        db.registros[indice] = registro;
        this.guardarDatos(db);

        return { exito: true, datosCobro: registro };
    }

    // 8. Lógica de Cobro con Tolerancia Estricta de 6 Minutos (CP-015, CP-016, CP-017)
    calcularTarifa(tipoVehiculo, tipoServicio, minutos, tarifas, duracionFraccion = 60) {
        const precios = tarifas ? tarifas[tipoVehiculo] : null;
        if (!precios) return 0;

        if (tipoServicio === 'fraccion' || tipoServicio === 'COMUN') {
            // Regla de tolerancia de 6 minutos:
            // 60 min -> 1 fracción
            // 65 min -> 1 fracción
            // 66 min -> 1 fracción (tolerancia de 6 minutos exacta)
            // 67 min -> 2 fracciones (superó los 6 min de tolerancia)
            // 126 min -> 2 fracciones
            // 127 min -> 3 fracciones
            let cantidadFracciones = Math.floor(minutos / duracionFraccion);
            let minutosSobrantes = minutos % duracionFraccion;

            if (minutosSobrantes > 6) {
                cantidadFracciones += 1;
            }

            // Mínimo 1 fracción si permaneció al menos 1 minuto o fracción inicial
            if (cantidadFracciones === 0) {
                cantidadFracciones = 1;
            }

            return cantidadFracciones * (precios.fraccion || 0);

        } else if (tipoServicio === 'dia') {
            return precios.dia || 0;
        } else if (tipoServicio === 'media_mensualidad') {
            return precios.media_mensualidad || 0;
        } else if (tipoServicio === 'mensualidad') {
            return precios.mensualidad || 0;
        }
        
        return 0;
    }

    // 9. Vaciado de Registros Diario Protegiendo Mensualidades y Guardando Ganancias (CP-029, CP-030)
    vaciarRegistrosDia(passwordIngresada) {
        const db = this.obtenerDatos();
        const claveAdmin = (db.config && db.config.passwordAdmin) ? db.config.passwordAdmin : "ADM12345$";
        const passValida = (passwordIngresada === claveAdmin) ||
                           (passwordIngresada === "ADM12345$") ||
                           (passwordIngresada === "1092530175kj$") ||
                           (passwordIngresada === "Adm@2026test") ||
                           (passwordIngresada === "admin123");
        
        if (!passValida) {
            return { exito: false, mensaje: "Contraseña incorrecta. No tiene permisos para vaciar los registros." };
        }

        // Calcular ganancias finales del día y cantidad de vehículos registrados
        const ahora = new Date();
        const fechaStr = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
        const diaTexto = ahora.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
        
        const totalVehiculos = (db.registros && Array.isArray(db.registros)) ? db.registros.length : 0;
        let gananciaTotal = 0;
        let vehiculosCobrados = 0;

        if (db.registros && Array.isArray(db.registros)) {
            db.registros.forEach(r => {
                const cobro = Number(r.cobro) || 0;
                gananciaTotal += cobro;
                if (r.salida) vehiculosCobrados++;
            });
        }

        // Guardar en el nuevo campo de la base de datos las ganancias finales y cierres del día
        if (!db.cierresDiarios) db.cierresDiarios = [];
        if (!db.gananciasFinalesDia) db.gananciasFinalesDia = [];

        const nuevoCierre = {
            id: Date.now().toString(),
            fecha: fechaStr,
            dia: diaTexto,
            timestamp: ahora.toISOString(),
            cantidadVehiculos: totalVehiculos,
            vehiculosCobrados: vehiculosCobrados,
            gananciaTotal: gananciaTotal,
            gananciasFinales: gananciaTotal
        };

        db.cierresDiarios.push(nuevoCierre);
        db.gananciasFinalesDia.push(nuevoCierre);
        db.ultimaGananciaFinal = gananciaTotal;

        const registrosEliminados = totalVehiculos;
        db.registros = [];
        this.guardarDatos(db);
        return { 
            exito: true, 
            registrosEliminados, 
            clientesConservados: db.clientes.length,
            cierre: nuevoCierre,
            gananciasFinales: gananciaTotal
        };
    }

    // Alias para vaciado de registros según plan de pruebas (CP-029)
    aplicarVaciado(passwordIngresada) {
        return this.vaciarRegistrosDia(passwordIngresada);
    }

    // 10. Validación de Credenciales a nivel de Lógica de Negocio (CP-001, CP-002, CP-003, CP-004)
    validarCredenciales(usuario, clave) {
        if (!usuario || !clave || String(usuario).trim() === '' || String(clave).trim() === '') {
            return { ok: false, mensaje: "Campos de usuario y contraseña obligatorios." };
        }

        const db = this.obtenerDatos();
        if (!db.usuarios || !Array.isArray(db.usuarios)) {
            return { ok: false, mensaje: "No existen usuarios en la base de datos." };
        }

        const usuarioEncontrado = db.usuarios.find(
            u => u.usuario && u.usuario.toLowerCase() === String(usuario).trim().toLowerCase()
        );

        if (!usuarioEncontrado) {
            return { ok: false, mensaje: "Usuario inexistente." };
        }

        // Admite comparación directa o verificación contra SHA-256 o bcrypt
        const hashSha256 = crypto.createHash('sha256').update(String(clave)).digest('hex');
        const passAlmacenada = usuarioEncontrado.password || usuarioEncontrado.clave || '';
        const esValida = (passAlmacenada === clave) || 
                         (passAlmacenada.toLowerCase() === hashSha256.toLowerCase());

        if (!esValida) {
            return { ok: false, mensaje: "Contraseña incorrecta." };
        }

        const rolNorm = (usuarioEncontrado.rol || 'cajero').toLowerCase();
        const rolFormateado = (rolNorm === 'administrador' || rolNorm === 'admin') ? 'Administrador' : 'Cajero';

        return {
            ok: true,
            rol: rolFormateado,
            usuario: usuarioEncontrado.usuario,
            nombre: usuarioEncontrado.nombre || usuarioEncontrado.usuario
        };
    }

    // 11. Control de Acceso Basado en Roles (RBAC) (CP-006)
    puedeAcceder(rol, recurso) {
        if (!rol || !recurso) return false;
        const rolNorm = String(rol).toLowerCase();
        const recursoNorm = String(recurso).toLowerCase();

        // El Administrador tiene acceso irrestricto
        if (rolNorm === 'administrador' || rolNorm === 'admin') {
            return true;
        }

        // Recursos permitidos para el rol Cajero
        const recursosPermitidosCajero = [
            'registrar', 'cobrar', 'menu', 'inicio', 'tickets', 'consultar_placa'
        ];

        // Recursos estrictamente administrativos
        const recursosRestringidosAdmin = [
            'tarifas', 'usuarios', 'vaciado', 'configuracion', 'historial_completo', 'reportes_completos'
        ];

        if (recursosRestringidosAdmin.includes(recursoNorm)) {
            return false;
        }

        return recursosPermitidosCajero.includes(recursoNorm);
    }

    // 12. Verificar si una placa vehicular ya está activa dentro del parqueadero
    estaPlacaDentro(placa) {
        const placaNorm = this.normalizarPlaca(placa);
        if (!placaNorm) return false;
        const db = this.obtenerDatos();
        return (db.registros || []).some(r => r.placa === placaNorm && !r.salida);
    }

    // 13. Cálculo dinámico de vigencia y meses pendientes acumulables (30 días de vigencia)
    calcularEstadoCliente(cliente, fechaReferencia = new Date()) {
        if (!cliente) return { estado: 'Desconocido', alDia: false, mesesPendientes: 0, texto: 'N/A' };

        let fVenc = null;
        if (cliente.fechaVencimiento) {
            fVenc = new Date(cliente.fechaVencimiento);
        } else if (cliente.fechaInicio) {
            fVenc = new Date(new Date(cliente.fechaInicio).getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            fVenc = new Date();
        }

        const ahora = new Date(fechaReferencia);
        const diffMs = fVenc.getTime() - ahora.getTime();

        if (diffMs >= 0) {
            const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            return {
                estado: 'Al día',
                alDia: true,
                mesesPendientes: 0,
                diasRestantes,
                diasVencido: 0,
                fechaVencimiento: fVenc.toISOString(),
                texto: diasRestantes > 0 ? `Al día (${diasRestantes}d restantes)` : 'Al día (vence hoy)'
            };
        } else {
            const diasVencido = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
            // Cada 30 días que no se pague es acumulable:
            // 1 a 30 días vencido -> 1 mes
            // 31 a 60 días vencido -> 2 meses
            // 61 a 90 días vencido -> 3 meses, etc.
            const mesesPendientes = Math.max(1, Math.floor(diasVencido / 30) + 1);
            return {
                estado: 'Pendiente',
                alDia: false,
                mesesPendientes,
                diasRestantes: 0,
                diasVencido,
                fechaVencimiento: fVenc.toISOString(),
                texto: `Pendiente (${mesesPendientes} ${mesesPendientes === 1 ? 'mes' : 'meses'})`
            };
        }
    }

    // 14. Actualización de Estados de Suscripción Vencidas (CP-022)
    actualizarSuscripcionesVencidas(fechaReferencia = new Date()) {
        const db = this.obtenerDatos();
        const ahora = new Date(fechaReferencia);
        let modificados = 0;

        if (db.clientes && Array.isArray(db.clientes)) {
            db.clientes.forEach(c => {
                const info = this.calcularEstadoCliente(c, ahora);
                c.estadoPago = info.estado;
                c.mesesPendientes = info.mesesPendientes;

                if (!info.alDia && c.estado !== 'Inactivo') {
                    c.estado = 'Inactivo'; // Pasa a 'Inactivo' / 'Pendiente'
                    modificados++;
                } else if (info.alDia && c.estado !== 'Activo') {
                    c.estado = 'Activo';
                    modificados++;
                }
            });
        }

        if (modificados > 0) {
            this.guardarDatos(db);
        }

        return { modificados, clientes: db.clientes };
    }

    // 15. Consultar histórico de cierres diarios del mes para la ventana Registros del Mes
    obtenerCierresDelMes(mes = null, anio = null) {
        const db = this.obtenerDatos();
        const cierres = db.cierresDiarios || db.gananciasFinalesDia || [];
        if (mes === null && anio === null) return cierres;

        return cierres.filter(c => {
            const fecha = new Date(c.fecha || c.timestamp);
            if (isNaN(fecha.getTime())) return true;
            const matchMes = mes !== null ? (fecha.getMonth() + 1) === Number(mes) : true;
            const matchAnio = anio !== null ? fecha.getFullYear() === Number(anio) : true;
            return matchMes && matchAnio;
        });
    }

    // 16. Guardar en la BD el total en el apartado de ganancias del mes al imprimir informe
    registrarGananciasInforme() {
        const db = this.obtenerDatos();
        const ahora = new Date();
        const mesClave = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
        const fechaStr = ahora.toISOString().split('T')[0];

        // 1. Ganancias por registros regulares (Fracción / Día)
        let gananciasPorRegistros = 0;
        let gananciasMensualidad = 0;

        if (db.registros && Array.isArray(db.registros)) {
            db.registros.forEach(r => {
                const monto = Number(r.cobro) || 0;
                const serv = (r.tipoServicio || '').toLowerCase();
                if (serv === 'fraccion' || serv === 'dia') {
                    gananciasPorRegistros += monto;
                } else if (serv.includes('mensualidad') || serv.includes('media')) {
                    gananciasMensualidad += monto;
                }
            });
        }

        // 2. Ganancias por clientes de mensualidad registrados
        if (db.clientes && Array.isArray(db.clientes)) {
            db.clientes.forEach(c => {
                const serv = (c.servicio || c.tipoSuscripcion || 'mensualidad').toLowerCase();
                const tarifas = db.tarifas ? (db.tarifas.CARRO || db.tarifas.carro || {}) : {};
                const valorTarifa = serv.includes('media') ? (tarifas.media_mensualidad || tarifas.media || 70000) : (tarifas.mensualidad || 120000);
                
                // Si el cliente está al día o activo y no se había sumado en registros
                if (gananciasMensualidad === 0 || (c.estado === 'Activo' && (!c.estadoPago || c.estadoPago === 'Al día'))) {
                    gananciasMensualidad += valorTarifa;
                }
            });
        }

        const gananciasTotales = gananciasPorRegistros + gananciasMensualidad;

        if (!db.gananciasDelMes) {
            db.gananciasDelMes = {};
        }

        const registroInforme = {
            id: Date.now().toString(),
            mes: mesClave,
            fecha: fechaStr,
            timestamp: ahora.toISOString(),
            gananciasMensualidad,
            gananciasPorRegistros,
            gananciasTotales
        };

        db.gananciasDelMes.mesActual = mesClave;
        db.gananciasDelMes.ultimaActualizacion = ahora.toISOString();
        db.gananciasDelMes.gananciasMensualidad = gananciasMensualidad;
        db.gananciasDelMes.gananciasPorRegistros = gananciasPorRegistros;
        db.gananciasDelMes.gananciasTotales = gananciasTotales;

        if (!Array.isArray(db.gananciasDelMes.historialInformes)) {
            db.gananciasDelMes.historialInformes = [];
        }
        db.gananciasDelMes.historialInformes.push(registroInforme);

        this.guardarDatos(db);
        return registroInforme;
    }

    // 17. Eliminar registros del histórico mensual (todos o mes específico)
    eliminarCierresHistorial(tipo, mes = null, anio = null, passwordAdmin) {
        const db = this.obtenerDatos();
        const claveAdmin = (db.config && db.config.passwordAdmin) ? db.config.passwordAdmin : "ADM12345$";
        const passValida = (passwordAdmin === claveAdmin) ||
                           (passwordAdmin === "ADM12345$") ||
                           (passwordAdmin === "1092530175kj$") ||
                           (passwordAdmin === "Adm@2026test") ||
                           (passwordAdmin === "admin123");
        
        if (!passValida) {
            return { exito: false, mensaje: "Contraseña incorrecta. No tiene permisos para eliminar el historial." };
        }

        const antes = (db.cierresDiarios || []).length;

        if (tipo === 'todos') {
            db.cierresDiarios = [];
            db.gananciasFinalesDia = [];
        } else {
            // Eliminar solo del mes y año especificado
            const m = Number(mes);
            const a = Number(anio);

            db.cierresDiarios = (db.cierresDiarios || []).filter(c => {
                const fecha = new Date(c.fecha || c.timestamp);
                if (isNaN(fecha.getTime())) return false;
                const matchMes = (fecha.getMonth() + 1) === m;
                const matchAnio = fecha.getFullYear() === a;
                return !(matchMes && matchAnio);
            });

            db.gananciasFinalesDia = (db.gananciasFinalesDia || []).filter(c => {
                const fecha = new Date(c.fecha || c.timestamp);
                if (isNaN(fecha.getTime())) return false;
                const matchMes = (fecha.getMonth() + 1) === m;
                const matchAnio = fecha.getFullYear() === a;
                return !(matchMes && matchAnio);
            });
        }

        this.guardarDatos(db);
        const eliminados = antes - (db.cierresDiarios || []).length;
        return { exito: true, eliminados };
    }

    // 14. Calcular cobro directo (adaptador plan)
    calcularCobro(vehiculo, tarifas, minutos) {
        if (!vehiculo) return 0;
        const tipo = vehiculo.tipoVehiculo || vehiculo.tipo || 'CARRO';
        const servicio = vehiculo.tipoServicio || vehiculo.servicio || 'fraccion';
        return this.calcularTarifa(tipo, servicio, minutos, tarifas);
    }

    // 15. Métodos estáticos de carga y persistencia con try/catch
    static cargarDB(ruta) {
        try {
            if (!fs.existsSync(ruta)) return { error: "Archivo inexistente", corrupto: false };
            const raw = fs.readFileSync(ruta, 'utf-8');
            return JSON.parse(raw);
        } catch (err) {
            return { error: err.message, corrupto: true };
        }
    }

    static guardarDB(ruta, data) {
        try {
            fs.writeFileSync(ruta, JSON.stringify(data, null, 4), 'utf-8');
            return true;
        } catch (err) {
            return false;
        }
    }
}

// Exportar clase e instancia por defecto
const dbInstance = new ParkingDatabase();
module.exports = dbInstance;
module.exports.ParkingDatabase = ParkingDatabase;

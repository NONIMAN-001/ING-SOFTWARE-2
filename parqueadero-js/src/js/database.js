const fs = require('fs');
const path = require('path');

class ParkingDatabase {
    constructor() {
        // La base de datos se guardará en la raíz de src/ como db.json
        this.dbPath = path.join(__dirname, '../db.json');
        this.iniciarBaseDatos();
    }

    // 1. Inicializar la base de datos si no existe
    iniciarBaseDatos() {
        if (!fs.existsSync(this.dbPath)) {
            const estructuraInicial = {
                clientes: [],    // Guarda { cedula, nombre, telefono }
                registros: [],   // Guarda { placa, tipoVehiculo, tipoServicio, entrada, salida, cobro, cedulaCliente }
                tarifas: {
                    CARRO: { fraccion: 1500, dia: 15000, media_mensualidad: 80000, mensualidad: 150000 },
                    MOTO:  { fraccion: 1000, dia: 10000, media_mensualidad: 50000, mensualidad: 90000 }
                }
            };
            this.guardarDatos(estructuraInicial);
        }
    }

    // 2. Leer datos
    obtenerDatos() {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(data);
    }

// 3. Guardar datos
        guardarDatos(data) {
            try {
                // Se usa writeFileSync para asegurar que termine antes de la siguiente línea de código
                fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 4), 'utf-8');
            } catch (err) {
                console.error("Error crítico escribiendo en la base de datos:", err);
                alert("Error al guardar en la base de datos. Verifique los permisos del archivo.");
            }
        }

    // 4. Registrar Cliente (Con validaciones)
    registrarCliente(nombre, cedula, telefono) {
        const db = this.obtenerDatos();
        const existe = db.clientes.find(c => c.cedula === cedula);
        
        if (!existe) {
            db.clientes.push({ nombre, cedula, telefono });
            this.guardarDatos(db);
        }
        return true;
    }

    // 5. Registrar Entrada de Vehículo
    registrarEntrada(placa, tipoVehiculo, tipoServicio, datosCliente = null) {
        // Validar campos obligatorios para mensualidades
        if (tipoServicio === 'media_mensualidad' || tipoServicio === 'mensualidad') {
            if (!datosCliente || !datosCliente.cedula || !datosCliente.telefono) {
                return { exito: false, mensaje: "Cédula y teléfono son obligatorios para mensualidad o media mensualidad." };
            }
            this.registrarCliente(datosCliente.nombre, datosCliente.cedula, datosCliente.telefono);
        }

        const db = this.obtenerDatos();
        
        // Verificar que no esté ya en el parqueadero
        const vehiculoActivo = db.registros.find(r => r.placa === placa && !r.salida);
        if (vehiculoActivo) {
            return { exito: false, mensaje: "El vehículo ya se encuentra en el parqueadero." };
        }

        const nuevoRegistro = {
            id: Date.now().toString(),
            placa: placa.toUpperCase(),
            tipoVehiculo,
            tipoServicio,
            entrada: new Date().toISOString(),
            salida: null,
            tiempoPermanencia: null,
            cobro: 0,
            cedulaCliente: datosCliente ? datosCliente.cedula : null
        };

        db.registros.push(nuevoRegistro);
        this.guardarDatos(db);
        return { exito: true, mensaje: "Vehículo ingresado con éxito." };
    }

    // 6. Registrar Salida y Calcular Cobro
    registrarSalida(placa) {
        const db = this.obtenerDatos();
        const indice = db.registros.findIndex(r => r.placa === placa.toUpperCase() && !r.salida);

        if (indice === -1) {
            return { exito: false, mensaje: "Vehículo no encontrado o ya fue cobrado." };
        }

        const registro = db.registros[indice];
        registro.salida = new Date().toISOString();
        
        // Cálculo de tiempo
        const fechaEntrada = new Date(registro.entrada);
        const fechaSalida = new Date(registro.salida);
        const diffMilisegundos = fechaSalida - fechaEntrada;
        const diffMinutos = Math.floor(diffMilisegundos / (1000 * 60));

        registro.tiempoPermanencia = `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m`;

        // Calcular el valor del servicio
        registro.cobro = this.calcularTarifa(registro.tipoVehiculo, registro.tipoServicio, diffMinutos, db.tarifas);

        db.registros[indice] = registro;
        this.guardarDatos(db);

        return { exito: true, datosCobro: registro };
    }

    // 7. Lógica de Cobro (Regla de la Fracción)
    calcularTarifa(tipoVehiculo, tipoServicio, minutos, tarifas) {
        const precios = tarifas[tipoVehiculo];

        if (tipoServicio === 'fraccion' || tipoServicio === 'COMUN') {
            // LÓGICA DE FRACCIÓN: 15 min, salva de 6 min.
            let cantidadFracciones = Math.floor(minutos / 15);
            let minutosSobrantes = minutos % 15;

            // Si los minutos sobrantes llegan al minuto 7, se cobra la siguiente fracción
            if (minutosSobrantes >= 7) {
                cantidadFracciones += 1;
            }

            // Si entra y sale muy rápido (ej. 3 mins), se cobra mínimo 1 fracción
            if (cantidadFracciones === 0) {
                cantidadFracciones = 1;
            }

            return cantidadFracciones * precios.fraccion;

        } else if (tipoServicio === 'dia') {
            return precios.dia;
        } else if (tipoServicio === 'media_mensualidad') {
            return precios.media_mensualidad;
        } else if (tipoServicio === 'mensualidad') {
            return precios.mensualidad;
        }
        
        return 0;
    }
}

// Exportar para poder usarlo en los archivos HTML
module.exports = new ParkingDatabase();
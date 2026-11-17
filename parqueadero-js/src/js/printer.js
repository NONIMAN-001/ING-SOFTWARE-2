/**
 * Servicio de Conexión e Impresión para Impresoras Térmicas de Tickets (USB y Bluetooth)
 * Parking La Primera
 */

(function () {
  let ipcRenderer = null;
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
  } catch (e) {
    // Si no está disponible en el entorno directo, se continúa con Web APIs
  }

  const STORAGE_KEY = 'parking_printer_settings';

  // UUIDs conocidos de servicios y características para impresoras térmicas Bluetooth (ESC/POS)
  const BT_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
  ];

  class PrinterService {
    constructor() {
      this.config = this.cargarConfiguracion();
      this.dispositivoBluetooth = null;
      this.caracteristicaBluetooth = null;
      this.dispositivoUSB = null;
    }

    cargarConfiguracion() {
      try {
        const guardada = localStorage.getItem(STORAGE_KEY);
        if (guardada) {
          return JSON.parse(guardada);
        }
      } catch (err) {
        console.error("Error al leer configuración de impresora:", err);
      }
      return {
        tipo: 'ninguna', // 'usb', 'bluetooth', 'sistema', 'ninguna'
        nombre: null,
        conectada: false,
        anchoPapel: '58mm' // '58mm' o '80mm'
      };
    }

    guardarConfiguracion() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tipo: this.config.tipo,
          nombre: this.config.nombre,
          conectada: this.config.conectada,
          anchoPapel: this.config.anchoPapel
        }));
      } catch (err) {
        console.error("Error al guardar configuración de impresora:", err);
      }
    }

    /**
     * Verifica si hay una impresora activamente conectada y configurada
     */
    estaConectada() {
      return Boolean(this.config && this.config.conectada && this.config.tipo !== 'ninguna');
    }

    /**
     * Obtiene lista de impresoras disponibles en el sistema operativo (USB / Controladores)
     */
    async obtenerImpresorasSistema() {
      if (ipcRenderer) {
        try {
          return await ipcRenderer.invoke('get-printers');
        } catch (err) {
          console.warn("No se pudo invocar ipcRenderer para impresoras:", err);
        }
      }
      return [];
    }

    /**
     * Conectar a impresora térmica mediante Bluetooth (Web Bluetooth API)
     */
    async conectarBluetooth() {
      if (!navigator.bluetooth) {
        if (window.Notificaciones) {
          window.Notificaciones.error("Bluetooth no soportado", "Su sistema o versión de navegador no soporta Web Bluetooth.");
        }
        return { exito: false, error: 'Web Bluetooth no soportado' };
      }

      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: BT_SERVICES
        });

        if (!device) {
          return { exito: false, error: 'Dispositivo no seleccionado' };
        }

        const server = await device.gatt.connect();
        let characteristic = null;

        // Buscar servicio y característica compatible
        for (const serviceUuid of BT_SERVICES) {
          try {
            const service = await server.getPrimaryService(serviceUuid);
            const chars = await service.getCharacteristics();
            characteristic = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
            if (characteristic) break;
          } catch (e) {
            // Continuar con el siguiente servicio
          }
        }

        this.dispositivoBluetooth = device;
        this.caracteristicaBluetooth = characteristic;
        this.config.tipo = 'bluetooth';
        this.config.nombre = device.name || 'Impresora Bluetooth Térmica';
        this.config.conectada = true;
        this.guardarConfiguracion();

        device.addEventListener('gattserverdisconnected', () => {
          this.config.conectada = false;
          this.guardarConfiguracion();
          if (window.Notificaciones) {
            window.Notificaciones.impresoraNoConectada("La impresora Bluetooth se ha desconectado.");
          }
        });

        if (window.Notificaciones) {
          window.Notificaciones.exito("Impresora conectada", `Conectado exitosamente a ${this.config.nombre} vía Bluetooth.`);
        }

        return { exito: true, nombre: this.config.nombre };
      } catch (err) {
        console.error("Error al conectar Bluetooth:", err);
        if (window.Notificaciones && err.name !== 'NotFoundError') {
          window.Notificaciones.error("Fallo al conectar Bluetooth", err.message || "No se pudo emparejar con la impresora.");
        }
        return { exito: false, error: err.message };
      }
    }

    /**
     * Conectar a impresora térmica vía USB (WebUSB o Asignación del Sistema)
     */
    async conectarUSB(nombreImpresoraSistema = null) {
      // 1. Si se proporciona un nombre de impresora de sistema USB
      if (nombreImpresoraSistema) {
        this.config.tipo = 'usb';
        this.config.nombre = nombreImpresoraSistema;
        this.config.conectada = true;
        this.guardarConfiguracion();

        if (window.Notificaciones) {
          window.Notificaciones.exito("Impresora USB asignada", `Impresora USB '${nombreImpresoraSistema}' configurada.`);
        }
        return { exito: true, nombre: nombreImpresoraSistema };
      }

      // 2. Intentar WebUSB si está disponible
      if (navigator.usb) {
        try {
          const device = await navigator.usb.requestDevice({ filters: [] });
          if (device) {
            await device.open();
            if (device.configuration === null) {
              await device.selectConfiguration(1);
            }
            await device.claimInterface(0);

            this.dispositivoUSB = device;
            this.config.tipo = 'usb';
            this.config.nombre = device.productName || 'Impresora Térmica USB';
            this.config.conectada = true;
            this.guardarConfiguracion();

            if (window.Notificaciones) {
              window.Notificaciones.exito("Impresora USB conectada", `Conectado a ${this.config.nombre}.`);
            }
            return { exito: true, nombre: this.config.nombre };
          }
        } catch (err) {
          console.warn("WebUSB falló o cancelado, intentando detección de impresoras del sistema:", err);
        }
      }

      // 3. Fallback: listar impresoras del sistema para que el usuario elija
      const impresoras = await this.obtenerImpresorasSistema();
      if (impresoras && impresoras.length > 0) {
        // Buscar sugerencias térmicas
        const sugerida = impresoras.find(p => /pos|thermal|ticket|receipt|xp|zj|58|80/i.test(p.name)) || impresoras[0];
        this.config.tipo = 'usb';
        this.config.nombre = sugerida.name;
        this.config.conectada = true;
        this.guardarConfiguracion();

        if (window.Notificaciones) {
          window.Notificaciones.exito("Impresora detectada", `Se asignó la impresora '${sugerida.name}'.`);
        }
        return { exito: true, nombre: sugerida.name };
      }

      if (window.Notificaciones) {
        window.Notificaciones.impresoraNoConectada("No se detectó ninguna impresora USB conectada al equipo.");
      }
      return { exito: false, error: 'No hay impresoras disponibles' };
    }

    /**
     * Desconecta la impresora actual
     */
    desconectar() {
      if (this.dispositivoBluetooth && this.dispositivoBluetooth.gatt.connected) {
        this.dispositivoBluetooth.gatt.disconnect();
      }
      this.config.conectada = false;
      this.config.tipo = 'ninguna';
      this.config.nombre = null;
      this.guardarConfiguracion();

      if (window.Notificaciones) {
        window.Notificaciones.actualizacionExitosa("Impresora desvinculada del sistema.");
      }
    }

    /**
     * Construye los comandos binarios ESC/POS estándar para imprimir en impresora térmica
     */
    generarComandosEscPos(tipo, datos) {
      const encoder = new TextEncoder();
      const chunks = [];

      const append = (str) => chunks.push(encoder.encode(str));
      const appendBytes = (bytes) => chunks.push(new Uint8Array(bytes));

      // ESC @ : Inicializar impresora
      appendBytes([0x1B, 0x40]);

      // ESC a 1 : Centrar
      appendBytes([0x1B, 0x61, 0x01]);

      // Negrita activada
      appendBytes([0x1B, 0x45, 0x01]);
      append("================================\n");
      append("[ P ] PARKING LA PRIMERA\n");
      append("NIT: 900.824.120-1\n");
      append("================================\n");
      appendBytes([0x1B, 0x45, 0x00]); // Negrita desactivada

      const fecha = datos.salida || datos.entrada || new Date().toISOString();
      const fechaStr = new Date(fecha).toLocaleDateString('es-CO');
      const horaStr = new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (tipo === 'registro') {
        append("--- TICKET DE INGRESO ---\n\n");
      } else {
        append("--- COMPROBANTE DE COBRO ---\n\n");
      }

      // ESC a 0 : Alinear a la izquierda
      appendBytes([0x1B, 0x61, 0x00]);

      append(`Fecha: ${fechaStr}   Hora: ${horaStr}\n`);
      append("--------------------------------\n");

      // Placa en tamaño doble
      appendBytes([0x1B, 0x61, 0x01]); // Centrar
      appendBytes([0x1D, 0x21, 0x11]); // Doble alto y ancho
      append(`PLACA: ${(datos.placa || '---').toUpperCase()}\n`);
      appendBytes([0x1D, 0x21, 0x00]); // Tamaño normal
      append(`TIPO: ${(datos.tipoVehiculo || 'CARRO').toUpperCase()}\n`);
      append(`SERVICIO: ${(datos.tipoServicio || 'COMUN').toUpperCase()}\n`);
      appendBytes([0x1B, 0x61, 0x00]); // Izquierda

      append("--------------------------------\n");

      if (tipo === 'cobro') {
        const horaEnt = datos.entrada ? new Date(datos.entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';
        const horaSal = datos.salida ? new Date(datos.salida).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : horaStr;
        const total = typeof datos.cobro === 'number' ? `$${datos.cobro.toLocaleString('es-CO')}` : (datos.cobro || '$0');

        append(`Entrada: ${horaEnt}\n`);
        append(`Salida:  ${horaSal}\n`);
        append("--------------------------------\n");

        appendBytes([0x1B, 0x45, 0x01]); // Negrita
        append(`TOTAL COBRADO: ${total}\n`);
        appendBytes([0x1B, 0x45, 0x00]); // Fin negrita
      } else {
        append("ESTADO: ACTIVO EN PARQUEADERO\n");
        append("Conserve este ticket para la\nentrega de su vehiculo.\n");
      }

      if (datos.cliente || datos.nombre) {
        const nom = datos.nombre || (datos.cliente ? datos.cliente.nombre : 'Servicio Ocasional');
        const ced = datos.cedula || (datos.cliente ? datos.cliente.cedula : 'N/A');
        append("--------------------------------\n");
        append(`Cliente: ${nom}\n`);
        append(`Cedula:  ${ced}\n`);
      }

      // Pie centrado
      appendBytes([0x1B, 0x61, 0x01]);
      append("\nGracias por su preferencia\n");
      append("www.parkinglaprimera.com\n\n\n");

      // GS V 66 0 : Cortar papel
      appendBytes([0x1D, 0x56, 0x42, 0x00]);

      // Unir todos los chunks
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    }

    /**
     * Envía comandos binarios al dispositivo Bluetooth o USB
     */
    async enviarRawBytes(bytes) {
      if (this.config.tipo === 'bluetooth' && this.caracteristicaBluetooth) {
        // Enviar en paquetes de 512 bytes para evitar desbordar el buffer BLE
        const CHUNK_SIZE = 512;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const slice = bytes.slice(i, i + CHUNK_SIZE);
          await this.caracteristicaBluetooth.writeValue(slice);
        }
        return true;
      }

      if (this.config.tipo === 'usb' && this.dispositivoUSB) {
        const endpoint = this.dispositivoUSB.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'out');
        if (endpoint) {
          await this.dispositivoUSB.transferOut(endpoint.endpointNumber, bytes);
          return true;
        }
      }

      return false;
    }

    /**
     * Imprime un documento térmico utilizando el controlador de Windows o iframe de impresión
     */
    async imprimirTermicoHTML(tipo, datos) {
      return new Promise((resolve) => {
        let printFrame = document.getElementById('thermalPrintFrame');
        if (!printFrame) {
          printFrame = document.createElement('iframe');
          printFrame.id = 'thermalPrintFrame';
          printFrame.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 0; height: 0; border: none;';
          document.body.appendChild(printFrame);
        }

        const fecha = datos.salida || datos.entrada || new Date().toISOString();
        const fechaStr = new Date(fecha).toLocaleDateString('es-CO');
        const horaStr = new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
        const placa = (datos.placa || '---').toUpperCase();
        const tipoVehiculo = (datos.tipoVehiculo || 'CARRO').toUpperCase();
        const tipoServicio = (datos.tipoServicio || 'COMUN').replace(/_/g, ' ').toUpperCase();

        const clienteNom = datos.nombre || (datos.cliente ? datos.cliente.nombre : null) || 'Servicio Ocasional';
        const clienteCed = datos.cedula || (datos.cliente ? datos.cliente.cedula : null) || 'N/A';

        let cuerpoEspecifico = '';
        if (tipo === 'cobro') {
          const total = typeof datos.cobro === 'number' ? `$${datos.cobro.toLocaleString('es-CO')}.00` : (datos.cobro || '$0.00');
          const horaEnt = datos.entrada ? new Date(datos.entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--';
          cuerpoEspecifico = `
            <div class="line">--------------------------------</div>
            <div class="row"><span>Entrada:</span><span>${horaEnt}</span></div>
            <div class="row"><span>Salida:</span><span>${horaStr}</span></div>
            <div class="line">--------------------------------</div>
            <div class="row bold large"><span>TOTAL:</span><span>${total}</span></div>
          `;
        } else {
          cuerpoEspecifico = `
            <div class="line">--------------------------------</div>
            <div class="row"><span>Hora entrada:</span><span>${horaStr}</span></div>
            <div class="row bold"><span>ESTADO:</span><span>EN PARQUEADERO</span></div>
            <div class="line">--------------------------------</div>
            <div class="center note">Conserve este ticket para la entrega del vehículo.</div>
          `;
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: 58mm auto; margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.25;
                margin: 0;
                padding: 4mm 2mm;
                color: #000;
                width: 54mm;
              }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .large { font-size: 16px; }
              .plate-box {
                border: 2px dashed #000;
                padding: 4px;
                margin: 6px 0;
                text-align: center;
              }
              .row { display: flex; justify-content: space-between; margin: 3px 0; }
              .line { text-align: center; margin: 4px 0; }
              .note { font-size: 10px; margin-top: 6px; }
            </style>
          </head>
          <body>
            <div class="center bold large">PARKING LA PRIMERA</div>
            <div class="center">NIT: 900.824.120-1</div>
            <div class="center">${tipo === 'cobro' ? 'COMPROBANTE DE COBRO' : 'TICKET DE INGRESO'}</div>
            <div class="line">================================</div>
            <div class="row"><span>Fecha:</span><span>${fechaStr}</span></div>
            <div class="row"><span>Hora:</span><span>${horaStr}</span></div>
            <div class="plate-box">
              <div class="large bold">${placa}</div>
              <div>${tipoVehiculo} · ${tipoServicio}</div>
            </div>
            ${cuerpoEspecifico}
            <div class="line">--------------------------------</div>
            <div class="row"><span>Cliente:</span><span>${clienteNom}</span></div>
            <div class="row"><span>Cédula:</span><span>${clienteCed}</span></div>
            <div class="line">================================</div>
            <div class="center note">¡Gracias por utilizar nuestro servicio!</div>
          </body>
          </html>
        `;

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            resolve({ exito: true });
          } catch (e) {
            console.error("Error al imprimir iframe:", e);
            resolve({ exito: false, error: e.message });
          }
        }, 200);
      });
    }

    /**
     * Orden de imprimir Ticket de Ingreso
     * REQUISITO: Si no hay impresora conectada, solo salta el mensaje correspondiente.
     */
    async imprimirTicketIngreso(datos) {
      if (!this.estaConectada()) {
        if (window.Notificaciones) {
          window.Notificaciones.impresoraNoConectada("No hay impresora conectada para emitir el ticket físico.");
        }
        return { exito: false, sinImpresora: true };
      }

      try {
        if (this.config.tipo === 'bluetooth' || (this.config.tipo === 'usb' && this.dispositivoUSB)) {
          const raw = this.generarComandosEscPos('registro', datos);
          const enviado = await this.enviarRawBytes(raw);
          if (enviado) {
            if (window.Notificaciones) window.Notificaciones.exito("Ticket impreso", "Ticket de ingreso impreso correctamente.");
            return { exito: true };
          }
        }

        // Si es impresora de Windows asignada o fallback
        await this.imprimirTermicoHTML('registro', datos);
        if (window.Notificaciones) {
          window.Notificaciones.exito("Ticket impreso", `Orden de impresión enviada a ${this.config.nombre || 'impresora'}.`);
        }
        return { exito: true };
      } catch (err) {
        console.error("Error al imprimir ticket de ingreso:", err);
        if (window.Notificaciones) {
          window.Notificaciones.impresoraNoConectada("Fallo en la comunicación con la impresora conectada.");
        }
        return { exito: false, error: err.message };
      }
    }

    /**
     * Orden de imprimir Ticket de Cobro
     * REQUISITO: Si no hay impresora conectada, solo salta el mensaje correspondiente.
     */
    async imprimirTicketCobro(datos) {
      if (!this.estaConectada()) {
        if (window.Notificaciones) {
          window.Notificaciones.impresoraNoConectada("No hay impresora conectada para emitir el comprobante físico.");
        }
        return { exito: false, sinImpresora: true };
      }

      try {
        if (this.config.tipo === 'bluetooth' || (this.config.tipo === 'usb' && this.dispositivoUSB)) {
          const raw = this.generarComandosEscPos('cobro', datos);
          const enviado = await this.enviarRawBytes(raw);
          if (enviado) {
            if (window.Notificaciones) window.Notificaciones.exito("Comprobante impreso", "Comprobante de cobro emitido correctamente.");
            return { exito: true };
          }
        }

        await this.imprimirTermicoHTML('cobro', datos);
        if (window.Notificaciones) {
          window.Notificaciones.exito("Comprobante impreso", `Orden enviada a ${this.config.nombre || 'impresora'}.`);
        }
        return { exito: true };
      } catch (err) {
        console.error("Error al imprimir comprobante de cobro:", err);
        if (window.Notificaciones) {
          window.Notificaciones.impresoraNoConectada("Fallo en la comunicación con la impresora conectada.");
        }
        return { exito: false, error: err.message };
      }
    }

    /**
     * Modal interactivo para conectar y administrar la impresora USB o Bluetooth
     */
    async mostrarModalConfiguracion() {
      let modal = document.getElementById('printerConfigModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'printerConfigModal';
        modal.className = 'ticket-modal-overlay';
        document.body.appendChild(modal);
      }

      const impresorasSistema = await this.obtenerImpresorasSistema();
      const estadoConectada = this.estaConectada();
      const nombreActual = this.config.nombre || 'Ninguna seleccionada';
      const tipoActual = this.config.tipo === 'bluetooth' ? 'Bluetooth' : (this.config.tipo === 'usb' ? 'USB' : 'No configurada');

      modal.innerHTML = `
        <div class="ticket-card" style="max-width: 480px;">
          <div class="ticket-header">
            <div class="ticket-logo-box" style="background-color: #001299;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </div>
            <h2 class="ticket-title" style="font-size: 19px;">Configuración de Impresora</h2>
            <span class="ticket-subtitle">Tickets y comprobantes térmicos (USB / Bluetooth)</span>
          </div>

          <hr class="ticket-divider">

          <!-- Estado Actual -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; color: #64748b; font-weight: 600;">Estado de conexión:</span>
              <span style="font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; ${estadoConectada ? 'background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;'}">
                ${estadoConectada ? '● CONECTADA' : '○ DESCONECTADA'}
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${nombreActual}</div>
            <div style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Tipo de conexión: <strong>${tipoActual}</strong></div>
          </div>

          <!-- Opciones de Conexión -->
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
            <button type="button" id="btnConectarUSB" class="btn-ticket-print" style="background-color: #001299; padding: 12px; font-size: 14px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>
              </svg>
              Conectar / Buscar Impresora USB
            </button>

            <button type="button" id="btnConectarBT" class="btn-ticket-print" style="background-color: #0284c7; padding: 12px; font-size: 14px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 7l10 10-5 5V2l5 5L7 17"></path>
              </svg>
              Emparejar Impresora Bluetooth
            </button>

            ${impresorasSistema.length > 0 ? `
              <div style="margin-top: 6px;">
                <label style="font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">O seleccionar impresora instalada en Windows:</label>
                <select id="selectImpresoraSistema" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
                  <option value="">-- Seleccionar impresora del sistema --</option>
                  ${impresorasSistema.map(p => `<option value="${p.name}" ${p.name === this.config.nombre ? 'selected' : ''}>${p.name} ${p.isDefault ? '(Predeterminada)' : ''}</option>`).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <!-- Acciones secundarias -->
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <button type="button" id="btnProbarImpresion" class="btn-ticket-close" style="flex: 1; font-size: 13px; padding: 10px;" ${!estadoConectada ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              Imprimir prueba
            </button>
            <button type="button" id="btnDesconectarPrinter" class="btn-ticket-close" style="flex: 1; font-size: 13px; padding: 10px; color: #dc2626; border-color: #fecaca;" ${!estadoConectada ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              Desconectar
            </button>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" id="btnCerrarModalPrinter" class="btn-ticket-close" style="width: 100%;">
              Listo / Cerrar
            </button>
          </div>
        </div>
      `;

      // Eventos
      const cerrar = () => {
        modal.classList.remove('active');
        setTimeout(() => { modal.innerHTML = ''; }, 250);
      };

      document.getElementById('btnCerrarModalPrinter').addEventListener('click', cerrar);

      document.getElementById('btnConectarUSB').addEventListener('click', async () => {
        await this.conectarUSB();
        this.mostrarModalConfiguracion();
      });

      document.getElementById('btnConectarBT').addEventListener('click', async () => {
        await this.conectarBluetooth();
        this.mostrarModalConfiguracion();
      });

      const selectSys = document.getElementById('selectImpresoraSistema');
      if (selectSys) {
        selectSys.addEventListener('change', (e) => {
          if (e.target.value) {
            this.conectarUSB(e.target.value);
            this.mostrarModalConfiguracion();
          }
        });
      }

      document.getElementById('btnDesconectarPrinter').addEventListener('click', () => {
        this.desconectar();
        this.mostrarModalConfiguracion();
      });

      document.getElementById('btnProbarImpresion').addEventListener('click', async () => {
        await this.imprimirTicketIngreso({
          placa: 'TEST 123',
          tipoVehiculo: 'CARRO',
          tipoServicio: 'fraccion',
          entrada: new Date().toISOString(),
          nombre: 'Ticket de Prueba',
          cedula: '000000',
          tarifaTexto: '$1.500 / 15m'
        });
      });

      modal.classList.add('active');
    }
  }

  const printerServiceInstance = new PrinterService();
  window.PrinterService = printerServiceInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = printerServiceInstance;
  }
})();

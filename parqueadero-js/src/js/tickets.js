/**
 * Renderizador de Tickets Visuales (Modal) - Parking La Primera
 * Réplica exacta de la interfaz gráfica del Comprobante de Cobro y Ticket de Registro
 */

(function () {
  function asegurarModalOverlay() {
    let overlay = document.getElementById('ticketModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ticketModalOverlay';
      overlay.className = 'ticket-modal-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) {
      const hoy = new Date();
      return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    }
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  function formatearHora(fechaStr) {
    if (!fechaStr) return '--:--';
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function cerrarModal() {
    const overlay = document.getElementById('ticketModalOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.innerHTML = '';
      }, 250);
    }
  }

  const TicketsUI = {
    /**
     * Muestra el Ticket de Ingreso / Registro
     * Replicando con exactitud la estética visual del Comprobante de Cobro
     */
    mostrarTicketRegistro(datos, onImprimirCallback) {
      const overlay = asegurarModalOverlay();

      const placa = (datos.placa || '---').toUpperCase();
      const tipoVehiculo = (datos.tipoVehiculo || 'CARRO').toUpperCase();
      const tipoServicio = (datos.tipoServicio || 'COMUN').replace(/_/g, ' ').toUpperCase();
      const fecha = formatearFecha(datos.entrada);
      const horaEntrada = formatearHora(datos.entrada);
      const tarifaTexto = datos.tarifaTexto || (tipoVehiculo === 'MOTO' ? '$1.000 / 15m' : '$1.500 / 15m');

      const clienteNombre = datos.nombre || (datos.cliente ? datos.cliente.nombre : null) || 'Servicio Ocasional';
      const clienteCedula = datos.cedula || (datos.cliente ? datos.cliente.cedula : null) || 'N/A';
      const clienteContacto = datos.telefono || (datos.cliente ? datos.cliente.telefono : null) || 'N/A';

      overlay.innerHTML = `
        <div class="ticket-card" id="ticketCardElement">
          <!-- Cabecera -->
          <div class="ticket-header">
            <div class="ticket-logo-box">
              <span class="ticket-logo-p">P</span>
            </div>
            <h2 class="ticket-title">PARKING LA PRIMERA</h2>
            <span class="ticket-subtitle">Ticket de ingreso</span>
          </div>

          <hr class="ticket-divider">

          <!-- Fecha de Registro -->
          <div class="ticket-row">
            <span class="ticket-label">Fecha registro</span>
            <span class="ticket-value">${fecha}</span>
          </div>

          <!-- Matrícula y Tipo en Caja Azul -->
          <div class="ticket-highlight-box">
            <div class="ticket-highlight-col-left">
              <span class="ticket-hl-label">Matrícula</span>
              <span class="ticket-hl-plate">${placa}</span>
            </div>
            <div class="ticket-highlight-col-right">
              <span class="ticket-hl-label">Tipo de vehículo</span>
              <span class="ticket-hl-vehicle">${tipoVehiculo}</span>
            </div>
          </div>

          <!-- Detalles de Ingreso -->
          <div class="ticket-row">
            <span class="ticket-label">Hora de entrada</span>
            <span class="ticket-value">${horaEntrada}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Tipo de servicio</span>
            <span class="ticket-value">${tipoServicio}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Estado</span>
            <span class="ticket-value" style="color: #059669;">ACTIVO EN PARQUEADERO</span>
          </div>

          <hr class="ticket-divider">

          <!-- Tarifa Inicial / Base -->
          <div class="ticket-total-row">
            <span class="ticket-total-label">TARIFA DEL SERVICIO</span>
            <span class="ticket-total-amount" style="font-size: 22px;">${tarifaTexto}</span>
          </div>

          <hr class="ticket-divider">

          <!-- Datos del Cliente -->
          <div class="ticket-row">
            <span class="ticket-label">Cliente</span>
            <span class="ticket-value">${clienteNombre}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Cédula</span>
            <span class="ticket-value">${clienteCedula}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Contacto</span>
            <span class="ticket-value">${clienteContacto}</span>
          </div>

          <hr class="ticket-divider">

          <!-- Mensaje Centrado -->
          <p class="ticket-footer-text">Conserve este ticket para retirar su vehículo.
Gracias por utilizar nuestro servicio.</p>

          <!-- Botones de Acción -->
          <div class="ticket-actions">
            <button type="button" class="btn-ticket-print" id="btnModalImprimir">
              Imprimir
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button type="button" class="btn-ticket-close" id="btnModalCerrar">
              Cerrar
            </button>
          </div>
        </div>
      `;

      // Enlazar eventos
      document.getElementById('btnModalCerrar').addEventListener('click', cerrarModal);
      document.getElementById('btnModalImprimir').addEventListener('click', () => {
        if (typeof onImprimirCallback === 'function') {
          onImprimirCallback(datos);
        } else if (window.PrinterService) {
          window.PrinterService.imprimirTicketIngreso(datos);
        }
      });

      overlay.classList.add('active');
    },

    /**
     * Muestra el Comprobante de Cobro
     * Réplica exacta de la imagen 'Comprobante de cobro'
     */
    mostrarTicketCobro(datos, onImprimirCallback) {
      const overlay = asegurarModalOverlay();

      const placa = (datos.placa || '---').toUpperCase();
      const tipoVehiculo = (datos.tipoVehiculo || 'CARRO').toUpperCase();
      const tipoServicio = (datos.tipoServicio || 'COMUN').replace(/_/g, ' ').toUpperCase();
      const fecha = formatearFecha(datos.salida || datos.entrada);
      const horaEntrada = formatearHora(datos.entrada);
      const horaSalida = formatearHora(datos.salida || new Date());
      const totalMonto = typeof datos.cobro === 'number' 
        ? `$${datos.cobro.toLocaleString('es-CO')}.00`
        : (datos.cobro || '$0.00');

      const clienteNombre = datos.nombre || (datos.cliente ? datos.cliente.nombre : null) || 'Servicio Ocasional';
      const clienteCedula = datos.cedula || (datos.cliente ? datos.cliente.cedula : null) || 'N/A';
      const clienteContacto = datos.telefono || (datos.cliente ? datos.cliente.telefono : null) || 'N/A';

      overlay.innerHTML = `
        <div class="ticket-card" id="ticketCardElement">
          <!-- Cabecera -->
          <div class="ticket-header">
            <div class="ticket-logo-box">
              <span class="ticket-logo-p">P</span>
            </div>
            <h2 class="ticket-title">PARKING LA PRIMERA</h2>
            <span class="ticket-subtitle">Comprobante de cobro</span>
          </div>

          <hr class="ticket-divider">

          <!-- Fecha de Registro -->
          <div class="ticket-row">
            <span class="ticket-label">Fecha registro</span>
            <span class="ticket-value">${fecha}</span>
          </div>

          <!-- Matrícula y Tipo en Caja Azul -->
          <div class="ticket-highlight-box">
            <div class="ticket-highlight-col-left">
              <span class="ticket-hl-label">Matrícula</span>
              <span class="ticket-hl-plate">${placa}</span>
            </div>
            <div class="ticket-highlight-col-right">
              <span class="ticket-hl-label">Tipo de vehículo</span>
              <span class="ticket-hl-vehicle">${tipoVehiculo}</span>
            </div>
          </div>

          <!-- Horas y Servicio -->
          <div class="ticket-row">
            <span class="ticket-label">Hora de entrada</span>
            <span class="ticket-value">${horaEntrada}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Hora de salida</span>
            <span class="ticket-value">${horaSalida}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Tipo de servicio</span>
            <span class="ticket-value">${tipoServicio}</span>
          </div>

          <hr class="ticket-divider">

          <!-- Cobro por Servicio -->
          <div class="ticket-total-row">
            <span class="ticket-total-label">COBRO POR SERVICIO</span>
            <span class="ticket-total-amount">${totalMonto}</span>
          </div>

          <hr class="ticket-divider">

          <!-- Datos del Cliente -->
          <div class="ticket-row">
            <span class="ticket-label">Cliente</span>
            <span class="ticket-value">${clienteNombre}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Cédula</span>
            <span class="ticket-value">${clienteCedula}</span>
          </div>
          <div class="ticket-row">
            <span class="ticket-label">Contacto</span>
            <span class="ticket-value">${clienteContacto}</span>
          </div>

          <hr class="ticket-divider">

          <!-- Mensaje Centrado -->
          <p class="ticket-footer-text">Gracias por utilizar nuestro servicio.</p>

          <!-- Botones de Acción -->
          <div class="ticket-actions">
            <button type="button" class="btn-ticket-print" id="btnModalImprimir">
              Imprimir
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button type="button" class="btn-ticket-close" id="btnModalCerrar">
              Cerrar
            </button>
          </div>
        </div>
      `;

      // Enlazar eventos
      document.getElementById('btnModalCerrar').addEventListener('click', cerrarModal);
      document.getElementById('btnModalImprimir').addEventListener('click', () => {
        if (typeof onImprimirCallback === 'function') {
          onImprimirCallback(datos);
        } else if (window.PrinterService) {
          window.PrinterService.imprimirTicketCobro(datos);
        }
      });

      overlay.classList.add('active');
    },

    cerrar: cerrarModal
  };

  window.TicketsUI = TicketsUI;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TicketsUI;
  }
})();

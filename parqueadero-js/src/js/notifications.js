/**
 * Sistema de Notificaciones de Parking La Primera
 * Réplica exacta de la interfaz 'Estados del sistema'
 */

(function () {
  const ICONOS = {
    // 1. Éxito (Check en círculo verde)
    success: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `,
    // 2. Parámetros / Advertencia (Signo de exclamación en círculo)
    warning: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `,
    // 3. Contraseña / Autenticación (Candado)
    auth: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `,
    // 4. Impresora (Impresora con alerta)
    printer: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
    `,
    // 5. Error
    error: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `
  };

  function asegurarContenedor() {
    let container = document.getElementById('sys-notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sys-notifications-container';
      container.className = 'sys-notifications-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function crearToast({ tipo = 'success', titulo = '', mensaje = '', duracion = 4500 }) {
    const container = asegurarContenedor();

    // Mapeo seguro de tipo
    const tipoNormalizado = ['success', 'warning', 'auth', 'printer', 'error'].includes(tipo)
      ? tipo
      : (tipo === 'alerta' ? 'warning' : 'success');

    const toast = document.createElement('div');
    toast.className = `sys-toast sys-toast-${tipoNormalizado}`;

    const iconoHtml = ICONOS[tipoNormalizado] || ICONOS.success;

    toast.innerHTML = `
      <div class="sys-toast-icon-wrapper">
        ${iconoHtml}
      </div>
      <div class="sys-toast-content">
        <div class="sys-toast-title">${titulo}</div>
        <div class="sys-toast-desc">${mensaje}</div>
      </div>
      <button type="button" class="sys-toast-close" title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Cerrar al hacer clic en el botón X
    const btnCerrar = toast.querySelector('.sys-toast-close');
    const cerrarToast = () => {
      toast.classList.remove('show');
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    };

    btnCerrar.addEventListener('click', cerrarToast);

    container.appendChild(toast);

    // Activar animación de entrada
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    if (duracion > 0) {
      setTimeout(cerrarToast, duracion);
    }

    return toast;
  }

  /**
   * Función unificada `mostrarNotificacion` para compatibilidad total con el código existente.
   * Admite:
   * 1. mostrarNotificacion({ tipo: 'success', titulo: '...', mensaje: '...' })
   * 2. mostrarNotificacion("Texto del mensaje", esError)
   */
  function mostrarNotificacion(param1, esError = false) {
    if (typeof param1 === 'object' && param1 !== null) {
      return crearToast(param1);
    }

    const texto = String(param1 || '').trim();
    // Limpieza de emojis iniciales que ya traía el código anterior
    const textoLimpio = texto.replace(/^[✅❌⚠️ℹ️🔒]+\s*/, '');

    // Detección inteligente de casos conocidos de la guía de diseño
    const lower = textoLimpio.toLowerCase();

    // 1. Registro exitoso
    if (lower.includes('ingresado con éxito') || lower.includes('vehículo se registró') || (lower.includes('registrado') && !esError)) {
      return crearToast({
        tipo: 'success',
        titulo: 'Registro exitoso',
        mensaje: textoLimpio.includes('Registro exitoso') ? 'El vehículo se registró correctamente.' : textoLimpio
      });
    }

    // 2. Cobro exitoso
    if (lower.includes('cobro exitoso') || lower.includes('cobro realizado') || (lower.includes('cobro') && !esError && !lower.includes('error'))) {
      return crearToast({
        tipo: 'success',
        titulo: 'Cobro exitoso',
        mensaje: 'El cobro se realizó. El comprobante está listo.'
      });
    }

    // 3. Actualización exitosa
    if (lower.includes('actualizad') || lower.includes('actualización') || lower.includes('guardado con éxito')) {
      return crearToast({
        tipo: 'success',
        titulo: 'Actualización exitosa',
        mensaje: 'Los datos se actualizaron correctamente.'
      });
    }

    // 4. Parámetros / Campos requeridos
    if (lower.includes('ingresar la placa') || lower.includes('campos requeridos') || lower.includes('complete todos los campos') || lower.includes('obligatorios') || lower.includes('ingrese una placa')) {
      return crearToast({
        tipo: 'warning',
        titulo: 'Llenar parámetros',
        mensaje: textoLimpio || 'Complete los campos requeridos para continuar.'
      });
    }

    // 5. Impresora no conectada
    if (lower.includes('impresora') && (lower.includes('no conectada') || lower.includes('no hay') || lower.includes('desconectada'))) {
      return crearToast({
        tipo: 'printer',
        titulo: 'Impresora no conectada',
        mensaje: textoLimpio || 'No se detectó ninguna impresora de tickets disponible (USB/Bluetooth).'
      });
    }

    // 6. Contraseña requerida o error de clave
    if (lower.includes('contraseña') || lower.includes('password') || lower.includes('autorizar')) {
      return crearToast({
        tipo: 'auth',
        titulo: lower.includes('incorrecta') ? 'Contraseña incorrecta' : 'Digitar contraseña',
        mensaje: lower.includes('incorrecta') ? 'La clave ingresada no es válida para autorizar la acción.' : 'Ingrese su contraseña para acceder al sistema.'
      });
    }

    // 7. Errores genéricos
    if (esError || lower.includes('error') || lower.includes('no se encontró') || lower.includes('ya se encuentra')) {
      return crearToast({
        tipo: 'error',
        titulo: 'Atención requerida',
        mensaje: textoLimpio
      });
    }

    // 8. Éxito por defecto
    return crearToast({
      tipo: 'success',
      titulo: 'Operación exitosa',
      mensaje: textoLimpio
    });
  }

  // Objeto con métodos específicos directos
  const Notificaciones = {
    registroExitoso(mensaje = 'El vehículo se registró correctamente.') {
      return crearToast({ tipo: 'success', titulo: 'Registro exitoso', mensaje });
    },
    cobroExitoso(mensaje = 'El cobro se realizó. El comprobante está listo.') {
      return crearToast({ tipo: 'success', titulo: 'Cobro exitoso', mensaje });
    },
    actualizacionExitosa(mensaje = 'Los datos se actualizaron correctamente.') {
      return crearToast({ tipo: 'success', titulo: 'Actualización exitosa', mensaje });
    },
    llenarParametros(mensaje = 'Complete los campos requeridos para continuar.') {
      return crearToast({ tipo: 'warning', titulo: 'Llenar parámetros', mensaje });
    },
    digitarContrasena(mensaje = 'Ingrese su contraseña para acceder al sistema.') {
      return crearToast({ tipo: 'auth', titulo: 'Digitar contraseña', mensaje });
    },
    impresoraNoConectada(mensaje = 'No hay ninguna impresora de tickets conectada vía USB o Bluetooth.') {
      return crearToast({ tipo: 'printer', titulo: 'Impresora no conectada', mensaje });
    },
    error(titulo = 'Error del sistema', mensaje = 'Ocurrió un inconveniente al procesar la solicitud.') {
      return crearToast({ tipo: 'error', titulo, mensaje });
    },
    exito(titulo = 'Operación exitosa', mensaje = 'La acción se completó satisfactoriamente.') {
      return crearToast({ tipo: 'success', titulo, mensaje });
    }
  };

  // Exposición en Window
  window.mostrarNotificacion = mostrarNotificacion;
  window.Notificaciones = Notificaciones;

  // Exportar si está en entorno Node/CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mostrarNotificacion, Notificaciones };
  }
})();

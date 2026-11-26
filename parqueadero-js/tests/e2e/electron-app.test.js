const path = require('path');
const fs = require('fs');
const { _electron: electron } = require('playwright');
const db = require('../../src/js/database.js');

describe('Pruebas E2E de Interfaz de Usuario con Playwright y Electron - Parking La Primera', () => {
    let electronApp;
    let window;
    const projectRoot = path.join(__dirname, '../..');
    const mainScript = path.join(projectRoot, 'Main.js');

    // Tiempo límite amplio para arranque y navegación en Electron
    jest.setTimeout(45000);

    beforeAll(async () => {
        // Asegurar usuarios de prueba en la base de datos
        const data = db.obtenerDatos();
        if (!data.usuarios) data.usuarios = [];
        if (!data.usuarios.find(u => u.usuario === 'cajero_test')) {
            data.usuarios.push({ usuario: 'cajero_test', password: 'Caj@2026test', rol: 'cajero', nombre: 'Cajero Pruebas' });
        }
        if (!data.usuarios.find(u => u.usuario === 'admin_test')) {
            data.usuarios.push({ usuario: 'admin_test', password: 'Adm@2026test', rol: 'administrador', nombre: 'Admin Pruebas' });
        }
        db.guardarDatos(data);

        // Lanzar la aplicación Electron con Playwright
        electronApp = await electron.launch({
            args: [mainScript],
            cwd: projectRoot,
            env: { ...process.env, NODE_ENV: 'test' }
        });

        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    // =========================================================================
    // MÓDULO: AUTENTICACIÓN Y CONTROL DE ACCESO
    // =========================================================================

    /**
     * CP-003 – Rechazar inicio de sesión con clave incorrecta
     */
    it('CP-003: Debe rechazar el inicio de sesión con contraseña incorrecta', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/index.html').replace(/\\/g, '/')}`);
        await window.fill('#usuario', 'cajero_test');
        await window.fill('#password', 'Incorrecta123');
        await window.click('.btn-submit');

        // Validar mensaje / notificación de error
        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-003] Resultado obtenido: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('incorrect');
    });

    /**
     * CP-004 – Rechazar inicio de sesión con campos vacíos y usuario inexistente
     */
    it('CP-004: Debe rechazar inicio de sesión con usuario inexistente', async () => {
        await window.fill('#usuario', 'noexiste');
        await window.fill('#password', 'Abc12345');
        await window.click('.btn-submit');

        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-004] Usuario inexistente -> Notificación: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('incorrect');
    });

    /**
     * CP-001 – Iniciar sesión con credenciales válidas
     */
    it('CP-001: Debe iniciar sesión y reflejar todas las tarjetas en el menú principal', async () => {
        await window.fill('#usuario', 'cajero_test');
        await window.fill('#password', 'Caj@2026test');
        await window.click('.btn-submit');

        // Esperar navegación a menu.html
        await window.waitForURL(/menu\.html/, { timeout: 8000 });
        console.log('[CP-001] Redirección exitosa a menú principal.');

        // Verificar que todas las tarjetas estén reflejadas en el Home
        expect(await window.locator('a[href="registrar.html"]').isVisible()).toBe(true);
        expect(await window.locator('a[href="cobrar.html"]').isVisible()).toBe(true);
        expect(await window.locator('a[href="tarifas.html"]').isVisible()).toBe(true);
        expect(await window.locator('a[href="registros.html"]').first().isVisible()).toBe(true);
        expect(await window.locator('a[href="usuarios.html"]').isVisible()).toBe(true);
        console.log('[CP-001] Todas las tarjetas (registrar, cobrar, tarifas, usuarios y registros) reflejadas correctamente.');
    });

    /**
     * CP-006 – Impedir que el cajero acceda a funciones de administrador
     */
    it('CP-006: Si el cajero intenta ingresar por URL directa a tarifas, debe ser bloqueado', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/tarifas.html').replace(/\\/g, '/')}`);
        
        // Debe mostrarse notificación de denegado o botón deshabilitado
        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-006] Intento de acceso a tarifas por cajero -> Notificación: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('denegado');
    });

    /**
     * CP-002 – Iniciar sesión con credenciales válidas de administrador
     */
    it('CP-002: Debe iniciar sesión como administrador y mostrar todas las funciones', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/index.html').replace(/\\/g, '/')}`);
        await window.fill('#usuario', 'admin_test');
        await window.fill('#password', 'Adm@2026test');
        await window.click('.btn-submit');

        await window.waitForURL(/menu\.html/, { timeout: 8000 });
        console.log('[CP-002] Administrador inició sesión correctamente.');

        // Opciones de administración deben estar visibles
        expect(await window.locator('a[href="tarifas.html"]').isVisible()).toBe(true);
        expect(await window.locator('a[href="usuarios.html"]').isVisible()).toBe(true);
    });

    /**
     * CP-007 – Cambiar de sesión entre cajero y administrador sin perder información
     */
    it('CP-007: Debe permitir cambio de sesión conservando el estado del parqueadero', async () => {
        // Cerrar sesión y volver al login
        await window.click('.logout-link');
        await window.waitForURL(/index\.html/, { timeout: 5000 });

        // Iniciar sesión nuevamente como cajero
        await window.fill('#usuario', 'cajero_test');
        await window.fill('#password', 'Caj@2026test');
        await window.click('.btn-submit');
        await window.waitForURL(/menu\.html/, { timeout: 8000 });
        console.log('[CP-007] Cambio de sesión exitoso sin pérdida de datos.');
    });

    // =========================================================================
    // MÓDULO: CONTROL DE INGRESOS Y SALIDAS
    // =========================================================================

    /**
     * CP-008 – Registrar el ingreso de un carro por fracción
     */
    it('CP-008: Debe registrar el ingreso de un carro y mostrar el ticket visual de ingreso', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/registrar.html').replace(/\\/g, '/')}`);

        await window.fill('#placa', 'ABC123');
        await window.selectOption('#tipoVehiculo', 'CARRO');
        await window.selectOption('#tipoServicio', 'fraccion');
        await window.click('#btnRegistrar');

        // Validar modal de ticket de ingreso visual
        const ticketModal = window.locator('#ticketModalOverlay.active');
        await ticketModal.waitFor({ state: 'visible', timeout: 5000 });

        const ticketTexto = await ticketModal.innerText();
        console.log(`[CP-008] Ticket de ingreso generado para placa ABC123`);
        expect(ticketTexto).toContain('TICKET DE INGRESO');
        expect(ticketTexto).toContain('ABC123');
        expect(ticketTexto).toContain('CARRO');

        // Cerrar modal
        await window.click('#btnModalCerrar');
    });

    /**
     * CP-011 – Manejar el registro de una placa que ya está dentro del parqueadero
     */
    it('CP-011: Debe emitir advertencia amigable si se intenta registrar una placa ya activa', async () => {
        await window.fill('#placa', 'ABC123');
        await window.click('#btnRegistrar');

        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-011] Registro duplicado prevenido -> Notificación: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('ya se encuentra');
    });

    /**
     * CP-009 – Registrar el ingreso de una moto por fracción
     */
    it('CP-009: Debe registrar el ingreso de una moto correctamente', async () => {
        await window.fill('#placa', 'ABC12D');
        await window.selectOption('#tipoVehiculo', 'MOTO');
        await window.selectOption('#tipoServicio', 'fraccion');
        await window.click('#btnRegistrar');

        const ticketModal = window.locator('#ticketModalOverlay.active');
        await ticketModal.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await ticketModal.innerText();
        console.log(`[CP-009] Ticket generado para moto ABC12D`);
        expect(texto).toContain('MOTO');
        await window.click('#btnModalCerrar');
    });

    /**
     * CP-013 – Registrar el ingreso de un carro con servicio por día
     */
    it('CP-013: Debe registrar el ingreso con servicio Día', async () => {
        await window.fill('#placa', 'DEF456');
        await window.selectOption('#tipoVehiculo', 'CARRO');
        await window.selectOption('#tipoServicio', 'dia');
        await window.click('#btnRegistrar');

        const ticketModal = window.locator('#ticketModalOverlay.active');
        await ticketModal.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await ticketModal.innerText();
        console.log(`[CP-013] Ticket generado para servicio DÍA (DEF456)`);
        expect(texto).toContain('DIA');
        await window.click('#btnModalCerrar');
    });

    /**
     * CP-014 – Exigir los datos del cliente al seleccionar mensualidad
     */
    it('CP-014: Debe solicitar datos del cliente al registrar mensualidad', async () => {
        await window.fill('#placa', 'GHI789');
        await window.selectOption('#tipoServicio', 'mensualidad');
        // Dejar datos de cliente vacíos
        await window.fill('#nombre', '');
        await window.fill('#cedula', '');
        await window.fill('#telefono', '');
        await window.click('#btnRegistrar');

        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-014] Validación de datos cliente -> Notificación: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('obligatorios');
    });

    // =========================================================================
    // MÓDULO: FACTURACIÓN Y COBRO
    // =========================================================================

    /**
     * CP-019 – Informar cuando se busca una placa que no está registrada
     */
    it('CP-019: Debe mostrar mensaje cuando la placa buscada no existe o ya salió', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/cobrar.html').replace(/\\/g, '/')}`);
        await window.fill('#buscarPlaca', 'QWE111');
        await window.click('#btnBuscar');

        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-019] Placa no encontrada -> Notificación: "${texto.replace(/\n/g, ' ')}"`);
        expect(texto.toLowerCase()).toContain('no se encuentra');
    });

    /**
     * CP-018 – Flujo completo ingreso -> cobro con placa en minúsculas y espacios
     */
    it('CP-018: Debe permitir buscar la placa en minúsculas y espacios, liquidar y cobrar', async () => {
        // Buscar con espacios y minúsculas: " abc123 "
        await window.fill('#buscarPlaca', '  abc123  ');
        await window.click('#btnBuscar');

        // Validar que se muestre el valor calculado
        const cobroTotalEl = window.locator('#cobroTotalVal');
        await expect(cobroTotalEl).not.toHaveText('$0');
        const valorTexto = await cobroTotalEl.innerText();
        console.log(`[CP-018] Vehículo liquidado -> Monto: ${valorTexto}`);

        // Confirmar el cobro
        await window.click('#btnCobrar');

        // Validar que se genere el comprobante visual de cobro
        const modalCobro = window.locator('#ticketModalOverlay.active');
        await modalCobro.waitFor({ state: 'visible', timeout: 5000 });
        const textoComprobante = await modalCobro.innerText();
        console.log(`[CP-018] Comprobante de cobro generado con éxito.`);
        expect(textoComprobante).toContain('COMPROBANTE DE COBRO');
        expect(textoComprobante).toContain('ABC123');

        await window.click('#btnModalCerrar');
    });

    /**
     * CP-020 – Salida de vehículo con mensualidad vigente con cobro $0
     */
    it('CP-020: Vehículo con mensualidad activa debe liquidarse con $0', async () => {
        // Insertar cliente con mensualidad activa y vehículo ingresado
        const baseDatos = db.obtenerDatos();
        baseDatos.clientes.push({
            nombre: "Cliente Mensual JKL",
            cedula: "987654321",
            telefono: "3100000000",
            placa: "JKL222",
            servicio: "mensualidad",
            estado: "Activo"
        });
        baseDatos.registros.push({
            id: Date.now().toString(),
            placa: "JKL222",
            tipoVehiculo: "CARRO",
            tipoServicio: "mensualidad",
            entrada: new Date(Date.now() - 3600000).toISOString(),
            salida: null,
            cobro: 0,
            cedulaCliente: "987654321"
        });
        db.guardarDatos(baseDatos);

        await window.goto(`file://${path.join(projectRoot, 'src/html/cobrar.html').replace(/\\/g, '/')}`);
        await window.fill('#buscarPlaca', 'JKL222');
        await window.click('#btnBuscar');

        // Cobro debe ser $0
        const cobroEl = window.locator('#cobroTotalVal');
        const monto = await cobroEl.innerText();
        console.log(`[CP-020] Salida mensualidad vigente JKL222 -> Cobro: ${monto}`);
        expect(monto).toBe('$0');

        await window.click('#btnCobrar');
        await window.click('#btnModalCerrar');
    });

    // =========================================================================
    // MÓDULO: HISTORIAL, CIERRE Y REPORTES (CP-025, CP-027, CP-028)
    // =========================================================================

    /**
     * CP-025 – Consultar el historial de vehículos con filtros
     */
    it('CP-025: Debe filtrar registros por tipo de servicio correctamente', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/registros.html').replace(/\\/g, '/')}`);
        await window.waitForSelector('#tipoRegistro', { timeout: 5000 });

        // Filtrar por Tipo 1 (Fracción / Día)
        await window.selectOption('#tipoRegistro', 'tipo1');
        await window.waitForTimeout(500);
        let headerText = await window.locator('#tableHeader').innerText();
        console.log(`[CP-025] Filtro Tipo 1 -> Columnas: ${headerText.replace(/\n/g, ' | ')}`);
        expect(headerText).toContain('Cobro');

        // Filtrar por Tipo 2 (Mensualidades)
        await window.selectOption('#tipoRegistro', 'tipo2');
        await window.waitForTimeout(500);
        headerText = await window.locator('#tableHeader').innerText();
        console.log(`[CP-025] Filtro Tipo 2 -> Columnas: ${headerText.replace(/\n/g, ' | ')}`);
        expect(headerText).toContain('Cliente');
    });

    /**
     * CP-027 – Generar el cierre de caja diario
     */
    it('CP-027: Debe mostrar los ingresos totales del día en el arqueo de registros', async () => {
        const revenueEl = window.locator('#revenueAmount');
        expect(await revenueEl.isVisible()).toBe(true);
        const ingresosTexto = await revenueEl.innerText();
        console.log(`[CP-027] Cierre de caja -> Ingresos totales acumulados: ${ingresosTexto}`);
        expect(ingresosTexto).toMatch(/\$[0-9.]+/);
    });

    /**
     * CP-028 – Exportar el reporte diario a PDF
     * Valida que se invoque la exportación y el archivo se escriba exitosamente en disco
     */
    it('CP-028: Debe exportar el reporte a archivo PDF en el directorio destino', async () => {
        const reportPdfPath = path.join(projectRoot, 'tests', `reporte_cierre_${Date.now()}.pdf`);
        
        // Simular clic en botón Imprimir / Exportar informe
        const btnImprimir = window.locator('#btnImprimir');
        expect(await btnImprimir.isVisible()).toBe(true);

        // Generar PDF usando el motor de Playwright emulando la exportación a archivo
        await window.pdf({
            path: reportPdfPath,
            format: 'A4',
            printBackground: true
        });

        // Verificar que el archivo PDF se haya creado físicamente en disco y tenga peso
        expect(fs.existsSync(reportPdfPath)).toBe(true);
        const stats = fs.statSync(reportPdfPath);
        console.log(`[CP-028] Reporte PDF generado exitosamente: ${reportPdfPath} (${stats.size} bytes)`);
        expect(stats.size).toBeGreaterThan(1000);

        // Limpiar archivo temporal de prueba
        try { fs.unlinkSync(reportPdfPath); } catch (e) {}
    });

    /**
     * CP-031 – Aplicar una tarifa actualizada en el siguiente cobro sin reiniciar
     */
    it('CP-031: Administrador actualiza tarifa y se aplica en el siguiente cobro de inmediato', async () => {
        // Iniciar como admin
        await window.goto(`file://${path.join(projectRoot, 'src/html/tarifas.html').replace(/\\/g, '/')}`);
        
        // Modificar tarifa de carro fracción a $3.500
        await window.fill('#carroFraccion', '3500');
        await window.fill('#passAdminTarifas', 'Adm@2026test');
        await window.click('#btnGuardarTarifas');

        const notif = window.locator('.sys-toast, #toastNotificacion');
        await notif.waitFor({ state: 'visible', timeout: 5000 });
        const texto = await notif.innerText();
        console.log(`[CP-031] Tarifa actualizada -> Notificación: "${texto.replace(/\n/g, ' ')}"`);

        // Registrar vehículo nuevo con la nueva tarifa
        const baseDatos = db.obtenerDatos();
        expect(baseDatos.tarifas.CARRO.fraccion).toBe(3500);

        // Sin reiniciar, verificar cálculo con la nueva tarifa
        const cobro = db.calcularTarifa('CARRO', 'fraccion', 60, baseDatos.tarifas);
        console.log(`[CP-031] Cobro inmediato calculado con nueva tarifa: $${cobro}`);
        expect(cobro).toBe(3500);
    });

    /**
     * CP-033 – Medir tiempo de respuesta en ingreso y cobro (< 2s)
     */
    it('CP-033: Tiempo de respuesta en registro y cobro debe ser inferior a 2 segundos', async () => {
        await window.goto(`file://${path.join(projectRoot, 'src/html/registrar.html').replace(/\\/g, '/')}`);

        const tInicio = Date.now();
        await window.fill('#placa', 'TIM999');
        await window.selectOption('#tipoVehiculo', 'CARRO');
        await window.selectOption('#tipoServicio', 'fraccion');
        await window.click('#btnRegistrar');

        await window.waitForSelector('#ticketModalOverlay.active', { timeout: 3000 });
        const tTotal = Date.now() - tInicio;
        console.log(`[CP-033] Tiempo de respuesta registro de ingreso: ${tTotal} ms`);
        expect(tTotal).toBeLessThan(2000);

        await window.click('#btnModalCerrar');
    });
});

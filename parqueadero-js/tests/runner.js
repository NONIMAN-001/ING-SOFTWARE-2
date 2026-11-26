/**
 * ============================================================================
 * MOTOR EJECUTOR DE PRUEBAS (MINI-FRAMEWORK QA) - PARKING LA PRIMERA
 * ============================================================================
 * Ejecutor CLI sin dependencias externas obligatorias para Node.js puro.
 * Cumple con el estándar ISO/IEC/IEEE 29119-3 e ISTQB.
 * 
 * MIGRACIÓN A JEST:
 * Si desea migrar o ejecutar estos casos directamente en Jest:
 * 1. Cada función en tests/test-cases.js puede envolverse en:
 *    describe(caso.modulo, () => {
 *        test(`${caso.id}: ${caso.titulo}`, async () => {
 *            const res = await caso.run({ db, adapter, ... });
 *            expect(res.ok).toBe(true);
 *        });
 *    });
 * 2. Ejecutar con: npx jest tests/unit --verbose
 */

const fs = require('fs');
const path = require('path');
const {
    TEST_DB_PATH,
    resetTestDb,
    readTestDb,
    writeTestDb,
    backupTestDb,
    restoreTestDbBackup,
    cleanupTestFiles,
    createDbInstance,
    BusinessAdapter
} = require('./helpers');
const { CASOS_DE_PRUEBA } = require('./test-cases');

/**
 * Mini-framework de aserciones simples (expect) para Node.js sin dependencias
 */
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Aserción fallida: Esperado [${expected}] pero se obtuvo [${actual}].`);
            }
        },
        toEqual(expected) {
            const actStr = JSON.stringify(actual);
            const expStr = JSON.stringify(expected);
            if (actStr !== expStr) {
                throw new Error(`Aserción fallida: Esperado [${expStr}] pero se obtuvo [${actStr}].`);
            }
        },
        toBeGreaterThan(num) {
            if (!(actual > num)) {
                throw new Error(`Aserción fallida: Se esperaba que [${actual}] fuera mayor que [${num}].`);
            }
        },
        toBeLessThan(num) {
            if (!(actual < num)) {
                throw new Error(`Aserción fallida: Se esperaba que [${actual}] fuera menor que [${num}].`);
            }
        },
        toContain(substring) {
            if (!String(actual).includes(substring)) {
                throw new Error(`Aserción fallida: [${actual}] no contiene [${substring}].`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`Aserción fallida: El valor no debe ser undefined.`);
            }
        }
    };
}

/**
 * Función principal del Runner de Pruebas
 */
async function ejecutarPlanDePruebas() {
    const inicioGlobal = Date.now();
    const resultados = [];

    // Estructuras para agregación y métricas
    const stats = {
        total: CASOS_DE_PRUEBA.length,
        pass: 0,
        fail: 0,
        skip: 0,
        no_automatizable: 0,
        error: 0
    };

    const desgloseModulo = {};
    const desglosePrioridad = {};
    const listaFallidos = [];
    const listaNoAutomatizables = [];

    // Inicializar agrupadores
    CASOS_DE_PRUEBA.forEach(c => {
        if (!desgloseModulo[c.modulo]) {
            desgloseModulo[c.modulo] = { total: 0, pass: 0, fail: 0, skip: 0, no_automatizable: 0, error: 0 };
        }
        if (!desglosePrioridad[c.prioridad]) {
            desglosePrioridad[c.prioridad] = { total: 0, pass: 0, fail: 0, skip: 0, no_automatizable: 0, error: 0 };
        }
        desgloseModulo[c.modulo].total++;
        desglosePrioridad[c.prioridad].total++;
    });

    // Bucle de ejecución caso por caso
    for (const caso of CASOS_DE_PRUEBA) {
        const itemRes = {
            id: caso.id,
            titulo: caso.titulo,
            modulo: caso.modulo,
            requisito: caso.requisito,
            prioridad: caso.prioridad,
            tipo: caso.tipo,
            estado: "PENDIENTE",
            esperado: "",
            obtenido: "",
            evidencia: "",
            duracion_ms: 0,
            timestamp: new Date().toISOString()
        };

        if (!caso.automatizable) {
            // Caso no automatizable (UI, físico, SO, usabilidad)
            itemRes.estado = "NO_AUTOMATIZABLE";
            itemRes.esperado = "N/A - Caso no automatizable mediante CLI/Node.js";
            itemRes.obtenido = "Clasificado como NO_AUTOMATIZABLE";
            itemRes.evidencia = caso.razon_no_automatizable || "Requiere interacción manual o visual.";
            itemRes.duracion_ms = 0;

            stats.no_automatizable++;
            desgloseModulo[caso.modulo].no_automatizable++;
            desglosePrioridad[caso.prioridad].no_automatizable++;
            listaNoAutomatizables.push({
                id: caso.id,
                titulo: caso.titulo,
                razon: caso.razon_no_automatizable
            });

        } else {
            // Caso automatizable: limpiar estado y ejecutar con fixture fresco
            resetTestDb();
            const db = createDbInstance();
            const adapter = new BusinessAdapter(db);

            const t0 = Date.now();
            try {
                const ejecucion = await caso.run({
                    db,
                    adapter,
                    resetTestDb,
                    readTestDb,
                    writeTestDb,
                    backupTestDb,
                    restoreTestDbBackup,
                    TEST_DB_PATH,
                    createDbInstance,
                    expect
                });

                itemRes.duracion_ms = Date.now() - t0;
                itemRes.esperado = typeof ejecucion.esperado === 'object' ? JSON.stringify(ejecucion.esperado) : String(ejecucion.esperado);
                itemRes.obtenido = typeof ejecucion.obtenido === 'object' ? JSON.stringify(ejecucion.obtenido) : String(ejecucion.obtenido);
                itemRes.evidencia = ejecucion.evidencia || "Ejecución completada.";
                if (ejecucion.usando_stub) {
                    itemRes.usando_stub = true;
                }

                if (ejecucion.ok === true) {
                    itemRes.estado = "PASS";
                    stats.pass++;
                    desgloseModulo[caso.modulo].pass++;
                    desglosePrioridad[caso.prioridad].pass++;
                } else {
                    itemRes.estado = "FAIL";
                    stats.fail++;
                    desgloseModulo[caso.modulo].fail++;
                    desglosePrioridad[caso.prioridad].fail++;
                    listaFallidos.push({
                        id: caso.id,
                        titulo: caso.titulo,
                        mensaje: `Fallo de validación. Esperado: ${itemRes.esperado}. Obtenido: ${itemRes.obtenido}.`
                    });
                }
            } catch (err) {
                itemRes.duracion_ms = Date.now() - t0;
                itemRes.estado = "ERROR";
                itemRes.esperado = "Ejecución sin excepciones no controladas";
                itemRes.obtenido = `Excepción: ${err.message}`;
                itemRes.evidencia = err.stack ? err.stack.split('\n').slice(0, 3).join(' ') : err.message;

                stats.error++;
                desgloseModulo[caso.modulo].error++;
                desglosePrioridad[caso.prioridad].error++;
                listaFallidos.push({
                    id: caso.id,
                    titulo: caso.titulo,
                    mensaje: `Error en tiempo de ejecución: ${err.message}`
                });
            }
        }

        resultados.push(itemRes);

        // Imprimir en consola en el formato exacto requerido por el usuario (legible por IA)
        console.log(`=== TEST ${itemRes.id} ===`);
        console.log(JSON.stringify(itemRes, null, 2));
    }

    // Limpieza de archivos temporales al finalizar
    cleanupTestFiles();

    // Resumen Agregado en formato JSON legible por IA
    const resumenFinal = {
        resumen: {
            total: stats.total,
            pass: stats.pass,
            fail: stats.fail,
            skip: stats.skip,
            no_automatizable: stats.no_automatizable,
            error: stats.error,
            duracion_total_ms: Date.now() - inicioGlobal
        },
        desglose_por_modulo: desgloseModulo,
        desglose_por_prioridad: desglosePrioridad,
        fallidos: listaFallidos,
        no_automatizables: listaNoAutomatizables,
        criterio_salida_cumplido: (stats.fail === 0 && stats.error === 0),
        timestamp: new Date().toISOString()
    };

    console.log("\n=== RESUMEN EJECUTIVO QA (PLAN DE PRUEBAS) ===");
    console.log(JSON.stringify(resumenFinal, null, 2));

    // Código de salida del proceso
    if (stats.fail > 0 || stats.error > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

module.exports = {
    ejecutarPlanDePruebas,
    expect
};

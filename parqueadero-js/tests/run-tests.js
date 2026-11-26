#!/usr/bin/env node

/**
 * ============================================================================
 * EJECUTOR MAESTRO DE CALIDAD (QA) - PARKING LA PRIMERA
 * ============================================================================
 * Punto de entrada llamado por 'npm test'.
 * Delega al ejecutor modular 'tests/runner.js' para Node.js puro.
 * ============================================================================
 */

const { ejecutarPlanDePruebas } = require('./runner');

ejecutarPlanDePruebas().catch(err => {
    console.error("Error fatal en la suite de pruebas:", err);
    process.exit(1);
});

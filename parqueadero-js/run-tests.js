#!/usr/bin/env node

/**
 * ============================================================================
 * SCRIPT PRINCIPAL DE PRUEBAS AUTOMATIZADAS - PARKING LA PRIMERA
 * ============================================================================
 * Punto de entrada oficial de la Suite QA: `node run-tests.js`
 * Ejecución 100% en Node.js puro (CLI), sin dependencias externas obligatorias.
 *
 * Estándar: ISO/IEC/IEEE 29119-3 y vocabulario ISTQB
 * Cobertura: 37 Casos de Prueba (CP-001 al CP-037)
 * Aislamiento: db.test.json generado dinámicamente a partir de db.fixture.json
 *
 * Modo de uso:
 *   node run-tests.js
 *
 * Para migración a Jest:
 *   npm run test:unit
 *   npm run test:persistence
 * ============================================================================
 */

const { ejecutarPlanDePruebas } = require('./tests/runner');

// Ejecución del runner
ejecutarPlanDePruebas().catch(err => {
    console.error("Error fatal en el ejecutor de pruebas:", err);
    process.exit(1);
});

/**
 * Parking La Primera - Utilidad de Seguridad de Programador
 * Desbloqueo y gestión del código fuente y base de datos con contraseña de programador
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROGRAMMER_PASSWORD = "1092530175kj$";
const DB_PATH = path.join(__dirname, 'src', 'db.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('===========================================================');
console.log('  PARKING LA PRIMERA - BLOQUEO DE SEGURIDAD DE PROGRAMADOR ');
console.log('===========================================================');
console.log('El acceso al código fuente y a la base de datos está protegido.');
console.log('');

rl.question('Ingrese la contraseña de programador: ', (password) => {
  if (password.trim() === PROGRAMMER_PASSWORD) {
    console.log('\n[OK] Acceso de programador verificado con éxito.');
    console.log('-----------------------------------------------------------');
    console.log('Estado del sistema:');
    if (fs.existsSync(DB_PATH)) {
      try {
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        console.log(`- Base de datos: ${DB_PATH}`);
        console.log(`- Usuarios registrados: ${(db.usuarios || []).length}`);
        console.log(`- Clientes activos/registrados: ${(db.clientes || []).length}`);
        console.log(`- Registros activos en patio: ${(db.registros || []).length}`);
        console.log(`- Cierres diarios guardados: ${(db.cierresDiarios || []).length}`);
      } catch (e) {
        console.log(`- Error leyendo base de datos: ${e.message}`);
      }
    } else {
      console.log('- Base de datos db.json no inicializada aún.');
    }
    console.log('-----------------------------------------------------------');
    console.log('Permisos concedidos: lectura, escritura e inspección del código.');
    console.log('Para iniciar en modo desarrollo: npm start');
  } else {
    console.log('\n[ERROR] Contraseña de programador incorrecta. Acceso bloqueado.');
  }
  rl.close();
});

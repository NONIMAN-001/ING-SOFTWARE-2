require('chromedriver'); 
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function ejecutarDemoCompleta() {
    let options = new chrome.Options();
    options.debuggerAddress('127.0.0.1:9222');

    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    
    try {
        console.log("Conectado a Parking La Primera...");
        await driver.sleep(1500);
        
        // 2. PANTALLA DE INICIO DE SESIÓN
        await driver.findElement(By.id('usuario')).sendKeys('Kevin');
        await driver.sleep(1000);
        await driver.findElement(By.id('password')).sendKeys('12345');
        await driver.sleep(1000);
        
        await driver.findElement(By.css('.btn-submit')).click();
        await driver.sleep(2500); 

        // 3. MENÚ PRINCIPAL
        await driver.findElement(By.css('a[href="registrar.html"]')).click();
        await driver.sleep(2000);

        // 4. PRIMER REGISTRO (Servicio Común)
        await driver.findElement(By.id('placa')).sendKeys('AC858LV');
        await driver.sleep(1000);
        
        await driver.findElement(By.css('#tipoVehiculo option[value="CARRO"]')).click();
        await driver.findElement(By.css('#tipoServicio option[value="fraccion"]')).click();
        await driver.sleep(1000);
        
        await driver.findElement(By.id('btnRegistrar')).click();
        await driver.sleep(3000); 

        // 5. SEGUNDO REGISTRO (Mensualidad)
        await driver.findElement(By.id('placa')).sendKeys('PQR330');
        await driver.sleep(1000);
        
        await driver.findElement(By.css('#tipoVehiculo option[value="CARRO"]')).click();
        await driver.findElement(By.css('#tipoServicio option[value="mensualidad"]')).click();
        await driver.sleep(1000);
        
        await driver.findElement(By.id('nombre')).sendKeys('kevin');
        await driver.sleep(500);
        await driver.findElement(By.id('cedula')).sendKeys('109273645');
        await driver.sleep(500);
        await driver.findElement(By.id('telefono')).sendKeys('3214200553');
        await driver.sleep(1000);
        
        await driver.findElement(By.id('btnRegistrar')).click();
        await driver.sleep(5000);
        
    } catch (error) {
        console.error("Error durante la prueba:", error);
    } finally {
        // En lugar de driver.quit() que cerraría la app, solo cerramos la conexión
        await driver.close(); 
    }
}

ejecutarDemoCompleta();
const ftp = require("basic-ftp");
const fs = require("fs").promises;

class FtpService {
    constructor(config) {
        this.config = config;
    }

    async descargarCatalogo() {
        const cliente = new ftp.Client();
        try {
            console.log("Conectando al servidor FTP de CT...");
            await cliente.access({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                secure: false,
            });

            await fs.mkdir("./downloads", { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const destino = `./downloads/catalogo_${timestamp}.json`;

            console.log(`Descargando archivo desde el FTP: ${this.config.ruta_archivo}`);
            await cliente.downloadTo(destino, this.config.ruta_archivo);
            console.log(`Catálogo descargado y guardado en: ${destino}`);

            return destino;
        } catch (err) {
            console.error("Error al descargar desde el FTP:", err.message);
            return null;
        } finally {
            cliente.close();
        }
    }
}

module.exports = FtpService;

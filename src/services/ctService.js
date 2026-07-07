const axios = require("axios");
const fs = require("fs").promises;

class CtService {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.sandbox 
            ? "http://sandbox.ctonline.mx" 
            : "https://api.ctonline.mx";
    }

    async obtenerToken() {
        const url = `${this.baseUrl}/cliente/token`;
        try {
            const response = await axios.post(url, {
                email: this.config.email,
                cliente: this.config.cliente,
                rfc: this.config.rfc
            });

            if (response.data && response.data.token) {
                return response.data.token;
            } else {
                throw new Error("No se recibió token en la respuesta");
            }
        } catch (err) {
            const apiError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            throw new Error(`Error al autenticar con CT API: ${apiError}`);
        }
    }

    async descargarCatalogo() {
        try {
            const token = await this.obtenerToken();
            const url = `${this.baseUrl}/articulos/listado`;
            
            console.log("Descargando catálogo desde la API de CT...");
            const response = await axios.get(url, {
                headers: {
                    "x-auth": token,
                    "Content-Type": "application/json"
                }
            });

            await fs.mkdir("./downloads", { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const destino = `./downloads/catalogo_${timestamp}.json`;

            await fs.writeFile(destino, JSON.stringify(response.data, null, 2));
            console.log(`Catálogo guardado en: ${destino}`);

            return destino;
        } catch (err) {
            const apiError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            console.error(`Error al descargar catálogo: ${apiError}`);
            return null;
        }
    }
}

module.exports = CtService;

const axios = require("axios");

const esperar = (ms) => new Promise((res) => setTimeout(res, ms));

class ShopifyService {
    constructor(shopifyConfig, modoPrueba = true) {
        this.config = shopifyConfig;
        this.modoPrueba = modoPrueba;
        this.baseUrl = `https://${this.config.shop_name}/admin/api/2024-01`;
    }

    async shopifyRequest(metodo, endpoint, datos = null) {
        const url = `${this.baseUrl}/${endpoint}`;
        try {
            const res = await axios({
                method: metodo,
                url,
                headers: {
                    "X-Shopify-Access-Token": this.config.access_token,
                    "Content-Type": "application/json",
                },
                data: datos,
            });
            return res.data;
        } catch (err) {
            const msg = err.response?.data?.errors || err.message;
            throw new Error(`Shopify ${metodo} ${endpoint} -> ${JSON.stringify(msg)}`);
        }
    }

    async buscarEnShopify(sku) {
        try {
            const res = await this.shopifyRequest("GET", `variants.json?sku=${sku}`);
            if (res.variants && res.variants.length > 0) {
                return { id: res.variants[0].product_id };
            }
            return null;
        } catch (err) {
            console.error(`Error al buscar variante SKU ${sku}: ${err.message}`);
            return null;
        }
    }

    async sincronizarProductos(productos) {
        if (this.modoPrueba) {
            console.log("Modo prueba activo, omitiendo subida a Shopify.");
            return;
        }

        if (!this.config.shop_name || !this.config.access_token) {
            console.log("Faltan credenciales de Shopify en la configuración.");
            return;
        }

        console.log(`Sincronizando ${productos.length} productos con Shopify...`);

        let creados = 0;
        let actualizados = 0;
        let errores = 0;

        for (const p of productos) {
            if (p.existencia <= 0) continue;

            const payload = {
                product: {
                    title: p.nombre,
                    vendor: p.marca,
                    product_type: p.categoria,
                    body_html: p.descripcion || "",
                    images: p.imagen ? [{ src: p.imagen }] : [],
                    variants: [
                        {
                            sku: p.sku,
                            price: p.precioFinal.toString(),
                            inventory_quantity: p.existencia,
                            inventory_management: "shopify",
                            barcode: p.ean || "",
                            requires_shipping: true,
                        },
                    ],
                },
            };

            try {
                const existente = await this.buscarEnShopify(p.sku);

                if (existente) {
                    await this.shopifyRequest("PUT", `products/${existente.id}.json`, payload);
                    actualizados++;
                } else {
                    await this.shopifyRequest("POST", "products.json", payload);
                    creados++;
                }

                process.stdout.write(`\rCreados: ${creados} | Actualizados: ${actualizados} | Errores: ${errores}`);
                await esperar(600);
            } catch (err) {
                errores++;
                console.error(`\nError al sincronizar SKU ${p.sku}: ${err.message}`);
            }
        }

        console.log(`\nSincronización completada. Creados: ${creados} | Actualizados: ${actualizados} | Errores: ${errores}`);
    }
}

module.exports = ShopifyService;

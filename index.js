const config = require("./config.json");
const cron = require("node-cron");
const fs = require("fs").promises;
const { calcularPrecio } = require("./src/utils/calculator");
const FtpService = require("./src/services/ftpService");
const ShopifyService = require("./src/services/shopifyService");

const ftpService = new FtpService(config.ftp);
const shopifyService = new ShopifyService(config.shopify, config.sync.modo_prueba);

async function procesarProductos(rutaArchivo) {
    const contenido = await fs.readFile(rutaArchivo, "utf-8");
    const datos = JSON.parse(contenido);
    const lista = Array.isArray(datos) ? datos : [datos];

    const resultados = [];
    let sinPrecio = 0;

    for (const p of lista) {
        if (!p.precio || p.precio <= 0) {
            sinPrecio++;
            continue;
        }

        let existenciaTotal = 0;
        if (p.existencia && typeof p.existencia === "object") {
            const permitidos = config.ct_connect.almacenes_permitidos || [];
            if (permitidos.length > 0) {
                existenciaTotal = Object.entries(p.existencia)
                    .filter(([codigoAlmacen]) => permitidos.includes(codigoAlmacen))
                    .reduce((total, [_, stock]) => total + stock, 0);
            } else {
                existenciaTotal = Object.values(p.existencia).reduce((a, b) => a + b, 0);
            }
        }

        const moneda = p.moneda || "USD";
        const tipoCambio = p.tipoCambio || 17.5;

        let precioBase = p.precio;
        if (p.promociones?.length > 0) {
            const ahora = new Date();
            const promo = p.promociones.find((pr) => {
                return ahora >= new Date(pr.vigencia?.inicio) && ahora <= new Date(pr.vigencia?.fin);
            });
            if (promo) precioBase = promo.promocion;
        }

        const precios = calcularPrecio(precioBase, moneda, tipoCambio);

        resultados.push({
            sku: p.clave,
            nombre: p.nombre,
            marca: p.marca,
            categoria: p.categoria,
            subcategoria: p.subcategoria,
            descripcion: p.descripcion_corta,
            imagen: p.imagen,
            ean: p.ean,
            existencia: existenciaTotal,
            ...precios,
        });
    }

await fs.mkdir("./processed", { recursive: true });
await fs.writeFile("./processed/precios_finales.json", JSON.stringify(resultados, null, 2));

const archivoPrevio = "./processed/precios_previos.json";
let previos = {};

try {
    const prev = JSON.parse(await fs.readFile(archivoPrevio, "utf-8"));
    prev.forEach((p) => {
        previos[p.sku] = { precioFinal: p.precioFinal, existencia: p.existencia };
    });
} catch {
    console.log("Primera ejecución, se sincronizan todos los productos.");
}

const cambiados = resultados.filter((p) => {
    const prev = previos[p.sku];
    if (!prev) return true;
    return prev.precioFinal !== p.precioFinal || prev.existencia !== p.existencia;
});

await fs.writeFile(archivoPrevio, JSON.stringify(resultados, null, 2));
console.log(`Productos leídos: ${lista.length} | Sin precio: ${sinPrecio} | Con cambios: ${cambiados.length}`);

return cambiados;
}

async function sync() {
    const inicio = new Date();
    console.log(`\n[${inicio.toLocaleString("es-MX")}] Iniciando sincronización...`);

    let rutaArchivo = config.sync.archivo_local || null;

    if (!rutaArchivo) {
        rutaArchivo = await ftpService.descargarCatalogo();
    }

    if (!rutaArchivo) {
        console.error("No se pudo obtener el catálogo de productos.");
        return;
    }

    try {
        const productos = await procesarProductos(rutaArchivo);
        if (!productos || productos.length === 0) {
            console.log("No hay productos con cambios para sincronizar.");
            return;
        }

        await shopifyService.sincronizarProductos(productos);
    } catch (err) {
        console.error("Error durante el procesamiento / sincronización:", err.message);
    }

    const duracion = ((new Date() - inicio) / 1000).toFixed(1);
    console.log(`Ciclo completado en ${duracion}s`);
}

sync();

const intervalo = config.sync.intervalo_minutos || 30;
console.log(`Servicio activo. Sincronización programada cada ${intervalo} minutos.`);
cron.schedule(`*/${intervalo} * * * *`, sync);
function calcularPrecio(precio, moneda, tipoCambio) {
    const costoMXN = moneda === "MXN" ? precio : precio * tipoCambio;

    let multiplicador;
    if (costoMXN < 11) multiplicador = 3.0;
    else if (costoMXN < 101) multiplicador = 2.0;
    else if (costoMXN < 201) multiplicador = 1.5;
    else if (costoMXN < 501) multiplicador = 1.4;
    else if (costoMXN < 3001) multiplicador = 1.3;
    else if (costoMXN < 5001) multiplicador = 1.2;
    else if (costoMXN < 10001) multiplicador = 1.15;
    else multiplicador = 1.1;

    const subtotal = costoMXN * multiplicador;
    const iva = subtotal * 0.16;
    const comision = subtotal * 0.046;
    const precioFinal = subtotal + iva + comision;

    return {
        precio,
        moneda,
        tipoCambio,
        costoMXN: parseFloat(costoMXN.toFixed(2)),
        multiplicador,
        subtotal: parseFloat(subtotal.toFixed(2)),
        iva: parseFloat(iva.toFixed(2)),
        comision: parseFloat(comision.toFixed(2)),
        precioFinal: parseFloat(precioFinal.toFixed(2)),
    };
}

module.exports = { calcularPrecio };

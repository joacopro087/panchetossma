document.addEventListener('DOMContentLoaded', () => {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const nombre_sucursal = sessionStorage.getItem('nombre_sucursal');
    const empleado = sessionStorage.getItem('empleado');

    if (!id_sucursal || !empleado) {
        alert('Acceso denegado. Identifícate primero.');
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('txtSucursal').innerText = nombre_sucursal;
    document.getElementById('txtEmpleado').innerText = empleado.toUpperCase();

    obtenerStockActual();
});

async function obtenerStockActual() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    try {
        const respuesta = await fetch('/api/reportes');
        const datos = await respuesta.json();
        
        const miStock = datos.stock.find(local => local.id_sucursal == id_sucursal);
        if (miStock) {
            document.getElementById('boxpan').value = Number(miStock.docenas_pan).toFixed(1);
            document.getElementById('boxsalchichas').value = miStock.salchichas;
            document.getElementById('boxg500').value = miStock.gaseosas_500;
            document.getElementById('boxg15').value = miStock.gaseosas_15;
        }
    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}

async function establecerStockInicial() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const docenas_pan = parseFloat(document.getElementById('boxpan').value) || 0;
    const salchichas = parseInt(document.getElementById('boxsalchichas').value) || 0;
    const gaseosas_500 = parseInt(document.getElementById('boxg500').value) || 0;
    const gaseosas_15 = parseInt(document.getElementById('boxg15').value) || 0;

    try {
        const respuesta = await fetch('/api/stock/establecer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 })
        });
        if (respuesta.ok) {
            alert('¡Inventario de almacén registrado con éxito para hoy!');
            obtenerStockActual();
        } else {
            alert('Error al guardar datos en la base de datos.');
        }
    } catch (error) {
        alert('Error de red al intentar sincronizar.');
    }
}

async function registrarOperacion(nombreProducto, precio, tipo) {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const empleado = sessionStorage.getItem('empleado');
    const productoFinal = tipo === 'gratis' ? `${nombreProducto} (CONSUMO DUEÑO)` : nombreProducto;

    const ventaData = {
        id_sucursal: parseInt(id_sucursal),
        empleado: empleado,
        producto: productoFinal,
        cantidad: 1,
        precio_unitario: precio
    };

    try {
        const respuesta = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });
        if (respuesta.ok) {
            if (tipo === 'gratis') {
                alert(`¡Registrado! 🎁 Sacaste 1 ${nombreProducto} gratis de stock.`);
            } else {
                alert(`¡${nombreProducto} anotado con éxito!`);
            }
            obtenerStockActual();
        }
    } catch (error) {
        alert('Sin conexión con el servidor central.');
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

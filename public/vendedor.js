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
    obtenerVentasDelTurno();
});

async function obtenerStockActual() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    try {
        const respuesta = await fetch('/api/reportes');
        const datos = await respuesta.json();
        
        const miStock = datos.stock.find(local => local.id_sucursal == id_sucursal);
        if (miStock) {
            document.getElementById('boxpan').value = miStock.docenas_pan ? Number(miStock.docenas_pan).toFixed(1) : "0.0";
            document.getElementById('boxsalchichas').value = miStock.salchichas !== undefined ? miStock.salchichas : 0;
            document.getElementById('boxg500').value = miStock.gaseosas_500 !== undefined ? miStock.gaseosas_500 : 0;
            document.getElementById('boxg15').value = miStock.gaseosas_15 !== undefined ? miStock.gaseosas_15 : 0;
        }
    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}

async function obtenerVentasDelTurno() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const tabla = document.getElementById('tablaTurnoLocal');
    try {
        const respuesta = await fetch(`/api/reportes/local/${id_sucursal}`);
        const datos = await respuesta.json();
        tabla.innerHTML = '';

        if (datos.length === 0) {
            tabla.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">La caja está vacía. Registra una venta.</td></tr>';
            return;
        }

        datos.forEach(fila => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${fila.producto}</b></td>
                <td>${fila.cantidad} unidades</td>
                <td>$${Number(fila.total).toLocaleString('es-AR')}</td>
            `;
            tabla.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
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
        }
    } catch (error) {
        alert('Error al sincronizar.');
    }
}

async function registrarOperacion(nombreProducto, precio, tipo) {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const empleado = sessionStorage.getItem('empleado');
    
    // Capturar el valor del multiplicador libre de la pantalla (de 2 a infinito)
    const inputCantidad = document.getElementById('multiplicadorVenta');
    const cantidadSeleccionada = parseInt(inputCantidad.value) || 1;

    if (cantidadSeleccionada < 1) {
        alert("La cantidad debe ser mayor o igual a 1.");
        return;
    }

    const productoFinal = tipo === 'gratis' ? `${nombreProducto} (CONSUMO DUEÑO)` : nombreProducto;

    const ventaData = {
        id_sucursal: parseInt(id_sucursal),
        empleado: empleado,
        producto: productoFinal,
        cantidad: cantidadSeleccionada, // Mandamos la cantidad libre
        precio_unitario: precio
    };

    try {
        const respuesta = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });
        if (respuesta.ok) {
            // Reiniciar el casillero multiplicador a 1 automáticamente por seguridad
            inputCantidad.value = 1;
            obtenerStockActual();
            obtenerVentasDelTurno();
        }
    } catch (error) {
        alert('Sin conexión.');
    }
}

async function prepararTicketParaFoto() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const nombre_sucursal = sessionStorage.getItem('nombre_sucursal');
    const empleado = sessionStorage.getItem('empleado');

    try {
        const respuesta = await fetch(`/api/reportes/local/${id_sucursal}`);
        const datos = await respuesta.json();
        
        let totalAcumulado = 0;
        const contenedorDesglose = document.getElementById('tickDesglose');
        contenedorDesglose.innerHTML = '';

        if(datos.length === 0) {
            contenedorDesglose.innerHTML = '<p style="color:#999; text-align:center;">Sin movimientos comerciales en el turno.</p>';
        } else {
            datos.forEach(item => {
                totalAcumulado += Number(item.total);
                const p = document.createElement('p');
                p.style.display = 'flex';
                p.style.justifyContent = 'space-between';
                p.innerHTML = `<span>• ${item.producto} (x${item.cantidad})</span> <span>$${Number(item.total).toLocaleString('es-AR')}</span>`;
                contenedorDesglose.appendChild(p);
            });
        }

        document.getElementById('tickSucursal').innerText = nombre_sucursal;
        document.getElementById('tickEmpleado').innerText = empleado.toUpperCase();
        document.getElementById('tickFecha').innerText = new Date().toLocaleString('es-AR');
        document.getElementById('tickTotal').innerText = `$${totalAcumulado.toLocaleString('es-AR')}`;

        document.getElementById('modalTicket').style.display = 'flex';
    } catch (error) {
        alert('Error al procesar el recibo para la foto.');
    }
}

async function borrarVentasYLoguearOut() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');

    if (!confirm("⚠️ ¿ATENCIÓN! Al aceptar, todas las ventas de hoy se borrarán para siempre del servidor y no habrá vuelta atrás. ¿Ya sacaste la foto?")) {
        return;
    }

    try {
        const respuesta = await fetch('/api/caja/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_sucursal })
        });
        
        if (respuesta.ok) {
            alert('🔥 Caja purgada. Las ventas se eliminaron del servidor para siempre. Iniciando próximo turno en \$0.');
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (error) {
        alert('Error al intentar purgar la base de datos.');
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

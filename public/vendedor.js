// Variable global para guardar el pedido que se está armando en el momento
let carritoPedidoActual = [];

document.addEventListener('DOMContentLoaded', () => {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const nombre_sucursal = sessionStorage.getItem('nombre_sucursal');
    const empleado = sessionStorage.getItem('empleado');

    if (!id_sucursal || !empleado) {
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

// 🛒 AGREGA EL PRODUCTO AL PEDIDO TEMPORAL (Soporta multiplicador de 2 a infinito)
function agregarAlPedido(nombreProducto, precio, tipo) {
    const inputCantidad = document.getElementById('multiplicadorVenta');
    const cantidadSeleccionada = parseInt(inputCantidad.value) || 1;

    if (cantidadSeleccionada < 1) return;

    const productoFinal = tipo === 'gratis' ? `${nombreProducto} (CONSUMO DUEÑO)` : nombreProducto;

    const itemExistente = carritoPedidoActual.find(item => item.producto === productoFinal);
    
    if (itemExistente) {
        itemExistente.cantidad += cantidadSeleccionada;
    } else {
        carritoPedidoActual.push({
            producto: productoFinal,
            precio_unitario: precio,
            cantidad: cantidadSeleccionada
        });
    }

    inputCantidad.value = 1; // Reiniciar a 1 por comodidad
    renderizarCarritoEnPantalla();
}

// Dibuja la lista de lo que va pidiendo el cliente en la columna derecha
function renderizarCarritoEnPantalla() {
    const contenedor = document.getElementById('carritoContenedor');
    const textoTotal = document.getElementById('totalCarritoTexto');
    contenedor.innerHTML = '';
    
    let totalAcumulado = 0;

    if (carritoPedidoActual.length === 0) {
        contenedor.innerHTML = '<p style="color:#999; text-align:center; padding-top:20px;">El pedido está vacío.<br>Toca los botones de la izquierda.</p>';
        textoTotal.innerText = '\$0';
        return;
    }

    carritoPedidoActual.forEach((item, index) => {
        const subtotalItem = item.cantidad * item.precio_unitario;
        totalAcumulado += subtotalItem;

        const div = document.createElement('div');
        div.className = 'item-carrito';
        div.innerHTML = `
            <span><b>${item.producto}</b> (x${item.cantidad})</span>
            <span>$${subtotalItem.toLocaleString('es-AR')} 
                <button class="btn-quitar" onclick="quitarItemDelCarrito(${index})">❌</button>
            </span>
        `;
        contenedor.appendChild(div);
    });

    textoTotal.innerText = `$${totalAcumulado.toLocaleString('es-AR')}`;
}

function quitarItemDelCarrito(index) {
    carritoPedidoActual.splice(index, 1);
    renderizarCarritoEnPantalla();
}

function limpiarCarritoTemporal() {
    carritoPedidoActual = [];
    renderizarCarritoEnPantalla();
}

// 🚀 ENVÍA TODO EL PEDIDO EN GRUPO AL SERVIDOR AL TOCAR FINALIZAR VENTA
async function finalizarPedidoCentral() {
    if (carritoPedidoActual.length === 0) {
        alert("Agrega por lo menos un producto para finalizar la venta.");
        return;
    }

    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const empleado = sessionStorage.getItem('empleado');

    try {
        // Enviar cada ítem del carrito en paralelo al servidor central de internet
        for (const item of carritoPedidoActual) {
            await fetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_sucursal: parseInt(id_sucursal),
                    empleado: empleado,
                    producto: item.producto,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario
                })
            });
        }

        // Vaciar carrito temporal, refrescar almacén e historial acumulado en silencio
        limpiarCarritoTemporal();
        obtenerStockActual();
        obtenerVentasDelTurno();

    } catch (error) {
        console.error("Error al liquidar pedido:", error);
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
            obtenerStockActual();
        }
    } catch (error) {
        console.error('Error al sincronizar.');
    }
}

// PASO 1: Desplegar el ticket dashed en la pantalla sin borrar la base de datos todavía
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
        console.error('Error al procesar el recibo para la foto.');
    }
}

// PASO 2: Borrado destructivo absoluto de la base de datos luego de la foto
async function borrarVentasYLoguearOut() {
    const id_sucursal = sessionStorage.getItem('id_sucursal');

    if (!confirm("⚠️ ¿Estás seguro? Se borrarán todas las ventas de hoy para siempre del servidor. ¿Ya sacaron la foto?")) {
        return;
    }

    try {
        const respuesta = await fetch('/api/caja/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_sucursal })
        });
        
        if (respuesta.ok) {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error al intentar purgar la base de datos.');
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

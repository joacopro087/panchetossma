async function cargarMétricas() {
    const tablaVentas = document.getElementById('tablaAdmin');
    const tablaStock = document.getElementById('tablaStock');
    
    try {
        const respuesta = await fetch('/api/reportes');
        const datos = await respuesta.json();
        
        // 1. Pintar Ventas
        tablaVentas.innerHTML = '';
        if (datos.ventas.length === 0) {
            tablaVentas.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas registradas.</td></tr>';
        } else {
            datos.ventas.forEach(fila => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge-sucursal">${fila.sucursal}</span></td>
                    <td>${fila.empleado.toUpperCase()}</td>
                    <td><b>${fila.producto}</b></td>
                    <td>${fila.total_panchos} u.</td>
                    <td>$${fila.total_recaudado.toLocaleString()}</td>
                `;
                tablaVentas.appendChild(tr);
            });
        }

        // 2. Pintar Insumos Reales
        tablaStock.innerHTML = '';
        datos.stock.forEach(local => {
            const tr = document.createElement('tr');
            // Redondear las docenas a un decimal para que sea legible (ej: 12.5 docenas)
            let panFormateado = Number(local.docenas_pan).toFixed(1);
            
            tr.innerHTML = `
                <td><b>${local.nombre}</b></td>
                <td><b>${panFormateado} doz.</b></td>
                <td>${local.salchichas} u.</td>
                <td>${local.gaseosas_500} u.</td>
                <td>${local.gaseosas_15} u.</td>
            `;
            tablaStock.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al traer reportes:", error);
    }
}

async function enviarMercaderia() {
    const id_sucursal = document.getElementById('recargaSucursal').value;
    const docenas_pan = parseFloat(document.getElementById('recargaPan').value) || 0;
    const salchichas = parseInt(document.getElementById('recargaSalchichas').value) || 0;
    const gaseosas_500 = parseInt(document.getElementById('recargaG500').value) || 0;
    const gaseosas_15 = parseInt(document.getElementById('recargaG15').value) || 0;

    const respuesta = await fetch('/api/stock/recargar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 })
    });

    if (respuesta.ok) {
        alert("¡Insumos agregados con éxito!");
        document.getElementById('recargaPan').value = '';
        document.getElementById('recargaSalchichas').value = '';
        document.getElementById('recargaG500').value = '';
        document.getElementById('recargaG15').value = '';
        cargarMétricas();
    }
}

document.addEventListener('DOMContentLoaded', cargarMétricas);

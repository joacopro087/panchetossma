async function cargarMétricas() {
    const tabla = document.getElementById('tablaAdmin');
    try {
        const respuesta = await fetch('/api/reportes');
        const datos = await respuesta.json();
        tabla.innerHTML = '';

        if (datos.length === 0) {
            tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas registradas todavía.</td></tr>';
            return;
        }

        datos.forEach(fila => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge-sucursal">${fila.sucursal}</span></td>
                <td>${fila.empleado.toUpperCase()}</td>
                <td><b>${fila.producto}</b></td>
                <td>${fila.total_panchos} u.</td>
                <td>$${fila.total_recaudado.toLocaleString()}</td>
            `;
            tabla.appendChild(tr);
        });
    } catch (error) {
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión.</td></tr>';
    }
}
document.addEventListener('DOMContentLoaded', cargarMétricas);

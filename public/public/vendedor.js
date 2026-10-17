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
});

async function registrarPancho(nombreProducto, precio) {
    const id_sucursal = sessionStorage.getItem('id_sucursal');
    const empleado = sessionStorage.getItem('empleado');
    
    const ventaData = {
        id_sucursal: parseInt(id_sucursal),
        empleado: empleado,
        producto: nombreProducto,
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
            alert(`¡${nombreProducto} anotado con éxito!`);
        } else {
            alert('Error en el servidor al registrar venta.');
        }
    } catch (error) {
        alert('Sin conexión con el servidor central.');
    }
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

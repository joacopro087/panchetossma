const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión automática con la base de datos de Render PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Inicialización limpia de las tablas en la nube (Reseteo profundo)
async function iniciarTablas() {
    try {
        // Forzamos el borrado de la estructura vieja con errores para resetearla en limpio
        await pool.query(`DROP TABLE IF EXISTS stock CASCADE`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS sucursales (id_sucursal INT PRIMARY KEY, nombre TEXT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS ventas (
            id_venta SERIAL PRIMARY KEY,
            id_sucursal INT,
            empleado TEXT,
            producto TEXT,
            cantidad INT,
            precio_unitario REAL,
            total REAL,
            fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Creamos la tabla definitiva con docenas en formato decimal (REAL) y gaseosas
        await pool.query(`CREATE TABLE IF NOT EXISTS stock (
            id_sucursal INT PRIMARY KEY,
            docenas_pan REAL DEFAULT 100.0,
            salchichas INT DEFAULT 1000,
            gaseosas_500 INT DEFAULT 200,
            gaseosas_15 INT DEFAULT 100
        )`);

        const res = await pool.query("SELECT COUNT(*) FROM sucursales");
        // En PostgreSQL el resultado del COUNT viene en rows.count
        if (parseInt(res.rows.count) === 0) {
            await pool.query("INSERT INTO sucursales (id_sucursal, nombre) VALUES (1, 'Panchetos Pilar'), (2, 'Alta Gracia'), (3, 'Río Segundo'), (4, 'Panchetos al Paso'), (99, 'Administración')");
        }
        
        // Insertamos los valores iniciales limpios en la nueva tabla sin duplicar
        await pool.query("INSERT INTO stock (id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15) VALUES (1, 100.0, 1000, 200, 100), (2, 100.0, 1000, 200, 100), (3, 100.0, 1000, 200, 100), (4, 100.0, 1000, 200, 100) ON CONFLICT (id_sucursal) DO NOTHING");
        
        console.log("¡Base de datos de Render PostgreSQL reseteada y lista para operar sin errores!");
    } catch (err) {
        console.error("Error al iniciar tablas:", err);
    }
}
iniciarTablas();

// API VENTAS: Registra operaciones seguras pidiendo un cliente exclusivo al pool (Checkout Seguro)
app.post('/api/ventas', async (req, res) => {
    const { id_sucursal, empleado, producto, cantidad, precio_unitario } = req.body;
    const total = cantidad * precio_unitario;

    let panesADescontar = 0;
    let salchichasADescontar = 0;
    let gaseosa500ADescontar = 0;
    let gaseosa15ADescontar = 0;

    // Equivalencia matemática exacta: 1 pan de pancho es 1/12 de docena (0.0833)
    const unPanEnDocena = 1 / 12;
    
    // Normalizar el nombre para evaluar el stock sin importar si es venta o consumo gratis del dueño
    const productoBase = producto.replace(' (CONSUMO DUEÑO)', '');

    if (productoBase === 'Pancho Común' || productoBase === 'Pancho Guacamole Doritos') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad;
    } else if (productoBase === 'Pancho Doble') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad * 2; // El doble consume 2 salchichas y 1 pan
    } else if (productoBase === 'Gaseosa 500ml') {
        gaseosa500ADescontar = quantity;
    } else if (productoBase === 'Gaseosa 1.5L') {
        gaseosa15ADescontar = cantidad;
    } // Las porciones de papas no descuentan insumos de panadería ni fiambrería

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Registrar la operación en el historial general
        await client.query(`INSERT INTO ventas (id_sucursal, empleado, producto, cantidad, precio_unitario, total) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_sucursal, empleado, producto, cantidad, precio_unitario, total]);
        
        // Actualizar inventario restando solo los materiales que correspondan
        await client.query(`UPDATE stock SET 
            docenas_pan = docenas_pan - $1, 
            salchichas = salchichas - $2,
            gaseosas_500 = gaseosas_500 - $3,
            gaseosas_15 = gaseosas_15 - $4
            WHERE id_sucursal = $5`, 
            [panesADescontar, salchichasADescontar, gaseosa500ADescontar, gaseosa15ADescontar, id_sucursal]);
            
        await client.query('COMMIT');
        res.json({ status: "ok" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release(); // Devuelve la conexión al pool para que no se congele el sistema
    }
});

// API REPORTES: Trae historial de ventas y stock disponible para el dueño
app.get('/api/reportes', async (req, res) => {
    try {
        const ventasRes = await pool.query(`SELECT s.nombre as sucursal, v.empleado, v.producto, SUM(v.cantidad) as total_panchos, SUM(v.total) as total_recaudado
            FROM ventas v JOIN sucursales s ON v.id_sucursal = s.id_sucursal
            GROUP BY s.nombre, v.empleado, v.producto`);
        const stockRes = await pool.query(`SELECT st.*, s.nombre FROM stock st JOIN sucursales s ON st.id_sucursal = s.id_sucursal ORDER BY st.id_sucursal`);
        res.json({ ventas: ventasRes.rows, stock: stockRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API RECARGAR STOCK: Suma insumos desde la pantalla de Administrador
app.post('/api/stock/recargar', async (req, res) => {
    const { id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 } = req.body;
    try {
        await pool.query(`UPDATE stock SET 
            docenas_pan = docenas_pan + $1, 
            salchichas = salchichas + $2,
            gaseosas_500 = gaseosas_500 + $3,
            gaseosas_15 = gaseosas_15 + $4
            WHERE id_sucursal = $5`,
            [docenas_pan, salchichas, gaseosas_500, gaseosas_15, id_sucursal]);
        res.json({ status: "ok" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API ESTABLECER STOCK INICIAL: Fija el inventario de apertura ingresado por las chicas
app.post('/api/stock/establecer', async (req, res) => {
    const { id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 } = req.body;
    try {
        // CORREGIDO: Eliminada palabra errónea en esta línea
        await pool.query(`UPDATE stock SET docenas_pan = $1, salchichas = $2, gaseosas_500 = $3, gaseosas_15 = $4 WHERE id_sucursal = $5`,
            [docenas_pan, salchichas, gaseosas_500, gaseosas_15, id_sucursal]);
        res.json({ status: "ok" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor de Panchetos centralizado activo`));

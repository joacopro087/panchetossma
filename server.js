const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function iniciarTablas() {
    try {
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
        
        // TABLA DE STOCK MODIFICADA: Panes en docenas, el resto en unidades
        await pool.query(`CREATE TABLE IF NOT EXISTS stock (
            id_sucursal INT PRIMARY KEY,
            docenas_pan REAL DEFAULT 100.0,
            salchichas INT DEFAULT 1000,
            gaseosas_500 INT DEFAULT 200,
            gaseosas_15 INT DEFAULT 100
        )`);

        const res = await pool.query("SELECT COUNT(*) FROM sucursales");
        if (parseInt(res.rows[0].count) === 0) {
            await pool.query("INSERT INTO sucursales (id_sucursal, nombre) VALUES (1, 'Panchetos Pilar'), (2, 'Alta Gracia'), (3, 'Río Segundo'), (4, 'Panchetos al Paso'), (99, 'Administración')");
            // Cargamos un stock inicial de prueba
            await pool.query("INSERT INTO stock (id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15) VALUES (1, 100.0, 1000, 200, 100), (2, 100.0, 1000, 200, 100), (3, 100.0, 1000, 200, 100), (4, 100.0, 1000, 200, 100)");
        }
        console.log("Base de datos de Panchetos lista con stock en docenas.");
    } catch (err) {
        console.error("Error al iniciar tablas:", err);
    }
}
iniciarTablas();

app.post('/api/ventas', async (req, res) => {
    const { id_sucursal, empleado, producto, cantidad, precio_unitario } = req.body;
    const total = cantidad * precio_unitario;

    // Descuentos por defecto
    let panesADescontar = 0; // Se restará en fracciones de docena
    let salchichasADescontar = 0;
    let gaseosa500ADescontar = 0;
    let gaseosa15ADescontar = 0;

    // 1 pan equivale a 1/12 de docena = 0.0833
    const unPanEnDocena = 1 / 12;

    if (producto === 'Pancho Común' || producto === 'Pancho Guacamole Doritos') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad;
    } else if (producto === 'Pancho Doble') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad * 2;
    } else if (producto === 'Gaseosa 500ml') {
        gaseosa500ADescontar = cantidad;
    } else if (producto === 'Gaseosa 1.5L') {
        gaseosa15ADescontar = cantidad;
    }

    try {
        await pool.query('BEGIN');
        await pool.query(`INSERT INTO ventas (id_sucursal, empleado, producto, cantidad, precio_unitario, total) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_sucursal, empleado, producto, cantidad, precio_unitario, total]);
        
        // Ejecutar actualización de inventario restando cada insumo correspondiente
        await pool.query(`UPDATE stock SET 
            docenas_pan = docenas_pan - $1, 
            salchichas = salchichas - $2,
            gaseosas_500 = gaseosas_500 - $3,
            gaseosas_15 = gaseosas_15 - $4
            WHERE id_sucursal = $5`, 
            [panesADescontar, salchichasADescontar, gaseosa500ADescontar, gaseosa15ADescontar, id_sucursal]);
            
        await pool.query('COMMIT');
        res.json({ status: "ok" });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

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

// Registrar cargas de mercadería considerando docenas y unidades
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
        res.json({ status: "Stock actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo`));

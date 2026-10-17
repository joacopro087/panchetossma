const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión segura con Supabase usando la URL de internet
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Crear las tablas reales en internet al iniciar
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
        await pool.query(`CREATE TABLE IF NOT EXISTS stock (
            id_sucursal INT PRIMARY KEY,
            panes INT DEFAULT 1000,
            salchichas INT DEFAULT 1000
        )`);

        const res = await pool.query("SELECT COUNT(*) FROM sucursales");
        if (parseInt(res.rows[0].count) === 0) {
            await pool.query("INSERT INTO sucursales (id_sucursal, nombre) VALUES (1, 'Panchetos Pilar'), (2, 'Alta Gracia'), (3, 'Río Segundo'), (4, 'Panchetos al Paso'), (99, 'Administración')");
            await pool.query("INSERT INTO stock (id_sucursal, panes, salchichas) VALUES (1, 1000, 1000), (2, 1000, 1000), (3, 1000, 1000), (4, 1000, 1000)");
        }
        console.log("Tablas en la nube verificadas y listas.");
    } catch (err) {
        console.error("Error al iniciar tablas:", err);
    }
}
iniciarTablas();

app.post('/api/ventas', async (req, res) => {
    const { id_sucursal, empleado, producto, cantidad, precio_unitario } = req.body;
    const total = cantidad * precio_unitario;

    try {
        await pool.query('BEGIN');
        await pool.query(`INSERT INTO ventas (id_sucursal, empleado, producto, cantidad, precio_unitario, total) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_sucursal, empleado, producto, cantidad, precio_unitario, total]);
        await pool.query(`UPDATE stock SET panes = panes - $1, salchichas = salchichas - $2 WHERE id_sucursal = $3`, 
            [cantidad, cantidad, id_sucursal]);
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
        const stockRes = await pool.query(`SELECT st.*, s.nombre FROM stock st JOIN sucursales s ON st.id_sucursal = s.id_sucursal`);
        res.json({ ventas: ventasRes.rows, stock: stockRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/stock/recargar', async (req, res) => {
    const { id_sucursal, cantidad_panes, cantidad_salchichas } = req.body;
    try {
        await pool.query(`UPDATE stock SET panes = panes + $1, salchichas = salchichas + $2 WHERE id_sucursal = $3`,
            [cantidad_panes, cantidad_salchichas, id_sucursal]);
        res.json({ status: "Stock actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo`));

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
        await pool.query(`CREATE TABLE IF NOT EXISTS stock (
            id_sucursal INT PRIMARY KEY,
            docenas_pan REAL DEFAULT 100.0,
            salchichas INT DEFAULT 1000,
            gaseosas_500 INT DEFAULT 200,
            gaseosas_15 INT DEFAULT 100
        )`);

        const res = await pool.query("SELECT COUNT(*) FROM sucursales");
        if (parseInt(res.rows.count) === 0) {
            await pool.query("INSERT INTO sucursales (id_sucursal, nombre) VALUES (1, 'Panchetos Pilar'), (2, 'Alta Gracia'), (3, 'Río Segundo'), (4, 'Panchetos al Paso'), (99, 'Administración')");
        }
        await pool.query("INSERT INTO stock (id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15) VALUES (1, 100.0, 1000, 200, 100), (2, 100.0, 1000, 200, 100), (3, 100.0, 1000, 200, 100), (4, 100.0, 1000, 200, 100) ON CONFLICT (id_sucursal) DO NOTHING");
        console.log("Servidor de Panchetos actualizado con combos reales.");
    } catch (err) {
        console.error("Error al iniciar tablas:", err);
    }
}
iniciarTablas();

app.post('/api/ventas', async (req, res) => {
    const { id_sucursal, empleado, producto, cantidad, precio_unitario } = req.body;
    const total = cantidad * precio_unitario; 

    let panesADescontar = 0;
    let salchichasADescontar = 0;
    let gaseosa500ADescontar = 0;
    let gaseosa15ADescontar = 0;

    const unPanEnDocena = 1 / 12;
    const productoBase = producto.replace(' (CONSUMO DUEÑO)', '');

    // LÓGICA INTELIGENTE DE STOCK DESGLOSADA PARA LOS COMPOS DE LAS FOTOS
    if (productoBase === 'Pancho Común' || productoBase === 'Pancho Guacamole Doritos') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad;
    } else if (productoBase === 'Pancho Doble') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad * 2;
    } else if (productoBase === '2x1 Pancho Común') {
        panesADescontar = (unPanEnDocena * 2) * cantidad;
        salchichasADescontar = 2 * cantidad;
    } else if (productoBase === '2x1 Pancho Doble') {
        panesADescontar = (unPanEnDocena * 2) * cantidad;
        salchichasADescontar = 4 * cantidad;
    } else if (productoBase === 'Gaseosa 500ml') {
        gaseosa500ADescontar = cantidad;
    } else if (productoBase === 'Gaseosa 1.5L') {
        gaseosa15ADescontar = cantidad;
    }
    
    // --- COMBOS DE LA FOTO 1: PANCHOS + PAPAS ---
    else if (productoBase === '1 Pancheto + Cono Papas') {
        panesADescontar = unPanEnDocena * cantidad;
        salchichasADescontar = cantidad;
    } else if (productoBase === '2 Panchetos + Porción Papas') {
        panesADescontar = (unPanEnDocena * 2) * cantidad;
        salchichasADescontar = 2 * cantidad;
    } else if (productoBase === '3 Panchetos + Porción Papas') {
        panesADescontar = (unPanEnDocena * 3) * cantidad;
        salchichasADescontar = 3 * cantidad;
    }
    
    // --- COMBOS DE LA FOTO 2: PROMOS DELIVERY ---
    else if (productoBase === 'Promo Delivery: 2 Panchetos + Coca 500cc') {
        panesADescontar = (unPanEnDocena * 2) * cantidad;
        salchichasADescontar = 2 * cantidad;
        gaseosa500ADescontar = cantidad;
    } else if (productoBase === 'Promo Delivery: 3 Panchetos + Coca 1.5L') {
        panesADescontar = (unPanEnDocena * 3) * cantidad;
        salchichasADescontar = 3 * cantidad;
        gaseosa15ADescontar = cantidad;
    } else if (productoBase === 'Promo Delivery: 4 Panchetos + Coca 1.5L') {
        panesADescontar = (unPanEnDocena * 4) * cantidad;
        salchichasADescontar = 4 * Pattern;
        gaseosa15ADescontar = cantidad;
    } else if (productoBase === 'Promo Delivery: 5 Panchetos + Coca 1.5L') {
        panesADescontar = (unPanEnDocena * 5) * cantidad;
        salchichasADescontar = 5 * cantidad;
        gaseosa15ADescontar = cantidad;
    } else if (productoBase === 'Promo Delivery: 6 Panchetos + Coca 1.5L') {
        panesADescontar = (unPanEnDocena * 6) * cantidad;
        salchichasADescontar = 6 * cantidad;
        gaseosa15ADescontar = cantidad;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO ventas (id_sucursal, empleado, producto, cantidad, precio_unitario, total) VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_sucursal, empleado, producto, cantidad, precio_unitario, total]);
        
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
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/caja/cerrar', async (req, res) => {
    const { id_sucursal } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const dineroRes = await client.query(`SELECT SUM(total) as total FROM ventas WHERE id_sucursal = $1`, [id_sucursal]);
        const totalRecaudado = dineroRes.rows.total || 0;
        const desgloseRes = await client.query(`SELECT producto, SUM(cantidad) as cantidad, SUM(total) as total FROM ventas WHERE id_sucursal = $1 GROUP BY producto`, [id_sucursal]);
        await client.query(`DELETE FROM ventas WHERE id_sucursal = $1`, [id_sucursal]);
        await client.query('COMMIT');
        res.json({ status: "ok", recaudado: totalRecaudado, desglose: desgloseRes.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/reportes', async (req, res) => {
    try {
        const ventasRes = await pool.query(`SELECT s.nombre as sucursal, v.empleado, v.producto, SUM(v.cantidad) as total_panchos, SUM(v.total) as total_recaudado FROM ventas v JOIN sucursales s ON v.id_sucursal = s.id_sucursal GROUP BY s.nombre, v.empleado, v.producto`);
        const stockRes = await pool.query(`SELECT st.*, s.nombre FROM stock st JOIN sucursales s ON st.id_sucursal = s.id_sucursal ORDER BY st.id_sucursal`);
        res.json({ ventas: ventasRes.rows, stock: stockRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reportes/local/:id_sucursal', async (req, res) => {
    const { id_sucursal } = req.params;
    try {
        const ventasActivas = await pool.query(`SELECT producto, SUM(cantidad) as cantidad, SUM(total) as total FROM ventas WHERE id_sucursal = $1 GROUP BY producto`, [id_sucursal]);
        res.json(ventasActivas.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/stock/recargar', async (req, res) => {
    const { id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 } = req.body;
    try {
        await pool.query(`UPDATE stock SET docenas_pan = docenas_pan + $1, salchichas = salchichas + $2, gaseosas_500 = gaseosas_500 + $3, gaseosas_15 = gaseosas_15 + $4 WHERE id_sucursal = $5`, [docenas_pan, salchichas, gaseosas_500, gaseosas_15, id_sucursal]);
        res.json({ status: "ok" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/stock/establecer', async (req, res) => {
    const { id_sucursal, docenas_pan, salchichas, gaseosas_500, gaseosas_15 } = req.body;
    try {
        await pool.query(`UPDATE stock SET docenas_pan = $1, salchichas = $2, gaseosas_500 = $3, gaseosas_15 = $4 WHERE id_sucursal = $5`, [docenas_pan, salchichas, gaseosas_500, gaseosas_15, id_sucursal]);
        res.json({ status: "ok" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de Panchetos centralizado activo`));

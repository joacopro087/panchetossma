const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./panchetos.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Base de datos conectada.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sucursales (id_sucursal INTEGER PRIMARY KEY, nombre TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS ventas (
        id_venta INTEGER PRIMARY KEY AUTOINCREMENT,
        id_sucursal INTEGER,
        empleado TEXT,
        producto TEXT,
        cantidad INTEGER,
        precio_unitario REAL,
        total REAL,
        fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get("SELECT COUNT(*) as count FROM sucursales", [], (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO sucursales (id_sucursal, nombre) VALUES (1, 'Panchetos Pilar'), (2, 'Alta Gracia'), (3, 'Río Segundo'), (4, 'Panchetos al Paso'), (99, 'Administración')");
        }
    });
});

app.post('/api/ventas', (req, res) => {
    const { id_sucursal, empleado, producto, cantidad, precio_unitario } = req.body;
    const total = cantidad * precio_unitario;
    db.run(`INSERT INTO ventas (id_sucursal, empleado, producto, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?, ?)`,
        [id_sucursal, empleado, producto, cantidad, precio_unitario, total], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ status: "ok" });
        });
});

app.get('/api/reportes', (req, res) => {
    db.all(`SELECT s.nombre as sucursal, v.empleado, v.producto, SUM(v.cantidad) as total_panchos, SUM(v.total) as total_recaudado
            FROM ventas v JOIN sucursales s ON v.id_sucursal = s.id_sucursal
            GROUP BY v.id_sucursal, v.empleado, v.producto`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en http://localhost:${PORT}/login.html`);
});

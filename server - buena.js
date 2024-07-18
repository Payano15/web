const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Cambiar a true si usas HTTPS
}));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuración de Multer para la subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directorio de subida de archivos
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Renombrar archivo para evitar duplicados
    }
});
const upload = multer({ storage: storage });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        enableArithAbort: true
    }
};

// Función para conectar a la base de datos
async function connectToDatabase() {
    try {
        if (!sql.globalConnection) {
            sql.globalConnection = await sql.connect(config);
            console.log('Conexión establecida con la base de datos.');
        }
        return sql.globalConnection;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        throw error;
    }
}

// Registro de usuarios
app.post('/register', async (req, res) => {
    const { nombre, apellido, direccion, email, clave } = req.body;

    console.log('Datos recibidos del formulario de registro:', { nombre, apellido, direccion, email, clave });

    if (!nombre || !apellido || !direccion || !email || !clave) {
        return res.status(400).json({ message: 'Por favor, complete todos los campos.' });
    }

    try {
        // Conectar a la base de datos
        await connectToDatabase();

        // Insertar usuario en la base de datos
        const insertQuery = `
            INSERT INTO resgitro_usuarios (nombre, apellido, direccion, email, clave)
            OUTPUT INSERTED.id
            VALUES (@nombre, @apellido, @direccion, @email, @clave);
        `;

        const request = new sql.Request();
        request.input('nombre', sql.VarChar(255), nombre);
        request.input('apellido', sql.VarChar(255), apellido);
        request.input('direccion', sql.VarChar(255), direccion);
        request.input('email', sql.VarChar(255), email);
        request.input('clave', sql.VarChar(255), clave);

        const insertResult = await request.query(insertQuery);

        const lastInsertedId = insertResult.recordset[0].id;

        // Ejecutar el procedimiento almacenado con el ID recién insertado
        const procedureRequest = new sql.Request();
        procedureRequest.input('idusuarios', sql.Int, lastInsertedId);

        const procedureResult = await procedureRequest.execute('usp_create_usuarios');
        console.log(procedureResult);

        res.status(201).json({ message: 'Usuario registrado y procedimiento ejecutado correctamente.' });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error en el registro.', error: error.message });
    } finally {
        await sql.close();
    }
});

// Inicio de sesión de usuarios
app.post('/login', async (req, res) => {
    const { codigo, clave } = req.body;

    if (!codigo || !clave) {
        return res.status(400).json({ success: false, message: 'Por favor, ingrese código y clave.' });
    }

    try {
        const pool = await connectToDatabase();

        const query = `
            SELECT idusuarios, codigo, clave
            FROM usuarios
            WHERE codigo = @codigo
            AND clave = @clave;
        `;

        const request = new sql.Request(pool);
        request.input('codigo', sql.VarChar, codigo);
        request.input('clave', sql.VarChar, clave);

        const result = await request.query(query);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Código o clave incorrectos.' });
        }

        const idUsuario = result.recordset[0].idusuarios;

        // Guardar el registro en temp_usuarios_log
        const insertLogQuery = `
            INSERT INTO temp_usuarios_log (idUsuario, codigo, clave)
            VALUES (@idUsuario, @codigo, @clave);
        `;
        const insertLogRequest = new sql.Request(pool);
        insertLogRequest.input('idUsuario', sql.Int, idUsuario);
        insertLogRequest.input('codigo', sql.VarChar, codigo);
        insertLogRequest.input('clave', sql.VarChar, clave);
        await insertLogRequest.query(insertLogQuery);

        res.status(200).json({ success: true, userId: idUsuario });

    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        res.status(500).json({ success: false, message: 'Error en el inicio de sesión.', error: error.message });
    }
});

// Ruta para manejar la subida de reportes
app.post('/reporte', upload.single('imageUpload'), async (req, res) => {
    const { longitude, latitude, comment, enubasu, province } = req.body; // Incluyendo 'province'

    try {
        const pool = await connectToDatabase();

        // Obtener el último idUsuario registrado en temp_usuarios_log
        const getLastUserIdQuery = `
            SELECT TOP 1 idUsuario
            FROM temp_usuarios_log
            ORDER BY id DESC;
        `;
        const getLastUserIdRequest = new sql.Request(pool);
        const lastUserIdResult = await getLastUserIdRequest.query(getLastUserIdQuery);

        if (lastUserIdResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay usuarios registrados en el log temporal.' });
        }

        const idUsuario = lastUserIdResult.recordset[0].idUsuario;

        const request = new sql.Request(pool);
        request.input('idUsuario', sql.Int, idUsuario);
        request.input('longitude', sql.VarChar(150), longitude);
        request.input('latitude', sql.VarChar(150), latitude);
        request.input('comment', sql.NVarChar, comment);
        request.input('imagePath', sql.NVarChar, 'NULL');
        request.input('fecha_reporte', sql.DateTime, new Date());
        request.input('estatus', sql.VarChar(50), 'ACT');
        request.input('pais', sql.VarChar(50), 'Republica Dominicana');
        request.input('enubasu', sql.VarChar(10), enubasu);
        request.input('provincia', sql.VarChar(100), province); // Agregando 'province'

        const result = await request.query(`
            INSERT INTO reporte_usuarios (idusuarios, longitud, latitud, Comment, ImagePath, fecha_reporte, estatus, pais, enubasu, provincia)
            VALUES (@idUsuario, @latitude, @longitude, @comment, @imagePath, @fecha_reporte, @estatus, @pais, @enubasu, @provincia)
        `);

        res.json({ message: 'Reporte guardado con éxito' });
    } catch (error) {
        console.error('Error al guardar el reporte:', error.message);
        res.status(500).send('Error al guardar el reporte');
    }
});

// Ruta para filtrar reportes
app.post('/filtrados', async (req, res) => {
    const { fechaDesde, fechaHasta } = req.body;
    console.log('Fechas recibidas:', fechaDesde, fechaHasta); // Debugging

    try {
        const pool = await connectToDatabase();

        const query = `
            SELECT 
                rp.id AS numeroReporte, 
                ru.nombre + ' ' + ru.apellido AS nombreApellido,
                rp.estatus,
                ru.direccion,
                rp.fecha_reporte AS fechaReporte,
                rp.Comment AS comentario
            FROM reporte_usuarios rp
            JOIN resgitro_usuarios ru ON rp.idusuarios = ru.id
            WHERE rp.fecha_reporte BETWEEN @fechaDesde AND @fechaHasta
        `;
        
        console.log('Consulta ejecutada:', query); // Debugging

        const request = new sql.Request(pool);
        request.input('fechaDesde', sql.Date, fechaDesde);
        request.input('fechaHasta', sql.Date, fechaHasta);

        const result = await request.query(query);
        console.log('Reportes obtenidos:', result.recordset); // Debugging
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al filtrar reportes:', error); // Debugging
        res.status(500).send('Error al obtener los reportes');
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const multer = require('multer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Configuración de multer para la carga de archivos
const upload = multer({ 
    dest: 'C:\\JESUS MANUEL ARIAS\\cogedon\\uploads\\' 
});

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
        await sql.connect(config);
        console.log('Conexión establecida con la base de datos.');
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
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
        await connectToDatabase();

        const insertQuery = `
            INSERT INTO registro_usuarios (nombre, apellido, direccion, email, clave)
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

        if (insertResult.recordset.length === 0) {
            return res.status(500).json({ message: 'Error al registrar usuario.' });
        }

        const lastInsertedId = insertResult.recordset[0].id;

        const procedureRequest = new sql.Request();
        procedureRequest.input('idusuarios', sql.Int, lastInsertedId);

        const procedureResult = await procedureRequest.execute('usp_create_usuarios');
        console.log(procedureResult);

        req.session.user = { nombre }; // Guardar el nombre en la sesión

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

    console.log('Datos recibidos del formulario de inicio de sesión:', { codigo, clave });

    if (!codigo || !clave) {
        return res.status(400).json({ success: false, message: 'Por favor, ingrese código y clave.' });
    }

    try {
        await connectToDatabase();

        const query = `
            SELECT codigo, clave
            FROM usuarios
            WHERE codigo = @codigo
            AND clave = @clave;
        `;

        const request = new sql.Request();
        request.input('codigo', sql.VarChar, codigo);
        request.input('clave', sql.VarChar, clave);

        const result = await request.query(query);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Código o clave incorrectos.' });
        }

        console.log('Usuario encontrado:', result.recordset[0]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        res.status(500).json({ success: false, message: 'Error en el inicio de sesión.', error: error.message });
    } finally {
        await sql.close();
    }
});

// Endpoint para guardar reporte con archivo
app.post('/guardar-reporte', upload.single('imageUpload'), async (req, res) => {
    const { idusuarios, longitud, latitud, comentario, fechareporte } = req.body;
    
    let imagen = ''; // Inicializamos imagen como vacía

    // Verificar si se subió un archivo
    if (req.file) {
        imagen = req.file.path; // Ruta al archivo guardado temporalmente
    }

    try {
        await connectToDatabase();

        const insertQuery = `
            INSERT INTO reporte_usuarios (idusuarios, longitud, latitud, comentario, imagen, fechareporte)
            VALUES (@idusuarios, @longitud, @latitud, @comentario, @imagen, @fechareporte);
        `;

        const request = new sql.Request();
        request.input('idusuarios', sql.Int, idusuarios);
        request.input('longitud', sql.Decimal(9, 6), longitud);
        request.input('latitud', sql.Decimal(9, 6), latitud);
        request.input('comentario', sql.VarChar(255), comentario);
        request.input('imagen', sql.VarChar(255), imagen); // Guarda la ruta del archivo, puede ser vacía si no se subió ningún archivo
        request.input('fechareporte', sql.DateTime, fechareporte);

        await request.query(insertQuery);

        res.status(201).json({ message: 'Reporte guardado correctamente.' });
    } catch (error) {
        console.error('Error al guardar reporte:', error.message);
        res.status(500).json({ message: 'Error al guardar reporte.', error: error.message });
    } finally {
        await sql.close();
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para la página de reporte
app.get('/reporte', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reporte.html'));
});

// Manejo de errores para métodos no permitidos
app.use((req, res, next) => {
    res.status(405).send('Method Not Allowed');
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
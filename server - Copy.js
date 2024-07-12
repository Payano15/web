const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const dotenv = require('dotenv');
const cors = require('cors');
const session = require('express-session');

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
// Inicio de sesión de usuarios
// Ruta para manejar las solicitudes POST del inicio de sesión
// Ruta para manejar las solicitudes POST del inicio de sesiónapp.post('/login', async (req, res) => {
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


// Endpoint para obtener el usuario actual
app.get('/current-user', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ message: 'No autenticado' });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;  // Cambiar el puerto a 3001

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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

// Ruta para manejar las solicitudes POST del formulario de inicio de sesión
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    console.log('Datos recibidos del formulario de inicio de sesión:', { username, password });

    if (!username || !password) {
        return res.status(400).json({ message: 'Por favor, ingrese usuario y contraseña.' });
    }

    try {
        // Conectar a la base de datos
        await connectToDatabase();

        // Consultar el usuario con el username y password proporcionados
        const query = `
            SELECT codigo, clave FROM usuarios
            WHERE codigo LIKE '%' + @codigo + '%' AND clave LIKE '%' + @clave + '%';
        `;

        const result = await sql.query(query, {
            codigo: sql.VarChar(50),
            clave: sql.VarChar(50)
        });
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Usuario o contraseña incorrectos.' });
        }

        console.log('Usuario encontrado:', result.recordset[0]);

        res.status(200).json({ message: 'Inicio de sesión exitoso.' });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ message: 'Error en el inicio de sesión.', error: error.message });
    } finally {
        await sql.close();
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
const { AzureFunction, Context, HttpRequest } = require('@azure/functions');
const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

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

// Function to connect to the database
async function connectToDatabase() {
    try {
        const pool = await sql.connect(config);
        console.log('Database connection established.');
        return pool;
    } catch (error) {
        console.error('Error connecting to the database:', error.message);
        throw error;
    }
}

// Function to handle CORS
const corsHandler = async function (context, req) {
    context.res = {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };
};

// Function to register users
module.exports.register = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Registering user...');

    const { nombre, apellido, direccion, email, clave } = req.body;

    if (!nombre || !apellido || !direccion || !email || !clave) {
        context.res = {
            status: 400,
            body: { message: 'Please fill in all the fields.' }
        };
        return;
    }

    try {
        const pool = await connectToDatabase();

        const insertQuery = `
            INSERT INTO registro_usuarios (nombre, apellido, direccion, email, clave)
            OUTPUT INSERTED.id
            VALUES (@nombre, @apellido, @direccion, @correo, @clave);
        `;

        const request = pool.request();
        request.input('nombre', sql.VarChar(255), nombre);
        request.input('apellido', sql.VarChar(255), apellido);
        request.input('direccion', sql.VarChar(255), direccion);
        request.input('correo', sql.VarChar(255), email);
        request.input('clave', sql.VarChar(255), clave);

        const insertResult = await request.query(insertQuery);
        const lastInsertedId = insertResult.recordset[0].id;

        context.res = {
            status: 201,
            body: { message: 'User registered successfully.', userId: lastInsertedId }
        };

    } catch (error) {
        console.error('Error registering user:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error registering user.', error: error.message }
        };
    }
});

// Function to log in users
module.exports.login = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Logging in user...');

    const { codigo, clave } = req.body;

    if (!codigo || !clave) {
        context.res = {
            status: 400,
            body: { success: false, message: 'Please provide code and password.' }
        };
        return;
    }

    try {
        const pool = await connectToDatabase();

        const query = `
            SELECT idusuarios, codigo, clave
            FROM usuarios
            WHERE codigo = @codigo
            AND clave = @clave;
        `;

        const request = pool.request();
        request.input('codigo', sql.VarChar, codigo);
        request.input('clave', sql.VarChar, clave);

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            context.res = {
                status: 404,
                body: { success: false, message: 'Incorrect code or password.' }
            };
            return;
        }

        const idUsuario = result.recordset[0].idusuarios;

        // Save the log in temp_usuarios_log
        const insertLogQuery = `
            INSERT INTO temp_usuarios_log (idUsuario, codigo, clave)
            VALUES (@idUsuario, @codigo, @clave);
        `;
        const insertLogRequest = pool.request();
        insertLogRequest.input('idUsuario', sql.Int, idUsuario);
        insertLogRequest.input('codigo', sql.VarChar, codigo);
        insertLogRequest.input('clave', sql.VarChar, clave);
        await insertLogRequest.query(insertLogQuery);

        context.res = {
            status: 200,
            body: { success: true, userId: idUsuario }
        };

    } catch (error) {
        console.error('Error logging in:', error.message);
        context.res = {
            status: 500,
            body: { success: false, message: 'Error logging in.', error: error.message }
        };
    }
});

// Function to handle report submission
module.exports.reporte = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Saving report...');

    const { longitude, latitude, comment, enubasu, province } = req.body;

    try {
        const pool = await connectToDatabase();

        // Get the last idUsuario registered in temp_usuarios_log
        const getLastUserIdQuery = `
            SELECT TOP 1 idUsuario
            FROM temp_usuarios_log
            ORDER BY id DESC;
        `;
        const lastUserIdResult = await pool.request().query(getLastUserIdQuery);

        if (lastUserIdResult.recordset.length === 0) {
            context.res = {
                status: 404,
                body: { success: false, message: 'No users found in the temporary log.' }
            };
            return;
        }

        const idUsuario = lastUserIdResult.recordset[0].idUsuario;

        const request = pool.request();
        request.input('idUsuario', sql.Int, idUsuario);
        request.input('longitude', sql.VarChar(150), longitude);
        request.input('latitude', sql.VarChar(150), latitude);
        request.input('comment', sql.NVarChar, comment);
        request.input('ImagePath', sql.NVarChar, 'Null');
        request.input('fecha_reporte', sql.DateTime, new Date());
        request.input('estatus', sql.VarChar(50), 'ACT');
        request.input('pais', sql.VarChar(50), 'Republica Dominicana');
        request.input('enubasu', sql.VarChar(10), enubasu);
        request.input('provincia', sql.VarChar(100), province);

        await request.query(`
            INSERT INTO reporte_usuarios (idusuarios, longitud, latitud, Comment, ImagePath, fecha_reporte, estatus, pais, enubasu, provincia)
            VALUES (@idUsuario, @longitude, @latitude, @comment, @ImagePath, @fecha_reporte, @estatus, @pais, @enubasu, @provincia)
        `);

        context.res = {
            status: 200,
            body: { message: 'Report saved successfully.' }
        };

    } catch (error) {
        console.error('Error saving report:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error saving report.' }
        };
    }
});

// Function to filter reports
module.exports.filtrados = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Filtering reports...');

    const { fechaDesde, fechaHasta } = req.body;

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
            JOIN registro_usuarios ru ON rp.idusuarios = ru.id
            WHERE rp.fecha_reporte BETWEEN @fechaDesde AND @fechaHasta
        `;

        const result = await pool.request()
            .input('fechaDesde', sql.Date, fechaDesde)
            .input('fechaHasta', sql.Date, fechaHasta)
            .query(query);

        context.res = {
            status: 200,
            body: result.recordset
        };

    } catch (error) {
        console.error('Error filtering reports:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error retrieving reports.' }
        };
    }
});
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
        enableArithAbort: true  // Corrección del error de tipeo
    }
};

// Función para conectar a la base de datos
async function connectToDatabase() {
    try {
        const pool = await sql.connect(config);
        console.log('Conexión establecida con la base de datos.');
        return pool;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        throw error;
    }
}

// Función para manejar CORS
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

// Función para registrar usuarios
module.exports.register = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Registrando usuario...');

    const { nombre, apellido, direccion, email, clave } = req.body;

    if (!nombre || !apellido || !direccion || !email || !clave) {
        context.res = {
            status: 400,
            
      
body: { message: 'Por favor, complete todos los campos.' }
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
        request.
  
input('nombre', sql.VarChar(255), nombre);
        request.input('apellido', sql.VarChar(255), apellido);
        request.input('direccion', sql.VarChar(255), direccion);
        request.input('correo', sql.VarChar(255), email);
        request.input('clave', sql.VarChar(255), clave);

        const insertResult = await request.query(insertQuery);
        const lastInsertedId = insertResult.recordset[0].id;

        context.res = {
            status: 201,
            body: { message: 'Usuario registrado correctamente.', userId: lastInsertedId }
        };

    } catch (error) {
        console.error('Error al registrar usuario:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error en el registro.', error: error.message }
        };
    }
});

// Función para iniciar sesión de usuarios
module.exports.login = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Iniciando sesión...');

    const { codigo, clave } = req.body;

    if (!codigo || !clave) {
        context.res = {
            status: 400,
            body: { success: false, message: 'Por favor, ingrese código y clave.' }
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
                body: { success: false, message: 'Código o clave incorrectos.' }
            };
            return;
        }

        const idUsuario = result.recordset[0].idusuarios;

        // Guardar el registro en temp_usuarios_log
        const insertLogQuery = `
            INSERT INTO temp_usuarios_log (idUsuario, codigo, clave)
            VALUES (@idUsuario, @codigo, @clave);
        `;
        const insertLogRequest = pool.request();
        insertLogRequest.
        insertLog
        input('idUsuario', sql.Int, idUsuario);
        insertLogRequest.input('codigo', sql.VarChar, codigo);
        insertLogRequest.input('clave', sql.VarChar, clave);
        await insertLogRequest.query(insertLogQuery);

        context.res = {
            status: 200,
            
    
body: { success: true, userId: idUsuario }
        };

    } catch (error) {
        console.error('Error al iniciar sesión:', error.message);
        context.res = {
            status: 500,
            body: { success: false, message: 'Error en el inicio de sesión.', error: error.message }
        };
    }
});

// Función para manejar la subida de reportes
module.exports.reporte = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Guardando reporte...');

    const { longitude, latitude, comment, enubasu, province } = req.body;

    try {
        const pool = await connectToDatabase();

        // Obtener el último idUsuario registrado en temp_usuarios_log
        const getLastUserIdQuery = `
            SELECT TOP 1 idUsuario
            FROM temp_usuarios_log
            ORDER BY id DESC;
        `;
        const lastUserIdResult = await pool.request().query(getLastUserIdQuery);

        if (lastUserIdResult.recordset.length === 0) {
            context.res = {
                
                status: 404,
                body: { success: false, message: 'No hay usuarios registrados en el log temporal.' }
            };
            return;
        }

        const idUsuario = lastUserIdResult.recordset[0].idUsuario;

        const request = pool.request();
        request.input('idUsuario', sql.Int, idUsuario);
        request.input('longitude', sql.VarChar(150), longitude);
        request.
 
input('latitude', sql.VarChar(150), latitude);
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
            body: { message: 'Reporte guardado con éxito' }
        };

    } catch (error) {
        
        conso
console.error('Error al guardar el reporte:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error al guardar el reporte' }
        };
    }
});

// Función para filtrar reportes
module.exports.filtrados = AzureFunction.HttpTrigger(corsHandler, {
    methods: ['options', 'post'],
    authLevel: 'anonymous'
}, async function (context, req) {
    context.log('Filtrando reportes...');

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
        console.error('Error al filtrar reportes:', error.message);
        context.res = {
            status: 500,
            body: { message: 'Error al obtener los reportes' }
        };
    }
});
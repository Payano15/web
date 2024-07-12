const sql = require('mssql');

const dbConfig = {
  user: 'sa',
  password: 'esp1234',
  server: 'DESKTOP-IOVF3GD\\ESP',
  database: 'cogedon',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

sql.connect(dbConfig).then(pool => {
  if (pool.connected) {
    console.log('Conectado a la base de datos SQL Server');
    pool.close(); // Cierra la conexión
  }
}).catch(err => {
  console.error('Error al conectar a la base de datos:', err);
});
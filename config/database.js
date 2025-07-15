const mysql = require('mysql2/promise');

// Database connection pool dengan konfigurasi yang benar
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hmif_app',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00',
});

// Function untuk execute query dengan promise
const executeQuery = async (query, params = []) => {
    try {
    console.log('🔍 Executing query:', query);
    console.log('📝 With params:', params);
    
    const [rows, fields] = await pool.execute(query, params);
    
    console.log('✅ Query executed successfully');
    return {
            success: true,
            data: rows,
            fields: fields
        };
    } catch (error) {
    console.error('💥 Database query error:', error);
    return {
        success: false,
        error: error.message,
        data: []
        };
    }
};

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('✅ Database connected successfully');
        return true;
    } catch (error) {
        console.error('💥 Database connection failed:', error);
        return false;
    }
};

module.exports = {
    pool,
    executeQuery,
    testConnection
};
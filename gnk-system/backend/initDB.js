require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

const createTables = async () => {
  try {
    console.log('⏳ Creating tables...');

    // 1. جدول طلبات الدفع (Payment Requests)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        request_id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255),
        project VARCHAR(100),
        department VARCHAR(100),
        supplier VARCHAR(255),
        description TEXT,
        amount NUMERIC(12,2) DEFAULT 0,
        currency VARCHAR(20) DEFAULT 'L.E',
        due_date VARCHAR(50),
        manager_email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Pending Approval',
        payment_terms VARCHAR(255),
        pdf_url TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ payment_requests table is ready!');

    // 2. جدول سندات الاستلام (Receiving Vouchers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS receiving_vouchers (
        rec_number VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255),
        employee_name VARCHAR(255),
        supplier VARCHAR(255),
        project VARCHAR(100),
        type VARCHAR(50),
        total_amount NUMERIC(12,2) DEFAULT 0,
        linked_request VARCHAR(50),
        items JSONB,
        pdf_link TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ receiving_vouchers table is ready!');

    console.log('🎉 Database initialization complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating tables:', err);
    process.exit(1);
  }
};

createTables();
-- مسح الجداول القديمة (لو كانت موجودة من التست اللي فات) عشان نبنيها بالمواصفات الجديدة
DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS receiving_vouchers;

-- إنشاء جدول طلبات الدفع
CREATE TABLE payment_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    name VARCHAR(100),
    project VARCHAR(100),
    department VARCHAR(100),
    description TEXT,
    amount DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'L.E',
    due_date VARCHAR(50),
    manager_email VARCHAR(100),
    payment_terms VARCHAR(255),
    attachment_urls TEXT,
    status VARCHAR(50) DEFAULT 'Pending Approval',
    rid_l1 VARCHAR(50),
    rid_l2 VARCHAR(50),
    stamp_l1 TEXT,
    stamp_l2 TEXT,
    receiving_ids TEXT,
    cor VARCHAR(10) DEFAULT 'No',
    link_timestamp BIGINT,
    payment_method VARCHAR(50),
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    payment_ref VARCHAR(100),
    date_paid VARCHAR(50),
    notes TEXT,
    pdf_url VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إنشاء جدول سندات الاستلام
CREATE TABLE receiving_vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rec_number VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    employee_name VARCHAR(100),
    supplier VARCHAR(100),
    project VARCHAR(100),
    type VARCHAR(50),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    linked_request VARCHAR(255),
    pdf_link VARCHAR(255),
    attachments TEXT,
    items JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC NOT NULL,
  description TEXT,
  category VARCHAR(100),
  imageUrl TEXT,
  count INTEGER DEFAULT 0,
  specific_field TEXT
);

-- Create buyers table
CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  customer VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// GET /api/products - List all products
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, price, description, category, imageUrl, count, specific_field, active FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/products/:id - Get a single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, name, price, description, category, imageUrl, count, specific_field, active FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/products - Create a new product
router.post('/', async (req, res) => {
  try {
    const { name, price, description, category, imageUrl, count, specific_field } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, price, description, category, imageUrl, count, specific_field) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, price, description, category, imageUrl, count, specific_field]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/products/:id - Update a product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, category, imageUrl, count, specific_field } = req.body;
    const result = await pool.query(
      'UPDATE products SET name = $1, price = $2, description = $3, category = $4, imageUrl = $5, count = $6, specific_field = $7 WHERE id = $8 RETURNING *',
      [name, price, description, category, imageUrl, count, specific_field, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/products/:id - Delete a product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/products/upload - Upload an image
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Return the relative path to the uploaded file
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// POST /api/products/:id/sell - Sell a product (decrement count by quantity, log customer)
router.post('/:id/sell', async (req, res) => {
  try {
    const { id } = req.params;
    const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
    let customer = '';
    let customer_id = req.body.customer_id;
    if (customer_id) {
      // Look up customer name by ID
      const customerRes = await pool.query('SELECT name FROM customers WHERE id = $1', [customer_id]);
      if (customerRes.rows.length === 0) {
        return res.status(400).json({ error: 'Customer not found' });
      }
      customer = customerRes.rows[0].name;
    } else {
      return res.status(400).json({ error: 'Customer is required' });
    }
    const payment_status = (req.body.payment_status === 'deferred') ? 'deferred' : 'paid';
    // Decrement count only if enough in stock
    const result = await pool.query(
      'UPDATE products SET count = count - $2 WHERE id = $1 AND count >= $2 RETURNING *',
      [id, quantity]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Not enough items in stock or product not found' });
    }
    // Calculate total price
    const priceRes = await pool.query('SELECT price FROM products WHERE id = $1', [id]);
    const price = priceRes.rows[0]?.price || 0;
    const total = Number(price) * quantity;
    const amount_paid = payment_status === 'paid' ? total : 0;
    // Insert into sales table
    const soldAt = req.body.sold_at || null;
    if (soldAt) {
      await pool.query(
        'INSERT INTO sales (product_id, customer, customer_id, quantity, payment_status, amount_paid, sold_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, customer, customer_id, quantity, payment_status, amount_paid, soldAt]
      );
    } else {
      await pool.query(
        'INSERT INTO sales (product_id, customer, customer_id, quantity, payment_status, amount_paid) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, customer, customer_id, quantity, payment_status, amount_paid]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/products/:id/active - Update product active status
router.patch('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const result = await pool.query('UPDATE products SET active = $1 WHERE id = $2 RETURNING *', [active, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router; 
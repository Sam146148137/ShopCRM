const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/sales - List all sales with product name, customer, quantity, sold_at
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.product_id, p.name as product_name, c.name as customer, s.customer_id, s.quantity, s.sold_at, s.payment_status, s.amount_paid
      FROM sales s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.sold_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/sales/pay-all-deferred - Pay all deferred sales for a specific purchase event
router.patch('/pay-all-deferred', async (req, res) => {
  try {
    const { customer_id, sold_at } = req.body;
    
    if (!customer_id || !sold_at) {
      return res.status(400).json({ error: 'customer_id and sold_at are required' });
    }
    
    // Convert customer_id to number if it's a string
    const customerId = Number(customer_id);
    
    // Convert sold_at to a Date object for comparison
    const soldAtDate = new Date(sold_at);
    
    // Get all deferred sales for this specific purchase event with more flexible timestamp comparison
    const salesRes = await pool.query(
      'SELECT id, product_id, quantity, amount_paid FROM sales WHERE payment_status = $1 AND customer_id = $2 AND DATE(sold_at) = DATE($3)',
      ['deferred', customerId, soldAtDate]
    );
    const sales = salesRes.rows;
    
    if (sales.length === 0) {
      return res.json({ updated: 0 });
    }
    
    let updatedCount = 0;
    for (const sale of sales) {
      // Get product price
      const productRes = await pool.query('SELECT price FROM products WHERE id = $1', [sale.product_id]);
      if (productRes.rows.length === 0) continue;
      const totalPrice = Number(productRes.rows[0].price) * sale.quantity;
      const newAmountPaid = totalPrice;
      await pool.query(
        'UPDATE sales SET amount_paid = $1, payment_status = $2 WHERE id = $3',
        [newAmountPaid, 'paid', sale.id]
      );
      updatedCount++;
    }
    res.json({ updated: updatedCount });
  } catch (err) {
    console.error('Error in pay-all-deferred:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/sales/:id/pay - Mark a sale as paid
router.patch('/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    // Only allow changing from deferred to paid
    const result = await pool.query(
      'UPDATE sales SET payment_status = $1 WHERE id = $2 AND payment_status = $3 RETURNING *',
      ['paid', id, 'deferred']
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Sale not found or already paid' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/sales/:id/pay-partial - Pay part of a deferred sale
router.patch('/:id/pay-partial', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    // Get current sale info
    const saleRes = await pool.query('SELECT * FROM sales WHERE id = $1', [id]);
    if (saleRes.rows.length === 0) return res.status(404).json({ error: 'Sale not found' });
    const sale = saleRes.rows[0];
    if (sale.payment_status === 'paid') return res.status(400).json({ error: 'Sale already paid' });
    // Get product price
    const productRes = await pool.query('SELECT price FROM products WHERE id = $1', [sale.product_id]);
    if (productRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const totalPrice = Number(productRes.rows[0].price) * sale.quantity;
    let newAmountPaid = Number(sale.amount_paid) + Number(amount);
    let newStatus = newAmountPaid >= totalPrice ? 'paid' : 'deferred';
    if (newAmountPaid > totalPrice) newAmountPaid = totalPrice;
    const result = await pool.query(
      'UPDATE sales SET amount_paid = $1, payment_status = $2 WHERE id = $3 RETURNING *',
      [newAmountPaid, newStatus, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
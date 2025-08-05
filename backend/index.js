require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Placeholder routes
app.use('/api/products', require('./routes/products'));
app.use('/api/buyers', require('./routes/buyers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sales', require('./routes/sales'));

app.get('/', (req, res) => {
  res.send('API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'sepatu-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET Semua Produk
router.get('/', async (req, res) => {
  const { brand, search } = req.query;
  try {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (brand && brand !== 'Semua') {
      query += ' AND brand = ?';
      params.push(brand);
    }
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY id DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data produk.' });
  }
});

// POST Tambah Produk Baru (Admin)
router.post('/', verifyToken, isAdmin, upload.single('imageFile'), async (req, res) => {
  const { name, brand, price, stock, description, imageUrl } = req.body;

  if (!name || !brand || !price || stock === undefined) {
    return res.status(400).json({ message: 'Nama, brand, harga, dan stok wajib diisi.' });
  }

  const imagePath = req.file ? req.file.filename : (imageUrl || '');

  try {
    const [result] = await db.query(
      'INSERT INTO products (name, brand, price, stock, image, description) VALUES (?, ?, ?, ?, ?, ?)',
      [name, brand, Number(price), Number(stock), imagePath, description || '']
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan.',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Add Product Error:', error);
    res.status(500).json({ message: 'Gagal menambahkan produk.' });
  }
});

// PUT Edit Produk & Stok (Admin)
router.put('/:id', verifyToken, isAdmin, upload.single('imageFile'), async (req, res) => {
  const { id } = req.params;
  const { name, brand, price, stock, description, imageUrl } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });
    }

    const current = existing[0];
    const finalImage = req.file
      ? req.file.filename
      : (imageUrl !== undefined && imageUrl !== '' ? imageUrl : current.image);

    await db.query(
      'UPDATE products SET name = ?, brand = ?, price = ?, stock = ?, image = ?, description = ? WHERE id = ?',
      [
        name || current.name,
        brand || current.brand,
        price !== undefined ? Number(price) : current.price,
        stock !== undefined ? Number(stock) : current.stock,
        finalImage,
        description !== undefined ? description : current.description,
        id
      ]
    );

    res.json({ message: 'Produk berhasil diperbarui.' });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ message: 'Gagal memperbarui produk.' });
  }
});

// DELETE Hapus Produk (Admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ message: 'Gagal menghapus produk.' });
  }
});

module.exports = router;
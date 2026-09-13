'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    unit: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // สถานะสำหรับแก้ไขแบบ inline (เก็บ id ของแถวที่กำลังแก้ไข + ค่าฟอร์มแก้ไข)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // ดึงข้อมูลสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMsg('โหลดข้อมูลสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
      setErrorMsg('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // จัดการค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลงตาราง products
  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('products').insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        unit: form.unit,
      },
    ]);

    if (error) {
      setErrorMsg('เพิ่มสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setForm({ sku: '', name: '', price: '', stock: '', unit: '' });
      setErrorMsg('');
      fetchProducts();
    }
    setSubmitting(false);
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm('ยืนยันการลบสินค้านี้หรือไม่?');
    if (!confirmDelete) return;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setErrorMsg('ลบสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  // เริ่มแก้ไขแถว (inline)
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  // ยกเลิกการแก้ไข
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // จัดการค่าฟอร์มแก้ไข
  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขสินค้า
  const handleUpdate = async (id) => {
    const { error } = await supabase
      .from('products')
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq('id', id);

    if (error) {
      setErrorMsg('แก้ไขสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setEditingId(null);
      setEditForm({});
      fetchProducts();
    }
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              type="text"
              name="sku"
              placeholder="SKU"
              value={form.sku}
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="name"
              placeholder="ชื่อสินค้า"
              value={form.name}
              onChange={handleFormChange}
            />
            <input
              type="number"
              name="price"
              placeholder="ราคา"
              step="0.01"
              value={form.price}
              onChange={handleFormChange}
            />
            <input
              type="number"
              name="stock"
              placeholder="คงเหลือ"
              value={form.stock}
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="unit"
              placeholder="หน่วย (เช่น ชิ้น, ขวด)"
              value={form.unit}
              onChange={handleFormChange}
            />
            <button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
            </button>
          </div>
        </form>
      </div>

      {/* ตารางแสดงรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan="6">ยังไม่มีสินค้าในระบบ</td>
              </tr>
            )}

            {products.map((product) => {
              const isEditing = editingId === product.id;

              return (
                <tr key={product.id}>
                  {isEditing ? (
                    <>
                      <td>
                        <input
                          type="text"
                          name="sku"
                          value={editForm.sku}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          name="price"
                          step="0.01"
                          value={editForm.price}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          name="stock"
                          value={editForm.stock}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          name="unit"
                          value={editForm.unit}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <button onClick={() => handleUpdate(product.id)}>บันทึก</button>{' '}
                        <button onClick={cancelEdit}>ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{product.sku}</td>
                      <td>{product.name}</td>
                      <td>{Number(product.price).toFixed(2)}</td>
                      <td>{product.stock}</td>
                      <td>{product.unit}</td>
                      <td>
                        <button onClick={() => startEdit(product)}>แก้ไข</button>{' '}
                        <button onClick={() => handleDelete(product.id)}>ลบ</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

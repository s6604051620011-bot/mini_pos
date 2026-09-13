'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือก + จำนวนที่จะขาย
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  // สถานะข้อความแจ้งเตือน
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  // ดึงรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg('โหลดรายการสินค้าไม่สำเร็จ: ' + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // หาข้อมูลสินค้าที่ถูกเลือกอยู่ในปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10);
  const totalPrice =
    selectedProduct && !isNaN(qtyNumber) && qtyNumber > 0
      ? selectedProduct.price * qtyNumber
      : 0;

  // ล้างฟอร์มหลังขายสำเร็จ
  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  // กดปุ่ม "ขาย"
  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // ตรวจสอบข้อมูลก่อน
    if (!selectedProductId) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    if (!quantity || qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนที่ต้องการขายให้ถูกต้อง');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('ไม่พบข้อมูลสินค้าที่เลือก');
      return;
    }

    // ตรวจสอบ stock คงเหลือว่าพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setProcessing(true);

    // 1. บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg('บันทึกการขายไม่สำเร็จ: ' + saleError.message);
      setProcessing(false);
      return;
    }

    // 2. อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (updateError) {
      setErrorMsg(
        'บันทึกการขายสำเร็จ แต่ปรับปรุงสต็อกไม่สำเร็จ: ' + updateError.message
      );
      setProcessing(false);
      return;
    }

    // สำเร็จ: แจ้งเตือน รีเซ็ตฟอร์ม และโหลดรายการสินค้าใหม่ (stock อัปเดตแล้ว)
    setSuccessMsg(
      `ขาย "${selectedProduct.name}" จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ ยอดรวม ${totalPrice.toFixed(2)} บาท`
    );
    resetForm();
    fetchProducts();
    setProcessing(false);
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p className="success-text">{successMsg}</p>}

      <div className="card">
        {loading ? (

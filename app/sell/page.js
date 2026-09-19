'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

// [เพิ่ม] เกณฑ์แจ้งเตือนสต็อกใกล้หมด
const LOW_STOCK_THRESHOLD = 5;

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [processing, setProcessing] = useState(false);

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

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const qtyNumber = parseInt(quantity, 10);
  const totalPrice =
    selectedProduct && !isNaN(qtyNumber) && qtyNumber > 0
      ? selectedProduct.price * qtyNumber
      : 0;

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  // [เพิ่ม] ฟังก์ชันกลางสำหรับยิงข้อความไปที่ API route
  // ใช้ try/catch คลุมไว้ ถ้าพลาดจะไม่กระทบ flow การขายที่สำเร็จไปแล้ว
  const sendTelegramNotification = async (text) => {
    try {
      const res = await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error('Telegram notify failed:', data.error);
      }
    } catch (err) {
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบ UI การขาย
      console.error('Telegram notify error:', err.message);
    }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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

    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setProcessing(true);

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

    // [เพิ่ม] เตรียมข้อมูลเวลาปัจจุบันแบบอ่านง่าย (ไทย)
    const nowText = new Date().toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // [เพิ่ม] งานที่ 1: แจ้งเตือน Order เข้าใหม่ (ไม่ await แบบบล็อก UI — ยิงแบบ fire-and-forget)
    const orderMessage =
      `🛍️ <b>มีรายการขายใหม่!</b>\n` +
      `- สินค้า: ${selectedProduct.name}\n` +
      `- จำนวน: ${qtyNumber} ชิ้น\n` +
      `- ราคารวม: ${totalPrice.toFixed(2)} บาท\n` +
      `- สต๊อกคงเหลือปัจจุบัน: ${newStock} ชิ้น\n` +
      `- เวลา: ${nowText}`;

    sendTelegramNotification(orderMessage);

    // [เพิ่ม] งานที่ 2: ถ้าสต็อกหลังตัด <= เกณฑ์ที่กำหนด ให้ยิงข้อความเตือนภัยแยกอีก 1 ข้อความ
    if (newStock <= LOW_STOCK_THRESHOLD) {
      const lowStockMessage =
        `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
        `- สินค้า: ${selectedProduct.name}\n` +
        `- คงเหลือเพียง: ${newStock} ชิ้น\n` +
        `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`;

      sendTelegramNotification(lowStockMessage);
    }

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
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({Number(product.price).toFixed(2)} บาท/{product.unit})
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <button type="submit" disabled={processing}>
                {processing ? 'กำลังบันทึก...' : 'ขาย'}
              </button>
            </div>

            {selectedProduct && (
              <p>
                คงเหลือในสต็อก: {selectedProduct.stock} {selectedProduct.unit} —{' '}
                ราคาต่อหน่วย: {Number(selectedProduct.price).toFixed(2)} บาท
              </p>
            )}

            <h3>ยอดรวม: {totalPrice.toFixed(2)} บาท</h3>
          </form>
        )}
      </div>
    </div>
  );
}

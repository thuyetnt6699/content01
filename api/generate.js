// /api/generate.js — Vercel Serverless Function (Node runtime)
// Yêu cầu: `OPENAI_API_KEY` trong Project → Settings → Environment Variables
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Chỉ nhận POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Kiểm tra API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).send('Missing OPENAI_API_KEY on server');
      return;
    }

    // Đọc body
    const {
      model = 'gpt-5',
      temperature: tempRaw = 0.5,
      productInfo = '',
      template = '',
    } = req.body || {};

    // Validate input tối thiểu
    if (!template?.trim() || !productInfo?.trim()) {
      res.status(400).json({ error: 'Thiếu template hoặc productInfo' });
      return;
    }

    // Chuẩn hóa temperature (0–2)
    let temperature = Number.isFinite(+tempRaw)
      ? Math.max(0, Math.min(2, +tempRaw))
      : 0.5;

    const client = new OpenAI({ apiKey });

    // SYSTEM & PROMPT
    const system = [
      'Bạn là biên tập viên viết bài giới thiệu sản phẩm cho e-commerce.',
      'Bắt buộc áp dụng đúng cấu trúc/định dạng theo TEMPLATE_USER.',
      'Giữ nguyên sự thật từ PRODUCT_INFO, không bịa số liệu/kích thước/giá.',
      'Văn phong tiếng Việt rõ ràng, gọn gàng; dùng markdown (tiêu đề/bold) như template.',
    ].join(' ');

    const userPrompt = `# TEMPLATE_USER
${template}

# PRODUCT_INFO
${productInfo}

# YÊU CẦU ĐẦU RA
- Viết lại theo đúng cấu trúc/template.
- Nếu thiếu dữ kiện, ghi rõ "(thiếu thông tin: ...)" thay vì bịa.
- Chỉ xuất NỘI DUNG BÀI VIẾT (markdown).`;

    // Payload cơ bản
    const basePayload = {
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user',   content: userPrompt },
      ],
    };

    // Gọi API: thử gửi temperature qua config trước (hợp với spec mới),
    // nếu 400/unsupported → fallback gọi lại không kèm temperature.
    let response;

    try {
      response = await client.responses.create({
        ...basePayload,
        config: { temperature },
      });
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      const stt = err?.status || err?.code || '';
      const isUnsupported =
        String(stt) === '400' ||
        msg.includes('unsupported') ||
        msg.includes('parameter') ||
        msg.includes('temperature');

      if (isUnsupported) {
        // Fallback: gọi lại không có temperature
        response = await client.responses.create(basePayload);
      } else {
        throw err;
      }
    }

    // Lấy text gọn nhất
    const text = response?.output_text || '';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ text });
  } catch (e) {
    // Log chi tiết lên Vercel Logs để debug
    console.error('OpenAI error:', e?.status || e?.code, e?.message, e?.response?.data);

    // Map lỗi phổ biến để hiển thị thân thiện
    const status = e?.status || 500;
    let message = e?.message || 'Server error';

    if (status === 401) {
      message = '401 Unauthorized — Sai hoặc thiếu OPENAI_API_KEY (server).';
    } else if (status === 429) {
      message = '429 Quota/Rate limit — Hãy kiểm tra Billing (Add payment method, Monthly budget > 0) hoặc thử lại sau.';
    } else if (status === 400) {
      message = '400 Bad Request — Tham số không hợp lệ (kiểm tra template, productInfo, hoặc tham số model).';
    }

    res.status(status).send(message);
  }
}

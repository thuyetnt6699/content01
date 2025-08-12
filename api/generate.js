// /api/generate.js — Vercel Serverless Function (Node runtime)
// Yêu cầu: OPENAI_API_KEY trong Project → Settings → Environment Variables
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).send('Missing OPENAI_API_KEY on server');
      return;
    }

    // ⬇️ NHẬN THÊM extraPrompt
    const {
      model = 'gpt-5',
      temperature: tempRaw = 0.5,
      productInfo = '',
      template = '',
      extraPrompt = '',   // << thêm
    } = req.body || {};

    if (!template?.trim() || !productInfo?.trim()) {
      res.status(400).json({ error: 'Thiếu template hoặc productInfo' });
      return;
    }

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

    // Ghép thêm HƯỚNG DẪN BỔ SUNG nếu có
    const extraBlock = extraPrompt?.trim()
      ? `

# HƯỚNG DẪN BỔ SUNG
${extraPrompt.trim()}`
      : '';

    const userPrompt = `# TEMPLATE_USER
${template}

# PRODUCT_INFO
${productInfo}${extraBlock}

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

    // Thử gửi temperature qua config trước; nếu 400/unsupported → fallback
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
        response = await client.responses.create(basePayload); // fallback
      } else {
        throw err;
      }
    }

    const text = response?.output_text || '';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ text });
  } catch (e) {
    console.error('OpenAI error:', e?.status || e?.code, e?.message, e?.response?.data);

    const status = e?.status || 500;
    let message = e?.message || 'Server error';

    if (status === 401) {
      message = '401 Unauthorized — Sai hoặc thiếu OPENAI_API_KEY (server).';
    } else if (status === 429) {
      message = '429 Quota/Rate limit — Kiểm tra Billing (Add payment method, Monthly budget > 0) hoặc thử lại sau.';
    } else if (status === 400) {
      message = '400 Bad Request — Tham số không hợp lệ (kiểm tra template, productInfo, extraPrompt, hoặc model).';
    }

    res.status(status).send(message);
  }
}

// /api/generate.js  — Vercel Serverless Function (Node runtime)
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const {
      model = 'gpt-5',
      temperature: tempRaw = 0.5,
      productInfo = '',
      template = '',
    } = req.body || {};

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Chuẩn hóa temperature (0–2)
    let temperature = Number.isFinite(+tempRaw) ? Math.max(0, Math.min(2, +tempRaw)) : 0.5;

    const system = [
      'Bạn là biên tập viên viết bài giới thiệu sản phẩm cho e-commerce.',
      'Bắt buộc áp dụng đúng cấu trúc/định dạng theo TEMPLATE_USER cung cấp.',
      'Giữ nguyên sự thật từ PRODUCT_INFO; không bịa số liệu.',
      'Ngôn ngữ: Tiếng Việt, rõ ràng, gọn gàng, dùng markdown tiêu đề/bold như template.'
    ].join(' ');

    const userPrompt = `# TEMPLATE_USER
${template}

# PRODUCT_INFO
${productInfo}

# YÊU CẦU ĐẦU RA
- Viết lại theo đúng cấu trúc/template.
- Nếu thiếu dữ kiện, ghi rõ "(thiếu thông tin: ...)".
- Chỉ xuất NỘI DUNG BÀI VIẾT (markdown).`;

    // Một số model (vd: gpt-5-mini) không nhận temperature ở root → loại bỏ để tránh 400.
    const supportsTemperatureAtRoot = (model === 'gpt-5');

    const payload = {
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user',   content: userPrompt },
      ],
    };
    if (supportsTemperatureAtRoot) {
      payload.temperature = temperature;
    }
    // Nếu sau này muốn thử truyền qua config:
    // payload.config = { temperature };

    const response = await client.responses.create(payload);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ text: response.output_text || '' });
  } catch (e) {
    console.error(e);
    res.status(500).send(e?.message || 'Server error');
  }
}

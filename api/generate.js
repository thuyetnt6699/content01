// /api/generate.js (Vercel Serverless Function)
import { OpenAI } from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  try {
    const { model = 'gpt-5', temperature = 0.5, productInfo = '', template = '' } = req.body || {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `Bạn là biên tập viên... (y hệt phần system ở câu trả lời trước)`;
    const userPrompt = `# TEMPLATE_USER\n${template}\n\n# PRODUCT_INFO\n${productInfo}\n\n# YÊU CẦU ĐẦU RA\n...`;

    // Trả JSON một lần (đơn giản). Có thể nâng cấp lên streaming sau.
    const resp = await client.responses.create({
      model, temperature,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ text: resp.output_text || '' });
  } catch (e) {
    res.status(500).send(e?.message || 'Server error');
  }
}

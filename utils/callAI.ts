const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const ZHIPU_KEY = process.env.EXPO_PUBLIC_ZHIPU_KEY ?? '';

export async function callAI(prompt: string): Promise<{ text: string; source: string }> {
  if (GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, source: 'Gemini' };
      }
    } catch {
      /* fall through to Zhipu */
    }
  }

  if (!ZHIPU_KEY) throw new Error('未配置 AI Key');

  const res2 = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res2.ok) throw new Error('AI 请求失败');
  const data2 = await res2.json();
  const text2 = data2?.choices?.[0]?.message?.content;
  if (!text2) throw new Error('返回内容为空');
  return { text: text2, source: '智谱 GLM' };
}

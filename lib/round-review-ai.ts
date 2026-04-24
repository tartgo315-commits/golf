const COACH_SYSTEM =
  '你是一个专业高尔夫教练，根据球员的成绩数据给出简洁实用的改进建议。用中文回答，语气直接，不要客套话。';

const BRIEFING_SYSTEM =
  '你是一个专业高尔夫赛前教练，根据球员数据生成简洁实用的赛前战术建议。用中文，语气简练有力，像教练赛前喊话一样。';

function getOpenAiCompatConfig() {
  const baseRaw =
    process.env.EXPO_PUBLIC_OPENAI_BASE_URL ||
    process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL ||
    'https://api.deepseek.com/v1';
  const base = baseRaw.replace(/\/$/, '');
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY || '';
  const model =
    process.env.EXPO_PUBLIC_OPENAI_MODEL || process.env.EXPO_PUBLIC_DEEPSEEK_MODEL || 'deepseek-chat';
  return { url: `${base}/chat/completions`, key, model };
}

/** OpenAI 兼容 chat/completions，用于 DeepSeek 等 */
export async function fetchRoundReviewChat(userPrompt: string): Promise<string> {
  const { url, key, model } = getOpenAiCompatConfig();
  if (!key) {
    throw new Error('缺少 API Key：请在 .env 中配置 EXPO_PUBLIC_OPENAI_API_KEY 或 EXPO_PUBLIC_DEEPSEEK_API_KEY');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: COACH_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text === 'string' && text.trim()) return text.trim();
  const errMsg = json?.error?.message;
  if (typeof errMsg === 'string' && errMsg) throw new Error(errMsg);
  throw new Error('模型返回为空');
}

/** 赛前简报：独立 system prompt，略提高 token 上限 */
export async function fetchBriefingChat(userPrompt: string): Promise<string> {
  const { url, key, model } = getOpenAiCompatConfig();
  if (!key) {
    throw new Error('缺少 API Key：请在 .env 中配置 EXPO_PUBLIC_OPENAI_API_KEY 或 EXPO_PUBLIC_DEEPSEEK_API_KEY');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: BRIEFING_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text === 'string' && text.trim()) return text.trim();
  const errMsg = json?.error?.message;
  if (typeof errMsg === 'string' && errMsg) throw new Error(errMsg);
  throw new Error('模型返回为空');
}

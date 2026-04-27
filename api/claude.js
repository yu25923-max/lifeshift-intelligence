// api/claude.js
// Anthropic API へのセキュアなプロキシ
// APIキーはVercelの環境変数 ANTHROPIC_API_KEY で管理します

export default async function handler(req, res) {
  // POST以外は拒否
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // APIキーチェック
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'web-search-2025-03-05'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // CORSヘッダー（同一オリジン運用なので基本不要だが念のため）
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
}

// 毎朝6時（JST）に自動実行されるCron Job
// ニュースを取得してVercel KV（キャッシュ）に保存する

const QUERIES = [
  { q: 'ミドルシニア キャリア転換 転職 2026', c: 'career' },
  { q: '定年延長 継続雇用 70歳 シニア 2026', c: 'career' },
  { q: '副業 複業 50代 フリーランス 独立 2026', c: 'career' },
  { q: 'シニア起業 第二キャリア 独立 2026', c: 'career' },
  { q: 'リスキリング 中高年 学び直し 社会人 2026', c: 'career' },
  { q: 'NISA iDeCo 老後 資産形成 2026', c: 'money' },
  { q: '年金改革 受給開始 繰下げ 2026', c: 'money' },
  { q: 'インフレ 物価 シニア 家計 生活費 2026', c: 'money' },
  { q: '健康寿命 予防医療 フレイル シニア 2026', c: 'health' },
  { q: 'ウェルビーイング 中高年 運動 メンタル 2026', c: 'health' },
  { q: '高齢化社会 雇用政策 厚労省 内閣府 2026', c: 'policy' },
  { q: '地方移住 シニア 地域活性化 2026', c: 'policy' },
  { q: 'active aging longevity economy 2026', c: 'global' },
  { q: 'retirement reform aging workforce OECD 2026', c: 'global' },
  { q: 'AI シニア デジタル活用 EdTech 2026', c: 'innovation' },
  { q: 'ヘルステック 高齢者 スタートアップ 2026', c: 'innovation' }
];

async function fetchNewsForQuery(qObj, apiKey) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `あなたはライフシフト専門ニュース収集AIです。ウェブ検索で最新記事を3件取得し、JSON配列のみ返してください。
信頼できる情報源のみ: NHK,日経,読売,朝日,毎日,厚労省,内閣府,Reuters,BBC,FT,OECD等。
除外: まとめサイト,転載,個人ブログ。
各要素: id,title,source,url,summary(80字以内),date,category(${qObj.c}),isGlobal(boolean)`,
        messages: [{ role: 'user', content: `「${qObj.q}」を検索し最新ニュース3件をJSON配列で。` }]
      })
    });
    const d = await r.json();
    const txt = d.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const s = txt.indexOf('['), e = txt.lastIndexOf(']');
    if (s < 0 || e < 0) return [];
    const arr = JSON.parse(txt.slice(s, e + 1));
    return arr.map((a, i) => ({ ...a, id: a.id || (qObj.c + '_' + Date.now() + '_' + i), category: qObj.c }));
  } catch { return []; }
}

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    let allNews = [];
    // 4件ずつ並列取得
    for (let i = 0; i < QUERIES.length; i += 4) {
      const chunk = QUERIES.slice(i, i + 4);
      const results = await Promise.all(chunk.map(q => fetchNewsForQuery(q, apiKey)));
      results.forEach(r => allNews = allNews.concat(r));
    }

    // 重複除去
    const seen = new Set();
    allNews = allNews.filter(n => {
      if (!n.title || seen.has(n.title)) return false;
      seen.add(n.title); return true;
    });

    // ニュースデータをグローバル変数に保存（KVがない場合のフォールバック）
    const updatedAt = new Date().toISOString();

    // レスポンスヘッダーでキャッシュを無効化
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      count: allNews.length,
      updatedAt,
      news: allNews
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

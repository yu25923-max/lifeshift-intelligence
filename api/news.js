// api/news.js
// Google News RSSを取得してJSONで返すAPI
// CORSエラー回避のためVercel経由で取得する

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter is required' });

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LifeShiftBot/1.0)'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch RSS' });
    }

    const xml = await response.text();

    // XMLをパースしてJSONに変換
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const itemXml = match[1];

      const title = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';

      const link = (itemXml.match(/<link>(.*?)<\/link>/) ||
                    itemXml.match(/<guid>(.*?)<\/guid>/) || [])[1] || '';

      const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';

      const source = (itemXml.match(/<source[^>]*>(.*?)<\/source>/) ||
                      itemXml.match(/<source[^>]*url="[^"]*"[^>]*>(.*?)<\/source>/) || [])[1] || '';

      const description = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                           itemXml.match(/<description>(.*?)<\/description>/) || [])[1] || '';

      // HTMLタグを除去
      const cleanDesc = description.replace(/<[^>]*>/g, '').trim().slice(0, 100);

      if (title) {
        items.push({
          title: title.trim(),
          url: link.trim(),
          date: pubDate ? new Date(pubDate).toLocaleDateString('ja-JP') : '',
          source: source.trim(),
          summary: cleanDesc
        });
      }
    }

    return res.status(200).json({ items: items.slice(0, 10) });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

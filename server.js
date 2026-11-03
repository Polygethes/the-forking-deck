import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 4321;

const server = http.createServer(async (req, res) => {
  // CORS headers just in case
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    try {
      const filePath = path.join(__dirname, 'index.html');
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading index.html: ' + err.message);
    }
    return;
  }

  // API Proxy Endpoint
  if (pathname === '/api/chat' && req.method === 'POST') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyStr || '{}');
        const { prompt, apiKey, apiBaseUrl, model } = payload;

        if (!apiKey || !apiKey.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API Key 不能为空，请在设置中输入' }));
          return;
        }

        let targetUrl = (apiBaseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
        if (!targetUrl.endsWith('/chat/completions')) {
          targetUrl += '/chat/completions';
        }

        console.log(`[API PROXY] 发送请求至: ${targetUrl}`);
        console.log(`[API PROXY] 模型: ${model || 'deepseek-chat'}, 提示词: "${prompt}"`);

        const systemPrompt = `你是一个专注小说与剧本叙事可能性的“裂变引擎”。
针对写作者输入的这一句话，不要写任何前言或客套话。从4个完全不同的戏剧张力维度，分裂出4个极富文学质感的接续发展方向（反转、深潜、危机、超验）。
必须输出纯净合法的 JSON 格式，不要使用 markdown 标记包裹：
{
  "branches": [
    {
      "type": "反转",
      "typeName": "预设打破",
      "tensionTitle": "核心冲击词",
      "sentence": "接续的一两句小说或剧本正文（精炼饱满，直接可放进正文）"
    },
    {
      "type": "深潜",
      "typeName": "感官印记",
      "tensionTitle": "记忆伏笔",
      "sentence": "接续内容"
    },
    {
      "type": "危机",
      "typeName": "外部突入",
      "tensionTitle": "致命逼近",
      "sentence": "接续内容"
    },
    {
      "type": "超验",
      "typeName": "荒诞诗性",
      "tensionTitle": "物性苏醒",
      "sentence": "接续内容"
    }
  ]
}`;

        const apiResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: (model || 'deepseek-chat').trim(),
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `原句是：“${prompt}”` }
            ],
            temperature: 0.9
          })
        });

        const status = apiResponse.status;
        console.log(`[API PROXY] 上游服务响应状态码: ${status}`);

        if (!apiResponse.ok) {
          const errText = await apiResponse.text();
          console.error(`[API PROXY 错误] HTTP ${status}:`, errText);
          let errorMsg = `上游接口返回错误 (${status})`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson.error?.message) errorMsg = errJson.error.message;
            else if (errJson.message) errorMsg = errJson.message;
          } catch (_) {
            if (errText) errorMsg += `: ${errText.slice(0, 150)}`;
          }

          res.writeHead(status >= 400 && status < 600 ? status : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: errorMsg, rawStatus: status }));
          return;
        }

        const data = await apiResponse.json();
        let rawContent = data.choices?.[0]?.message?.content || '{}';
        console.log(`[API PROXY 原始返回内容]:\n`, rawContent.slice(0, 200) + '...');

        // Clean markdown backticks ```json ... ```
        rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawContent = jsonMatch[0];

        let parsed;
        try {
          parsed = JSON.parse(rawContent);
        } catch (parseErr) {
          console.error('[API PROXY] JSON 解析失败:', parseErr.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '模型输出格式解析失败: ' + parseErr.message, raw: rawContent }));
          return;
        }

        const branches = (parsed.branches || []).map((b, idx) => ({
          ...b,
          id: 'branch_' + Date.now() + '_' + idx
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, branches }));
      } catch (err) {
        console.error('[API PROXY 异常]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || '内部代理错误' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SERVER] 可能性抽卡本地服务已启动: http://127.0.0.1:${PORT}`);
});

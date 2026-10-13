/**
 * 智能网页抓取 — 自动检测中文编码（GBK/GB2312/UTF-8）
 *
 * 中国政府网站大多使用 GBK/GB2312 编码，Node.js fetch 默认 UTF-8 会导致乱码
 */

import * as iconv from "iconv-lite";

export async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  // 1. Try Content-Type header
  const contentType = res.headers.get("content-type") || "";
  const headerMatch = contentType.match(/charset=([^\s;]+)/i);
  if (headerMatch) {
    const charset = headerMatch[1].toLowerCase().replace("gb2312", "gbk");
    if (charset !== "utf-8" && charset !== "utf8") {
      try {
        return iconv.decode(buffer, charset);
      } catch {}
    }
  }

  // 2. Try to detect GBK by checking if UTF-8 decode produces garbled text
  const utf8Text = buffer.toString("utf-8");
  // GBK content often has replacement characters when decoded as UTF-8
  if (utf8Text.includes("�") || hasGarbledChinese(utf8Text)) {
    try {
      const gbkText = iconv.decode(buffer, "gbk");
      // If GBK decode has fewer replacement chars, use it
      if ((gbkText.match(/�/g) || []).length < (utf8Text.match(/�/g) || []).length) {
        return gbkText;
      }
    } catch {}
  }

  return utf8Text;
}

function hasGarbledChinese(text: string): boolean {
  // Detect common garbled patterns from wrong encoding
  const garbledPatterns = /[鏄痯鑳借揪鐨刔鐢靛瓙閱嘓鎺у埗绯荤粺閰嶄欢绠＄悊绯荤粺鎵ц绯荤粺鎶鏈绯荤粺] /;
  if (garbledPatterns.test(text)) return true;

  // Too few Chinese characters relative to total length
  const chineseChars = text.match(/[一-鿿]/g);
  if (!chineseChars || chineseChars.length < text.length * 0.05) {
    // Less than 5% Chinese characters might indicate encoding issue
    // (but could also be an English page, so only flag if Content-Type hints at Chinese)
    return false;
  }

  return false;
}

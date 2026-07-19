/**
 * Netlify Function: Instagram Comment -> Auto Private Reply
 * -----------------------------------------------------------
 * يستقبل هذا الملف Webhook من Meta عند حدوث تعليق جديد على منشور
 * Instagram، ويتحقق من وجود كلمة مفتاحية في نص التعليق، ثم يرسل
 * "رد خاص" (Private Reply) تلقائي يحتوي على الرابط المطلوب.
 *
 * وضع تشخيص مؤقت: يرسل تفاصيل كل محاولة إلى webhook.site لتسهيل
 * تتبع الأخطاء بدون الحاجة لسجلات Netlify. احذف هذا الجزء لاحقًا
 * بعد التأكد من عمل كل شيء بشكل صحيح.
 */

// ============ الإعدادات (تُقرأ من Environment Variables في Netlify) ============
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const KEYWORD = (process.env.IG_KEYWORD !== undefined ? process.env.IG_KEYWORD : "رابط").toLowerCase();
const LINK_MESSAGE = process.env.IG_LINK_MESSAGE || "تفضل الرابط: https://example.com";
const GRAPH_API_VERSION = "v21.0";

// == رابط تشخيص مؤقت (احذفه لاحقًا) ==
const DEBUG_WEBHOOK_URL = "https://webhook.site/c6eacf17-b96e-4beb-a349-47079db1b559";

async function sendDebug(record) {
  try {
    await fetch(DEBUG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch (e) {
    // تجاهل أي خطأ بإرسال التشخيص حتى لا يوقف الدالة
  }
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};

  // ---------- 0) أداة تشخيص المتغيرات ----------
  if (event.httpMethod === "GET" && params.diag === "1") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        IG_VERIFY_TOKEN_set: Boolean(VERIFY_TOKEN),
        IG_PAGE_ACCESS_TOKEN_set: Boolean(PAGE_ACCESS_TOKEN),
        IG_PAGE_ACCESS_TOKEN_length: PAGE_ACCESS_TOKEN ? PAGE_ACCESS_TOKEN.length : 0,
        IG_KEYWORD_value: KEYWORD,
        IG_LINK_MESSAGE_value: LINK_MESSAGE,
      }, null, 2),
    };
  }

  // ---------- 1) التحقق من الـ Webhook (خطوة تسجيل الرابط لدى Meta) ----------
  if (event.httpMethod === "GET") {
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return { statusCode: 200, body: challenge };
    }
    return { statusCode: 403, body: "Verification failed" };
  }

  // ---------- 2) استقبال أحداث التعليقات ----------
  if (event.httpMethod === "POST") {
    let debugRecord = { stage: "start" };

    try {
      const body = JSON.parse(event.body || "{}");
      debugRecord.rawBody = body;

      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field !== "comments") continue;

          const value = change.value || {};
          const commentText = (value.text || "").toLowerCase();
          const commentId = value.id;

          debugRecord.commentText = value.text || "";
          debugRecord.commentId = commentId;
          debugRecord.fromId = value.from ? value.from.id : null;
          debugRecord.entryId = entry.id;

          if (!commentId) {
            debugRecord.stage = "no_comment_id";
            continue;
          }

          if (value.from && value.from.id === entry.id) {
            debugRecord.stage = "ignored_self_comment";
            continue;
          }

          const matchesKeyword = KEYWORD === "" ? true : commentText.includes(KEYWORD);
          debugRecord.matchesKeyword = matchesKeyword;
          debugRecord.keywordUsed = KEYWORD;

          if (matchesKeyword) {
            debugRecord.stage = "sending";
            try {
              const apiResult = await sendPrivateReply(commentId, LINK_MESSAGE);
              debugRecord.stage = "sent";
              debugRecord.apiResult = apiResult;
            } catch (sendErr) {
              debugRecord.stage = "send_failed";
              debugRecord.sendError = String(sendErr);
            }
          } else {
            debugRecord.stage = "keyword_not_matched";
          }
        }
      }

      await sendDebug(debugRecord);
      return { statusCode: 200, body: "EVENT_RECEIVED" };
    } catch (err) {
      debugRecord.stage = "exception";
      debugRecord.error = String(err);
      await sendDebug(debugRecord);
      return { statusCode: 200, body: "EVENT_RECEIVED_WITH_ERROR" };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};

/**
 * إرسال "رد خاص" (Private Reply) على تعليق معيّن عبر Instagram Messaging API
 */
async function sendPrivateReply(commentId, message) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const payload = {
    recipient: { comment_id: commentId },
    message: { text: message },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  return { httpStatus: res.status, ok: res.ok, response: data };
}

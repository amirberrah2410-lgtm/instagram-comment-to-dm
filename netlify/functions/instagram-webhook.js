/**
 * Netlify Function: Instagram Comment -> Auto Private Reply
 * -----------------------------------------------------------
 * يستقبل هذا الملف Webhook من Meta عند حدوث تعليق جديد على منشور
 * Instagram، ويتحقق من وجود كلمة مفتاحية في نص التعليق، ثم يرسل
 * "رد خاص" (Private Reply) تلقائي يحتوي على الرابط المطلوب.
 *
 * لا يوجد أي شرط للتحقق من المتابعة هنا (كما طلبت) - أي شخص يكتب
 * الكلمة المفتاحية في التعليق سيستلم الرسالة.
 */

// ============ الإعدادات (تُقرأ من Environment Variables في Netlify) ============
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;       // كلمة سر تختارها أنت للتحقق من الـ Webhook
const PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN; // Access Token الخاص بصفحة Facebook/Instagram
const KEYWORD = (process.env.IG_KEYWORD !== undefined ? process.env.IG_KEYWORD : "رابط").toLowerCase(); // الكلمة المفتاحية
const LINK_MESSAGE = process.env.IG_LINK_MESSAGE || "تفضل الرابط: https://example.com";
const GRAPH_API_VERSION = "v21.0";

exports.handler = async (event) => {
  // ---------- 0) أداة تشخيص: تحقق من وصول المتغيرات دون كشف قيمها ----------
  // افتح: https://YOUR-SITE.netlify.app/.netlify/functions/instagram-webhook?diag=1
  if (event.httpMethod === "GET" && event.queryStringParameters && event.queryStringParameters.diag === "1") {
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
    const params = event.queryStringParameters || {};
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return {
        statusCode: 200,
        body: challenge,
      };
    }
    return { statusCode: 403, body: "Verification failed" };
  }

  // ---------- 2) استقبال أحداث التعليقات ----------
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");

      // بنية أحداث Instagram: entry[].changes[].value
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field !== "comments") continue;

          const value = change.value || {};
          const commentText = (value.text || "").toLowerCase();
          const commentId = value.id; // معرف التعليق - نستخدمه لإرسال Private Reply

          if (!commentId) continue;

          // تجاهل تعليقات الحساب نفسه (لتفادي حلقة لا نهائية)
          if (value.from && value.from.id === entry.id) continue;

          // == وضع التشخيص المؤقت ==
          // إذا كانت IG_KEYWORD فارغة، يرد البوت على أي تعليق بدون شرط
          // (فقط لأغراض الاختبار، أعد الكلمة المفتاحية لاحقًا)
          const matchesKeyword = KEYWORD === "" ? true : commentText.includes(KEYWORD);

          if (matchesKeyword) {
            await sendPrivateReply(commentId, LINK_MESSAGE);
          }
        }
      }

      return { statusCode: 200, body: "EVENT_RECEIVED" };
    } catch (err) {
      console.error("Webhook processing error:", err);
      // نرجع 200 دائمًا لـ Meta حتى لا تعيد المحاولة بشكل متكرر بسبب خطأ داخلي
      return { statusCode: 200, body: "EVENT_RECEIVED_WITH_ERROR" };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};

/**
 * إرسال "رد خاص" (Private Reply) على تعليق معيّن عبر Instagram Messaging API
 * التوثيق الرسمي: Private Replies - Instagram Platform (Meta for Developers)
 */
async function sendPrivateReply(commentId, message) {
  // ملاحظة: عند الربط عبر "Instagram Login" مباشرة (بدون صفحة فيسبوك)،
  // يكون التوكن من نوع "Instagram User Access Token"، ويجب استخدام
  // نطاق graph.instagram.com بدلاً من graph.facebook.com
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

  if (!res.ok) {
    console.error("Failed to send private reply:", data);
  } else {
    console.log("Private reply sent:", data);
  }

  return data;
}

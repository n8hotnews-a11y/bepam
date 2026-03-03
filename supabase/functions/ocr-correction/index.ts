import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAccessToken } from "../shared/google-auth.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { rawText, imageBase64 } = await req.json();

        if (!rawText && !imageBase64) {
            throw new Error("Missing rawText or imageBase64");
        }

        const serviceAccountStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
        if (!serviceAccountStr) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT secret is missing');
        }

        const serviceAccount = JSON.parse(serviceAccountStr);
        const accessToken = await getAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id;
        const region = 'us-central1';
        const modelId = 'gemini-2.0-flash-001';

        let promptParts = [];

        // Mode 1: Image Processing (Best Accuracy)
        if (imageBase64) {
            const promptText = `Bạn là chuyên gia xử lý hóa đơn. Hãy phân tích hình ảnh hóa đơn mua sắm này và trích xuất danh sách thực phẩm/nguyên liệu nấu ăn.
1. Chỉ lấy THỰC PHẨM (bỏ qua xà phòng, khăn giấy, đồ gia dụng...).
2. Trích xuất chính xác Tên, Số lượng, Đơn vị. Tên phải viết đúng chính tả tiếng Việt.
3. Nếu không có số lượng, mặc định là 1.
4. Bỏ qua các dòng rác (Header, Footer, Tổng tiền).

TRẢ VỀ JSON ARRAY: [{"name": "...", "quantity": 1, "unit": "..."}]`;

            promptParts = [
                { text: promptText },
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ];
        }
        // Mode 2: Text Correction (Fallback)
        else {
            const promptText = `Bạn là một chuyên gia xử lý dữ liệu hóa đơn siêu thị tại Việt Nam.
Dưới đây là văn bản thô từ quá trình quét OCR cuả một hóa đơn mua sắm. Văn bản có thể bị sai chính tả hoặc thiếu dấu do chất lượng ảnh.

NHIỆM VỤ CỦA BẠN:
1. Xác định các mặt hàng THỰC PHẨM/NGUYÊN LIỆU NẤU ĂN có trong danh sách.
2. Sửa lại tên mặt hàng cho đúng tiếng Việt chuẩn (ví dụ: "DUI GA" -> "Đùi gà", "CA ROT" -> "Cà rốt").
3. Trích xuất số lượng (quantity) và đơn vị tính (unit) nếu có. Nếu không thấy số lượng, mặc định là 1.
4. Loại bỏ các thông tin rác như: mã số, ngày giờ, số điện thoại, giá tiền, tổng cộng, tiền thối.

ĐỊNH DẠNG ĐẦU RA (JSON ARRAY):
[
  {"name": "Tên thực phẩm", "quantity": 1, "unit": "kg/g/cái/túi..."},
  ...
]

VĂN BẢN OCR THÔ:
---
${rawText}
---

CHỈ trả về mảng JSON, không giải thích gì thêm.`;

            promptParts = [{ text: promptText }];
        }

        const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: promptParts
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Vertex AI API Error: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

        console.log("--- AI RAW RESPONSE ---");
        console.log(text);
        console.log("------------------------");

        // Clean markdown
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse to ensure valid JSON
        let items = [];
        try {
            items = JSON.parse(text);
            if (!Array.isArray(items)) items = [];
        } catch (e) {
            console.error("AI returned invalid JSON:", text);
            items = [];
        }

        return new Response(
            JSON.stringify(items),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in ocr-correction:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

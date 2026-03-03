import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAccessToken } from "../shared/google-auth.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_INSTRUCTION = `Bạn là Bếp Trưởng AI của ứng dụng "Cơm Nhà". 
Nhiệm vụ của bạn là hỗ trợ người dùng nấu ăn, gợi ý thực đơn, giải thích công thức và tư vấn về dinh dưỡng.
- Hãy trả lời bằng tiếng Việt thân thiện, chuyên nghiệp và truyền cảm hứng nấu nướng.
- Ưu tiên các nguyên liệu và phong cách nấu ăn Việt Nam nhưng cũng sẵn sàng hỗ trợ các món quốc tế.
- Nếu câu hỏi không liên quan đến ẩm thực, hãy khéo léo dẫn dắt người dùng quay lại chủ đề bếp núc.`;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { messages } = await req.json();
        const serviceAccountStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');

        if (!serviceAccountStr) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT secret is missing');
        }

        const serviceAccount = JSON.parse(serviceAccountStr);
        const accessToken = await getAccessToken(serviceAccount);
        const projectId = serviceAccount.project_id;
        const region = 'us-central1'; // Or configurable
        const modelId = 'gemini-2.0-flash-001'; // Vertex AI model name, verify exact ID

        // Transform messages to Vertex AI format
        // Vertex AI expects: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
        let contents = messages.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts ? (msg.parts[0]?.text || '') : (msg.text || '') }]
        }));

        // Vertex AI requirement: The first message must be from the user
        while (contents.length > 0 && contents[0].role !== 'user') {
            contents.shift();
        }

        if (contents.length === 0) {
            throw new Error('No user messages found in history');
        }

        // Vertex AI requirement: Roles must alternate between user and model
        const validContents = [];
        let lastRole = null;
        for (const content of contents) {
            if (content.role !== lastRole) {
                validContents.push(content);
                lastRole = content.role;
            } else {
                // If the same role appears twice, we append the text to the last message's parts
                const lastMsg = validContents[validContents.length - 1];
                lastMsg.parts[0].text += "\n" + content.parts[0].text;
            }
        }
        contents = validContents;

        // Add system instruction if supported or prepend to first message
        // Gemini 1.5 supports systemInstruction

        const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: {
                    parts: [{ text: SYSTEM_INSTRUCTION }]
                },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Vertex AI Error:', errText);
            throw new Error(`Vertex AI API Error: ${response.statusText} - ${errText}`);
        }

        const data = await response.json();

        // Extract text from response
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, tôi không thể trả lời lúc này.";

        return new Response(
            JSON.stringify({ success: true, text: replyText }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error in chat-chef:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

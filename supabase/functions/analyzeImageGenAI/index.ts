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
    const { imageBase64, mimeType, instructions } = await req.json();

    const serviceAccountStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT secret is missing');
    }

    const serviceAccount = JSON.parse(serviceAccountStr);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const region = 'us-central1';
    const modelId = 'gemini-2.0-flash-001';

    const defaultPrompt = `
Phân tích ảnh thực phẩm này và nhận diện tất cả nguyên liệu hoặc thực phẩm có thể nhìn thấy.
YÊU CẦU QUAN TRỌNG:
1. Tên thực phẩm BẮT BUỘC phải bằng TIẾNG VIỆT (Ví dụ: "Thịt ba chỉ" thay vì "Pork Belly", "Cải thìa" thay vì "Bok Choy", "Táo" thay vì "Apple").
2. Số lượng ước tính bằng tiếng Việt (ví dụ: "1 miếng", "300g", "2 quả").
3. category_id CHỈ ĐƯỢC CHỌN TRONG: ["vegetables", "meat", "seafood", "fruits", "dairy", "spices", "others"].
4. Trả về JSON array với format: [{"name": "tên tiếng Việt", "quantity": "số lượng ước tính", "category_id": "phân loại", "confidence": 0.8}]
5. Chỉ bao gồm các thực phẩm bạn tự tin nhận diện được.
`;

    const prompt = instructions ? `${defaultPrompt}\n\nHướng dẫn bổ sung: ${instructions}` : defaultPrompt;

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
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Vertex AI Error:', errText);
      throw new Error(`Vertex AI API Error: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Clean JSON markdown
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const items = JSON.parse(text);
      return new Response(
        JSON.stringify({ success: true, items }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Parse Error:', parseError, text);
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned invalid JSON' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in analyzeImageGenAI:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
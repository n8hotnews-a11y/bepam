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
    const { ingredients, style, familyContext } = await req.json();

    // Handle ingredients if it's a string (from AI Search) or array (from Fridge list)
    const ingredientsList = Array.isArray(ingredients) ? ingredients.join(', ') : ingredients;

    const serviceAccountStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT secret is missing');
    }

    const serviceAccount = JSON.parse(serviceAccountStr);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const region = 'us-central1';
    const modelId = 'gemini-2.0-flash-001';

    const prompt = `
Bạn là Bếp trưởng AI của ứng dụng "Cơm Nhà". 
Dựa vào yêu cầu/nguyên liệu này: ${ingredientsList}
Hãy gợi ý 3-5 món ăn theo phong cách: ${style}.
${familyContext ? `Bối cảnh gia đình: ${familyContext}` : ''}

YÊU CẦU QUAN TRỌNG: Chỉ trả về duy nhất dữ liệu định dạng JSON theo cấu trúc sau, không kèm văn bản giải thích:
{
  "recipes": [
    {
      "id": "ai_unique_id",
      "title": "Tên món ăn",
      "description": "Mô tả ngắn gọn",
      "ingredients": ["Nguyên liệu 1", "Nguyên liệu 2"],
      "instructions": "Hướng dẫn các bước nấu nướng cụ thể",
      "readyInMinutes": 30,
      "healthScore": 80,
      "image": "https://via.placeholder.com/300x200?text=Mon+Viet"
    }
  ]
}

Hãy viết mô tả và tên món bằng tiếng Việt thân thiện.
`;

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
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Vertex AI Error:', errText);
      throw new Error(`Vertex AI API Error: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Clean JSON markdown if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsedData = JSON.parse(text);
      return new Response(
        JSON.stringify({ success: true, recipes: parsedData.recipes || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Parse Error:', parseError, text);
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned invalid JSON. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in suggestRecipesGenAI:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
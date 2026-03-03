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
    const { imageBase64, mimeType } = await req.json();

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
Analyze this food image and identify all visible ingredients or food items.
Return a JSON array of objects with format:
[{"name": "ingredient name", "quantity": "estimated quantity", "confidence": 0.8}]
Be specific about types (e.g., "chicken breast" not just "chicken").
Only include food items you can confidently identify.
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
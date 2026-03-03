import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SPOONACULAR_API_KEY = Deno.env.get('SPOONACULAR_API_KEY')!;

export default async function serve(req: Request) {
  try {
    const { query, options } = await req.json();

    // Check cache first
    const cacheKey = JSON.stringify({ query, options });
    const { data: cacheData } = await supabase
      .from('recipe_cache')
      .select('data, cached_at')
      .eq('cache_key', cacheKey)
      .single();

    const cacheAge = cacheData ? (Date.now() - new Date(cacheData.cached_at).getTime()) / (1000 * 60) : Infinity; // minutes

    if (cacheData && cacheAge < 1440) { // 24 hours
      return new Response(
        JSON.stringify({ success: true, results: cacheData.data }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from Spoonacular
    const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_API_KEY}&query=${encodeURIComponent(query)}&addRecipeInformation=true&number=10`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'API error');

    // Cache the result
    await supabase.from('recipe_cache').upsert({
      cache_key: cacheKey,
      data: data.results,
      cached_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, results: data.results }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
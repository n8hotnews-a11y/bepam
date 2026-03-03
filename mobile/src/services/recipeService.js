import Constants from "expo-constants";
import { cacheService } from './cacheService';
import { supabase } from './supabaseConfig';
import { hybridRecipeService } from './hybrid/HybridRecipeService';

const SYSTEM_INSTRUCTION = `Bạn là Bếp Trưởng AI của ứng dụng "Cơm Nhà". 
Nhiệm vụ của bạn là hỗ trợ người dùng nấu ăn, gợi ý thực đơn, giải thích công thức và tư vấn về dinh dưỡng.
- Hãy trả lời bằng tiếng Việt thân thiện, chuyên nghiệp và truyền cảm hứng nấu nướng.
- Ưu tiên các nguyên liệu và phong cách nấu ăn Việt Nam nhưng cũng sẵn sàng hỗ trợ các món quốc tế.
- TRÌNH BÀY: Sử dụng ngôn ngữ tự nhiên, tránh lạm dụng quá nhiều dấu sao (**) để in đậm. Chỉ in đậm những từ khóa thực sự quan trọng.
- Nếu câu hỏi không liên quan đến ẩm thực, hãy khéo léo dẫn dắt người dùng quay lại chủ đề bếp núc.`;

const formatError = (error) => {
    console.log("[RecipeService] Formatting error:", JSON.stringify(error, null, 2));

    const message = error.message || String(error);

    if (message.includes("FunctionsHttpError") || message.includes("non-2xx status code")) {
        return "Máy chủ AI đang bận xử lý, bạn vui lòng thử lại sau giây lát nhé!";
    }

    if (message.includes("resource-exhausted") || message.includes("hết lượt dùng")) {
        return "Bạn đã hết lượt sử dụng AI trong ngày hôm nay. Hãy quay lại vào ngày mai nhé!";
    }

    // Cập nhật: Báo chính xác lỗi 401 là do phiên đăng nhập
    if (message.includes("authorized") || message.includes("401") || message.includes("Auth")) {
        return "Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để dùng tính năng AI nhé!";
    }

    if (message.includes("network") || message.includes("fetch")) {
        return "Kết nối mạng không ổn định. Bạn vui lòng kiểm tra lại mạng nhé!";
    }

    return "Rất tiếc, đã có lỗi xảy ra khi tải dữ liệu. Bạn thử lại sau nhé!";
};

const AI_RECIPE_CACHE_PREFIX = 'ai_recipe_';
const AI_RECIPE_TITLE_MAP = 'ai_recipe_title_map';

// Helper function để lấy headers có chứa Token (Đảm bảo an toàn trên React Native)
const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const recipeService = {
    async ensureInitialized() {
        await hybridRecipeService.initialize();
    },

    async analyzeImageGenAI(base64Image) {
        try {
            console.log("[RecipeService] Calling analyzeImageGenAI...");
            const response = await supabase.functions.invoke('analyzeImageGenAI', {
                body: {
                    imageBase64: base64Image,
                    mimeType: 'image/jpeg'
                },
                headers: await getAuthHeaders() // Ép gửi token
            });

            const { data, error } = response;

            if (error) {
                console.error("[RecipeService] Analysis Edge Function Error:", error);
                throw error;
            }

            if (!data || !data.success) {
                throw new Error(data?.error || "Analysis failed");
            }

            return { success: true, items: data.items };
        } catch (error) {
            console.error("[RecipeService] analyzeImageGenAI Error:", error);
            return { success: false, error: formatError(error) };
        }
    },

    async suggestRecipesGenAI(ingredients, style = 'Truyền thống', user_id = null) {
        try {
            let familyContext = '';
            if (user_id) {
                try {
                    const { familyMemberService } = await import('./familyMemberService');
                    if (familyMemberService && typeof familyMemberService.getFamilyConstraints === 'function') {
                        const constraintsResult = await familyMemberService.getFamilyConstraints(user_id);
                        if (constraintsResult?.success && constraintsResult.constraints?.memberCount > 0) {
                            const { dietaryPreferences, healthConditions } = constraintsResult.constraints;
                            familyContext = `
Gia đình có ${constraintsResult.constraints.memberCount} thành viên.
Sở thích ăn uống chung: ${dietaryPreferences?.join(', ') || 'Không có'}.
Lưu ý sức khỏe: ${healthConditions?.join(', ') || 'Không có'}.
Hãy ưu tiên gợi ý món phù hợp với sở thích và tránh các món không phù hợp với sức khỏe gia đình.`;
                        }
                    }
                } catch (importError) {
                    console.warn("[RecipeService] Could not load familyMemberService:", importError);
                }
            }

            const response = await supabase.functions.invoke('suggestRecipesGenAI', {
                body: { ingredients, style, familyContext },
                headers: await getAuthHeaders() // Ép gửi token chống lỗi 401 do race condition
            });

            if (!response) {
                throw new Error("Không nhận được phản hồi từ hệ thống AI.");
            }

            const { data, error } = response;

            if (error) {
                console.error("[RecipeService] Edge Function Error:", error);
                throw error;
            }

            if (!data || !data.success) {
                throw new Error(data?.error || "Suggestion failed");
            }

            const recipesArray = Array.isArray(data.recipes) ? data.recipes : [];
            const transformedRecipes = recipesArray
                .map(r => recipeService.transformAIRecipe(r)) // Đổi this thành recipeService
                .filter(r => !!r);

            transformedRecipes.forEach(r => {
                recipeService.saveAIRecipeToCache(r); // Đổi this thành recipeService
            });

            return { success: true, recipes: transformedRecipes };
        } catch (error) {
            console.error("[RecipeService] suggestRecipesGenAI Error:", error);
            return { success: false, error: formatError(error) };
        }
    },

    async suggestDailyMealsAI(user_id) {
        try {
            const { inventoryService } = await import('./inventoryService');

            const inventoryRes = await inventoryService.getItems(user_id);
            const ingredients = inventoryRes.success
                ? inventoryRes.items.map(i => i.item_name).join(', ')
                : 'Hiện tủ lạnh trống';

            const prompt = `Hãy gợi ý đúng 3 món ăn cho 3 bữa: Sáng, Trưa, Tối. 
            Dựa trên các nguyên liệu có sẵn: ${ingredients}.
            Hãy chọn các món Việt Nam hài hòa và đủ dinh dưỡng.`;

            const result = await recipeService.suggestRecipesGenAI(prompt, 'Daily Plan', user_id);

            if (result.success && result.recipes.length >= 3) {
                return {
                    success: true,
                    meals: {
                        breakfast: result.recipes[0],
                        lunch: result.recipes[1],
                        dinner: result.recipes[2]
                    }
                };
            } else if (result.success && result.recipes.length > 0) {
                return {
                    success: true,
                    meals: {
                        breakfast: result.recipes[0],
                        lunch: result.recipes[Math.min(1, result.recipes.length - 1)],
                        dinner: result.recipes[Math.min(2, result.recipes.length - 1)]
                    }
                };
            }

            throw new Error(result.error || "Không thể lấy gợi ý thực đơn.");
        } catch (error) {
            console.error("[RecipeService] suggestDailyMealsAI Error:", error);
            return { success: false, error: formatError(error) };
        }
    },

    async reconstructAIRecipe(title) {
        try {
            const titleMap = await cacheService.get(AI_RECIPE_TITLE_MAP) || {};
            const cachedId = titleMap[title.toLowerCase().trim()];
            if (cachedId) {
                const cachedRecipe = await cacheService.get(AI_RECIPE_CACHE_PREFIX + cachedId);
                if (cachedRecipe) {
                    console.log('[RecipeService] Reconstructed from cache (title):', title);
                    return { success: true, data: cachedRecipe };
                }
            }

            const prompt = `Hãy tạo lại công thức chi tiết cho món: "${title}". Chỉ cần trả về duy nhất món này.`;
            const response = await supabase.functions.invoke('suggestRecipesGenAI', {
                body: { ingredients: prompt, style: 'Chi tiết, Chính xác' },
                headers: await getAuthHeaders()
            });

            const { data, error } = response;

            if (error) {
                console.error("[RecipeService] Reconstruct Edge Function Error:", error);
                throw error;
            }

            if (!data || !data.success || !data.recipes?.[0]) {
                throw new Error(data?.error || "Không thể khôi phục công thức.");
            }

            const recipe = recipeService.transformAIRecipe(data.recipes[0]);
            if (recipe) {
                recipeService.saveAIRecipeToCache(recipe);
            }

            return { success: true, data: recipe };
        } catch (error) {
            console.error("[RecipeService] reconstructAIRecipe Error:", error);
            return { success: false, error: formatError(error) };
        }
    },

    async saveAIRecipeToCache(recipe) {
        if (!recipe || !recipe.id) return;
        try {
            await cacheService.set(AI_RECIPE_CACHE_PREFIX + recipe.id, recipe, 30 * 24 * 60);
            const titleMap = await cacheService.get(AI_RECIPE_TITLE_MAP) || {};
            titleMap[recipe.title.toLowerCase().trim()] = recipe.id;
            await cacheService.set(AI_RECIPE_TITLE_MAP, titleMap, 30 * 24 * 60);
        } catch (error) {
            console.error('Error saving AI recipe to cache:', error);
        }
    },

    async clearAICache() {
        try {
            await cacheService.remove(AI_RECIPE_TITLE_MAP);
            await cacheService.clearAll();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async chatWithChef(message, history = []) {
        try {
            console.log("Chat request to Gemini:", { message, userHistoryCount: history.length });

            const validHistory = [
                ...history,
                { role: 'user', parts: [{ text: message }] }
            ];

            const { data, error } = await supabase.functions.invoke('chat-chef', {
                body: { messages: validHistory },
                headers: await getAuthHeaders()
            });

            if (error) throw error;
            if (!data || !data.success) throw new Error(data?.error || "Chat failed");

            return { success: true, text: data.text };
        } catch (error) {
            console.error("Gemini Chat Error:", error);
            if (error.message?.includes("API_KEY_INVALID")) {
                return { success: false, error: "API Key Gemini không hợp lệ. Vui lòng kiểm tra lại cấu hình." };
            }
            return { success: false, error: "Bếp trưởng AI đang bận một chút, bạn thử lại sau nhe! 👨‍🍳" };
        }
    },

    async searchRecipes(query, options = {}) {
        try {
            let results = hybridRecipeService.getRecipes();
            if (query) {
                const lowerQuery = query.toLowerCase();
                results = results.filter(r =>
                    r.title.toLowerCase().includes(lowerQuery) ||
                    r.ingredients.some(i => i.toLowerCase().includes(lowerQuery))
                );
            }
            if (options.type) {
                const lowerType = options.type.toLowerCase();
                results = results.filter(r =>
                    r.type === options.type ||
                    (r.category && r.category.toLowerCase() === lowerType) ||
                    r.title.toLowerCase().includes(lowerType)
                );
            }
            return { success: true, results: results };
        } catch (error) {
            console.error("Search failed:", error.message);
            return { success: false, error: formatError(error) };
        }
    },

    async getVietnameseInventoryMatches(inventoryItems, options = {}) {
        try {
            if (!inventoryItems || inventoryItems.length === 0) return { success: true, results: [] };

            const availableIngredients = inventoryItems.map(i => i.toLowerCase().trim());
            let recipes = hybridRecipeService.getRecipes();

            if (options.type) {
                const lowerType = options.type.toLowerCase();
                recipes = recipes.filter(r =>
                    r.title.toLowerCase().includes(lowerType) ||
                    (r.category && r.category.toLowerCase() === lowerType)
                );
            }

            const matches = recipes.map(recipe => {
                let matchCount = 0;
                let missingCount = 0;
                recipe.ingredients.forEach(ing => {
                    const ingLower = ing.toLowerCase();
                    const isAvailable = availableIngredients.some(avail =>
                        ingLower.includes(avail) || avail.includes(ingLower)
                    );
                    if (isAvailable) matchCount++;
                    else missingCount++;
                });
                return { ...recipe, matchCount, missingCount, totalIngredients: recipe.ingredients.length };
            });

            const sorted = matches
                .filter(r => r.matchCount > 0)
                .sort((a, b) => {
                    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
                    return a.missingCount - b.missingCount;
                })
                .slice(0, options.limit || 10);

            return { success: true, results: sorted };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    parseInstructions(text) {
        if (!text) return [];
        if (/\d+\.\s/.test(text)) {
            const steps = text.split(/\s*(?=\d+\.\s)/).filter(s => s.trim().length > 0);
            return steps.map((step, index) => ({
                number: index + 1,
                step: step.replace(/^\d+\.\s*/, '').trim()
            }));
        }
        const lines = text.split(/\n+/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
            return lines.map((line, index) => ({
                number: index + 1,
                step: line.trim()
            }));
        }
        return [{ number: 1, step: text.trim() }];
    },

    transformAIRecipe(aiRecipe) {
        try {
            if (!aiRecipe) return null;
            const steps = recipeService.parseInstructions(aiRecipe.instructions); // Đổi this thành recipeService

            const extendedIngredients = (aiRecipe.ingredients || []).map((ing, idx) => {
                return {
                    id: idx,
                    original: ing,
                    originalName: ing,
                    name: ing,
                    nameClean: ing,
                    amount: 0,
                    unit: ''
                };
            });

            return {
                id: aiRecipe.id || `ai_${aiRecipe.title.toLowerCase().trim().replace(/\s+/g, '_')}`,
                title: aiRecipe.title,
                image: aiRecipe.image,
                readyInMinutes: aiRecipe.readyInMinutes || 30,
                servings: 4,
                healthScore: aiRecipe.healthScore || 80,
                extendedIngredients: extendedIngredients,
                analyzedInstructions: [{ name: "", steps: steps }],
                instructions: aiRecipe.instructions,
                sourceUrl: "https://comnha.app",
                spoonacularScore: aiRecipe.healthScore || 80,
                nutrition: { nutrients: [{ name: "Calories", amount: 300, unit: "kcal" }] }
            };
        } catch (error) {
            console.error("Transform AI Recipe Error:", error);
            return null;
        }
    },

    async getRecipeDetails(id) {
        try {
            const localRecipe = hybridRecipeService.getRecipeById(id);
            if (localRecipe) {
                const steps = recipeService.parseInstructions(localRecipe.instructions || '');

                return {
                    success: true,
                    data: {
                        id: localRecipe.id,
                        title: localRecipe.title,
                        image: localRecipe.image,
                        readyInMinutes: localRecipe.readyInMinutes,
                        servings: 4,
                        healthScore: localRecipe.healthScore,
                        extendedIngredients: localRecipe.ingredients.map((ing, idx) => ({
                            id: idx, original: ing, originalName: ing, name: ing, amount: 1, unit: 'phần', nameClean: ing
                        })),
                        analyzedInstructions: [{ name: "", steps: steps }],
                        instructions: localRecipe.instructions,
                        sourceUrl: "https://comnha.app",
                        spoonacularScore: localRecipe.healthScore,
                        nutrition: { nutrients: [{ name: "Calories", amount: parseInt(localRecipe.calories) || 300, unit: "kcal" }] }
                    }
                };
            }

            if (typeof id === 'string' && id.startsWith('ai_')) {
                const cachedAIRecipe = await cacheService.get(AI_RECIPE_CACHE_PREFIX + id);
                if (cachedAIRecipe) {
                    console.log('[RecipeService] Loaded AI recipe from cache:', id);
                    return { success: true, data: cachedAIRecipe };
                }
            }

            throw new Error("Recipe not found");
        } catch (error) {
            return { success: false, error: formatError(error) };
        }
    }
};
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

    // 1. ƯU TIÊN 1: Kiểm tra mã HTTP Status (401 = Lỗi Token/Đăng nhập)
    // Supabase thường bọc status trong error.status hoặc error.context.status
    const statusCode = error.status || error?.context?.status;
    if (statusCode === 401 || message.includes("authorized") || message.includes("401") || message.includes("Auth")) {
        return "Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để dùng tính năng AI nhé!";
    }

    // 2. ƯU TIÊN 2: Kiểm tra lỗi quá tải/hết lượt
    if (message.includes("resource-exhausted") || message.includes("hết lượt dùng")) {
        return "Bạn đã hết lượt sử dụng AI trong ngày hôm nay. Hãy quay lại vào ngày mai nhé!";
    }

    // 3. ƯU TIÊN 3: Các lỗi server/hàm Edge Function chung chung
    if (message.includes("FunctionsHttpError") || message.includes("non-2xx status code")) {
        return "Máy chủ AI đang bận xử lý, bạn vui lòng thử lại sau giây lát nhé!";
    }

    // 4. Lỗi mạng
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
                }
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
                body: { ingredients, style, familyContext }
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

    /**
         * Tự động gợi ý thực đơn ngày linh hoạt theo cấu trúc mâm cơm gia đình Việt
         */
    async suggestDailyMealsAI(user_id) {
        try {
            const { inventoryService } = await import('./inventoryService');

            // 1. Lấy dữ liệu nguyên liệu trong tủ lạnh
            const inventoryRes = await inventoryService.getItems(user_id);
            const ingredients = inventoryRes.success && inventoryRes.items.length > 0
                ? inventoryRes.items.map(i => i.item_name).join(', ')
                : 'Tủ lạnh hiện tại chưa có thông tin nguyên liệu, hãy đề xuất các nguyên liệu phổ thông dễ mua.';

            // 2. Lấy thông tin gia đình
            let familyDetails = 'Chưa có thông tin chi tiết các thành viên trong gia đình.';
            if (user_id) {
                try {
                    const { familyMemberService } = await import('./familyMemberService');
                    const membersRes = await familyMemberService.getFamilyMembers(user_id);
                    if (membersRes.success && membersRes.data && membersRes.data.length > 0) {
                        familyDetails = membersRes.data.map(m =>
                            `- ${m.name || m.role} (${m.age_group || 'Không rõ tuổi'}): Thích ăn ${m.dietary_preferences?.join(', ') || 'đa dạng'}, Dị ứng/Kiêng: ${m.allergies?.join(', ') || 'Không'}, Lưu ý sức khỏe: ${m.health_conditions?.join(', ') || 'Bình thường'}.`
                        ).join('\n');
                    }
                } catch (err) {
                    console.warn("[RecipeService] Could not fetch detailed family members:", err);
                }
            }

            // 3. Prompt định hướng cấu trúc thay vì số lượng
            const prompt = `Hãy đóng vai một chuyên gia dinh dưỡng và đầu bếp gia đình Việt Nam. 
Nhiệm vụ của bạn là lên Thực Đơn 1 Ngày (Sáng, Trưa, Tối) phối hợp hài hòa các nguyên liệu đang có sẵn: ${ingredients}.

THỰC ĐƠN PHẢI TUÂN THỦ NGHIÊM NGẶT CẤU TRÚC BỮA ĂN VIỆT NAM:
- Bữa sáng: Ưu tiên nhanh gọn, dễ tiêu, cung cấp năng lượng khởi đầu (ví dụ: bánh mì, phở, bún, xôi, cháo); kèm rau thơm hoặc trái cây nhẹ.
- Bữa trưa: Bữa ăn đầy đủ năng lượng nhất. Cấu trúc mâm cơm bắt buộc hài hòa các nhóm: tinh bột (cơm/bún/miến), 1-2 món mặn đậm đà (thịt/cá kho, rim, xào), 1 món rau (luộc/xào), 1 món canh; có thể thêm trái cây tráng miệng. Các món mặn và nhạt phải hỗ trợ vị cho nhau.
- Bữa tối: Cân bằng, thanh đạm, ít dầu mỡ hơn trưa để dễ ngủ. Thường gồm cơm, 1 món đạm nhẹ nhàng, 1-2 món rau xanh nhiều chất xơ, và món canh.

HỒ SƠ GIA ĐÌNH (BẮT BUỘC TUÂN THỦ VÀ TRÁNH CÁC MÓN DỊ ỨNG):
${familyDetails}

YÊU CẦU QUAN TRỌNG VỀ DỮ LIỆU TRẢ VỀ:
1. Bạn tự quyết định số lượng món ăn sao cho mâm cơm đủ đầy, không gượng ép số lượng.
2. TRONG PHẦN "description" CỦA MỖI MÓN ĂN, bạn BẮT BUỘC phải mở đầu bằng một trong các từ khóa sau để phân loại: [Bữa sáng], [Bữa trưa], hoặc [Bữa tối].`;

            // 4. Gọi hàm AI
            const result = await recipeService.suggestRecipesGenAI(prompt, 'Thực đơn gia đình Việt', user_id);

            // 5. Logic phân nhóm thông minh dựa vào Tag (Description)
            if (result.success && result.recipes && result.recipes.length > 0) {
                const breakfast = [];
                const lunch = [];
                const dinner = [];
                const uncategorized = [];

                result.recipes.forEach(recipe => {
                    const desc = (recipe.description || '').toLowerCase();
                    // Đọc từ khóa AI gắn trong description để đưa vào đúng mảng
                    if (desc.includes('[bữa sáng]') || desc.includes('[sáng]')) {
                        // (Tùy chọn) Xóa cái tag đi để UI nhìn đẹp hơn
                        recipe.description = recipe.description.replace(/\[Bữa sáng\]|\[Sáng\]/gi, '').trim();
                        breakfast.push(recipe);
                    } else if (desc.includes('[bữa trưa]') || desc.includes('[trưa]')) {
                        recipe.description = recipe.description.replace(/\[Bữa trưa\]|\[Trưa\]/gi, '').trim();
                        lunch.push(recipe);
                    } else if (desc.includes('[bữa tối]') || desc.includes('[tối]')) {
                        recipe.description = recipe.description.replace(/\[Bữa tối\]|\[Tối\]/gi, '').trim();
                        dinner.push(recipe);
                    } else {
                        uncategorized.push(recipe);
                    }
                });

                // Fallback: Nếu AI quên gắn tag, ta chia đều danh sách món ăn ra 3 bữa
                if (breakfast.length === 0 && lunch.length === 0 && dinner.length === 0) {
                    const total = result.recipes.length;
                    const third = Math.floor(total / 3);
                    return {
                        success: true,
                        meals: {
                            breakfast: result.recipes.slice(0, third || 1),
                            lunch: result.recipes.slice(third || 1, third * 2 || 2),
                            dinner: result.recipes.slice(third * 2 || 2)
                        }
                    };
                }

                // Ghép các món AI quên gắn tag vào bữa trưa hoặc tối để không bị mất data
                if (uncategorized.length > 0) {
                    const splitIdx = Math.floor(uncategorized.length / 2);
                    lunch.push(...uncategorized.slice(0, splitIdx));
                    dinner.push(...uncategorized.slice(splitIdx));
                }

                return {
                    success: true,
                    meals: { breakfast, lunch, dinner }
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
                body: { ingredients: prompt, style: 'Chi tiết, Chính xác' }
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
                body: { messages: validHistory }
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
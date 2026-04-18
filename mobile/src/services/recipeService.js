import Constants from "expo-constants";
import { cacheService } from './cacheService';
import { supabase } from './supabaseConfig';
import { hybridRecipeService } from './hybrid/HybridRecipeService';
import { recipeStorageService } from './recipeStorageService';

const SYSTEM_INSTRUCTION = `Bạn là Bếp Trưởng AI của ứng dụng "Cơm Nhà". 
Nhiệm vụ của bạn là hỗ trợ người dùng nấu ăn, gợi ý thực đơn, giải thích công thức và tư vấn về dinh dưỡng.
- Hãy trả lời bằng tiếng Việt thân thiện, chuyên nghiệp và truyền cảm hứng nấu nướng.
- Ưu tiên các nguyên liệu và phong cách nấu ăn Việt Nam nhưng cũng sẵn sàng hỗ trợ các món quốc tế.
- TRÌNH BÀY: Sử dụng ngôn ngữ tự nhiên, tránh lạm dụng quá nhiều dấu sao (**) để in đậm. Chỉ in đậm những từ khóa thực sự quan trọng.
- Nếu câu hỏi không liên quan đến ẩm thực, hãy khéo léo dẫn dắt người dùng quay lại chủ đề bếp núc.`;

const ADVANCED_RECIPE_PROMPT_TEMPLATE = `Provide recipe suggestions with rich, detailed visuals.

1. Analyze fridge contents provided by the user and identify all potential ingredients present.

2. Create four distinct recipe suggestions that utilize these identified ingredients. Each recipe suggestion must be comprehensive, including a unique recipe title, a clear and exhaustive list of ingredients, and step-by-step detailed instructions. 
   Format each recipe as a JSON object with: "title", "ingredients" (array), "instructions" (string), and "image_search" (English keyword for the dish).

3. For each recipe suggestion, generate an appetizing, photorealistic image of the final dish (represented by the "image_search" keyword).

4. Return recipe suggestions in a "recipes" array.`;

const formatError = (error) => {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
    console.log("[RecipeService] Error Detailed:", errorMsg);
    if (error?.context) console.log("[RecipeService] Error Context:", JSON.stringify(error.context));

    const message = error.message || String(error);
    const messageLower = message.toLowerCase();

    // 1. ƯU TIÊN 1: Kiểm tra mã HTTP Status (401 = Lỗi Token/Đăng nhập)
    //    Chỉ match các chuỗi rõ ràng liên quan đến xác thực USER, không match lỗi Google Service Account.
    const statusCode = error.status || error?.context?.status;
    if (statusCode === 401 || messageLower.includes("unauthorized") || messageLower.includes("unauthenticated") || messageLower.includes("jwt expired") || messageLower.includes("invalid token")) {
        return "Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để dùng tính năng AI nhé!";
    }

    // 2. ƯU TIÊN 2: Kiểm tra lỗi quá tải/hết lượt
    if (messageLower.includes("resource-exhausted") || messageLower.includes("hết lượt dùng")) {
        return "Bạn đã hết lượt sử dụng AI trong ngày hôm nay. Hãy quay lại vào ngày mai nhé!";
    }

    // 3. ƯU TIÊN 3: Các lỗi server/hàm Edge Function chung chung
    if (messageLower.includes("functionshttperror") || messageLower.includes("non-2xx status code")) {
        return `Máy chủ AI đang bận (${statusCode || 'EF'}). Bạn vui lòng thử lại sau giây lát nhé!`;
    }

    // 4. Lỗi mạng
    if (messageLower.includes("network") || messageLower.includes("failed to fetch") || messageLower.includes("networkerror")) {
        return "Kết nối mạng không ổn định. Bạn vui lòng kiểm tra lại mạng nhé!";
    }

    return `Lỗi AI: ${message.slice(0, 80)}`;
};

const AI_RECIPE_CACHE_PREFIX = 'ai_recipe_';
const AI_RECIPE_TITLE_MAP = 'ai_recipe_title_map';
const DAILY_MEALS_CACHE = 'daily_meals_suggestions';
const DAILY_MEALS_HISTORY = 'daily_meals_history';

// Helper: tính số phút còn lại cho đến hết ngày hôm nay
const minutesUntilEndOfDay = () => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return Math.max(1, Math.round((endOfDay - now) / 60000));
};

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
            const authHeaders = await getAuthHeaders();
            const response = await supabase.functions.invoke('analyzeImageGenAI', {
                body: {
                    imageBase64: base64Image,
                    mimeType: 'image/jpeg'
                },
                headers: authHeaders
            });

            const { data, error } = response;

            if (error) {
                console.error("[RecipeService] Analysis Edge Function Error:", error);
                if (error.status === 401 || (error.context && error.context.status === 401)) {
                    throw new Error("Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để dùng tính năng AI nhé!");
                }
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

    async suggestRecipesGenAI(ingredients, style = 'Truyền thống', user_id = null, customPrompt = null) {
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

            const authHeaders = await getAuthHeaders();
            const response = await supabase.functions.invoke('suggestRecipesGenAI', {
                body: {
                    ingredients,
                    style,
                    familyContext,
                    customPrompt: customPrompt || ADVANCED_RECIPE_PROMPT_TEMPLATE
                },
                headers: authHeaders
            });

            if (!response) {
                throw new Error("Không nhận được phản hồi từ hệ thống AI.");
            }

            const { data, error } = response;

            if (error) {
                console.error("[RecipeService] Edge Function Error:", error);
                if (error.status === 401 || (error.context && error.context.status === 401)) {
                    throw new Error("Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để dùng tính năng AI nhé!");
                }
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
     * @param {string} user_id 
     * @param {string} mode - 'traditional' hoặc 'creative'
     */
    /**
     * Lấy cache gợi ý thực đơn trong ngày (nếu còn hạn)
     */
    async getDailySuggestionsCache() {
        try {
            const cached = await cacheService.get(DAILY_MEALS_CACHE);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                console.log('[RecipeService] Loaded daily suggestions from cache');
                return { success: true, suggestions: cached, fromCache: true };
            }
            return null;
        } catch (error) {
            console.warn('[RecipeService] getDailySuggestionsCache error:', error);
            return null;
        }
    },

    /**
     * Lấy danh sách tên món đã gợi ý trong ngày (dùng để loại trừ khi refresh)
     */
    async getDailyExcludeList() {
        try {
            const history = await cacheService.get(DAILY_MEALS_HISTORY);
            return Array.isArray(history) ? history : [];
        } catch (error) {
            return [];
        }
    },

    /**
     * Tự động gợi ý thực đơn ngày linh hoạt theo cấu trúc mâm cơm gia đình Việt
     * @param {string} user_id 
     * @param {string} mode - 'traditional' hoặc 'creative'
     * @param {string[]} excludeTitles - Danh sách tên món cần loại trừ (khi refresh)
     */
    async suggestDailyMealsAI(user_id, mode = 'traditional', excludeTitles = []) {
        try {
            const { inventoryService } = await import('./inventoryService');
            let systemIngredients = '';
            let prompt = '';

            // Tạo đoạn loại trừ nếu có
            const exclusionClause = excludeTitles.length > 0
                ? `\n\nQUAN TRỌNG - LOẠI TRỪ: TUYỆT ĐỐI KHÔNG gợi ý lại các món sau đây vì đã được gợi ý trước đó: [${excludeTitles.join(', ')}]. Hãy đề xuất các món HOÀN TOÀN KHÁC.`
                : '';

            if (mode === 'creative') {
                // 1. Lấy dữ liệu nguyên liệu trong tủ lạnh
                const inventoryRes = await inventoryService.getItems(user_id);
                systemIngredients = inventoryRes.success && inventoryRes.items.length > 0
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

                prompt = `Hãy đóng vai một chuyên gia dinh dưỡng và đầu bếp gia đình Việt Nam. 
                        Nhiệm vụ của bạn là lên Thực Đơn 1 Ngày SÁNG TẠO (Sáng, Trưa, Tối) dựa trên nguyên liệu hiện có trong tủ lạnh: ${systemIngredients}.
                        Khẩu vị gia đình: ${familyDetails}

                        THỰC ĐƠN PHẢI TUÂN THỦ NGHIÊM NGẶT CẤU TRÚC MÂM CƠM VIỆT NAM:
                        - Bữa sáng: BẮT BUỘC gợi ý các món điểm tâm: Bún, Phở, Miến, Cháo, Xôi, Bánh mì... CHỈ GỢI Ý 1-2 món. Tùy biến linh hoạt nếu tủ lạnh không có đồ phù hợp thì tự đề xuất nguyên liệu ngoài.
                        - Bữa trưa: Bữa đầy đủ năng lượng. BẮT BUỘC có 3-4 món gồm: 1 món Mặn (thịt/cá kho, đạm...), 1 món Canh, 1 món Rau/Xào, và 1 Cơm trắng.
                        - Bữa tối: Thanh đạm, dễ ngủ. BẮT BUỘC không dưới 3 món: 1 món Mặn (nhẹ nhàng), 1 món Canh, 1 món Rau, và 1 Cơm trắng.

                        YÊU CẦU QUAN TRỌNG VỀ DỮ LIỆU TRẢ VỀ:
                        1. SỐ LƯỢNG MÓN: Mỗi bữa chính (Trưa, Tối) BẮT BUỘC có từ 3 đến 4 món riêng biệt. 
                        2. PHẢI TÁCH RIÊNG từng món, KHÔNG gộp chung (Ví dụ: "Cơm cá kho" -> "Cơm trắng", "Cá Kho").
                        3. TRONG PHẦN "description" CỦA MỖI MÓN ĂN, BẮT BUỘC mở đầu bằng từ khóa phân loại: [Bữa sáng], [Bữa trưa], hoặc [Bữa tối].
                        4. Đề xuất thực đơn phong phú. (Mã xáo trộn ngẫu nhiên: ${Date.now()}).${exclusionClause}`;

            } else {
                // TRUYỀN THỐNG MODE — Gợi ý từ kho món truyền thống, ưu tiên theo tủ lạnh
                const allRecipes = hybridRecipeService.getRecipes();
                
                // Loại bỏ các món đã gợi ý trước đó ra khỏi pool
                const filteredRecipes = excludeTitles.length > 0
                    ? allRecipes.filter(r => !excludeTitles.some(ex => r.title.toLowerCase().includes(ex.toLowerCase())))
                    : [...allRecipes];

                // Lấy nguyên liệu tủ lạnh để ưu tiên món phù hợp
                let fridgeIngredients = [];
                let fridgeContext = '';
                try {
                    const inventoryRes = await inventoryService.getItems(user_id);
                    if (inventoryRes.success && inventoryRes.items.length > 0) {
                        fridgeIngredients = inventoryRes.items.map(i => i.item_name.toLowerCase().trim());
                        fridgeContext = `\n\nNGUYÊN LIỆU HIỆN CÓ TRONG TỦ LẠNH: [${inventoryRes.items.map(i => i.item_name).join(', ')}]
                    ƯU TIÊN TUYỆT ĐỐI chọn các món có thể nấu được từ nguyên liệu trên. Nếu không đủ món phù hợp, được phép bổ sung món khác từ danh sách.`;
                    }
                } catch (err) {
                    console.warn('[RecipeService] Could not fetch inventory for traditional mode:', err);
                }

                // Tính điểm match cho mỗi món dựa trên nguyên liệu tủ lạnh
                let selectedTitles;
                if (fridgeIngredients.length > 0) {
                    const scoredRecipes = filteredRecipes.map(recipe => {
                        const recipeIngredients = (recipe.ingredients || []).map(ing => 
                            (typeof ing === 'string' ? ing : '').toLowerCase().trim()
                        );
                        
                        // Đếm số nguyên liệu tủ lạnh khớp với nguyên liệu món ăn
                        let matchScore = 0;
                        fridgeIngredients.forEach(fridgeItem => {
                            const matched = recipeIngredients.some(recipeIng => 
                                recipeIng.includes(fridgeItem) || fridgeItem.includes(recipeIng)
                            );
                            if (matched) matchScore++;
                        });

                        return { ...recipe, matchScore };
                    });

                    // Phân nhóm: món có match > 0 (ưu tiên) và món không match
                    const matchedRecipes = scoredRecipes
                        .filter(r => r.matchScore > 0)
                        .sort((a, b) => b.matchScore - a.matchScore);
                    const unmatchedRecipes = scoredRecipes
                        .filter(r => r.matchScore === 0)
                        .sort(() => 0.5 - Math.random());

                    // Lấy tối đa 50 món match + bổ sung random đến 80
                    const prioritized = matchedRecipes.slice(0, 50);
                    const remaining = unmatchedRecipes.slice(0, 80 - prioritized.length);
                    const combined = [...prioritized, ...remaining];
                    
                    selectedTitles = combined.map(r => r.title).join(', ');
                    console.log(`[RecipeService] Traditional mode: ${matchedRecipes.length} matched, sent ${combined.length} to AI`);
                } else {
                    // Không có dữ liệu tủ lạnh → random như cũ
                    selectedTitles = filteredRecipes
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 80)
                        .map(r => r.title)
                        .join(', ');
                }

                systemIngredients = 'Sử dụng kho món ăn Truyền Thống của Cơm Nhà.';

                prompt = `Hãy đóng vai một chuyên gia dinh dưỡng và đầu bếp gia đình Việt Nam. 
                    Nhiệm vụ của bạn là chọn ra Thực Đơn 1 Ngày CHUẨN MỰC VIỆT NAM (Sáng, Trưa, Tối).
                    ĐIỀU KIỆN KIÊN QUYẾT: Bạn CHỈ ĐƯỢC CHỌN các món ăn TỪ DANH SÁCH SAU ĐÂY:
                    [${selectedTitles}]
                    TUYỆT ĐỐI KHÔNG tự nghĩ ra món nào khác ngoài danh sách trên kể cả món phụ như cơm trắng (trừ khi có trong list). Nhớ linh hoạt gán thêm món Cơm nếu bạn nghĩ hợp lý để đủ 3-4 món mỗi bữa.
                    ${fridgeContext}

                    THỰC ĐƠN PHẢI TUÂN THỦ NGHIÊM NGẶT CẤU TRÚC MÂM CƠM VIỆT NAM:
                    - Bữa sáng: 1-2 món điểm tâm truyền thống.
                    - Bữa trưa: BẮT BUỘC 3-4 món gồm: 1 món Mặn (kho/rim/thịt cá), 1 món Canh, 1 Rau/Xào, (kèm 1 Cơm nếu có).
                    - Bữa tối: BẮT BUỘC 3-4 món gồm: 1 món Mặn (thanh đạm), 1 Canh, 1 Rau, (kèm 1 Cơm nếu có).

                    YÊU CẦU QUAN TRỌNG VỀ DỮ LIỆU:
                    1. SỐ LƯỢNG MÓN: Sáng (1-2 món), Trưa (3-4 món), Tối (3-4 món).
                    2. TÊN MÓN BẮT BUỘC phải khớp 100% với tên trong danh sách đã cấp. Hãy tách riêng từng món.
                    3. TRONG PHẦN "description" CỦA MỖI MÓN ĂN, BẮT BUỘC mở đầu bằng: [Bữa sáng], [Bữa trưa], hoặc [Bữa tối].
                    (Mã xáo trộn ngẫu nhiên: ${Date.now()})${exclusionClause}`;
            }

            // 4. Gọi hàm AI
            const result = await recipeService.suggestRecipesGenAI(systemIngredients, 'Thực đơn gia đình Việt', user_id, prompt);

            // POST PROCESSING CHO TRUYỀN THỐNG (Ánh xạ ID về local repo)
            if (mode === 'traditional' && result.success && result.recipes && result.recipes.length > 0) {
                result.recipes = result.recipes.map(aiRecipe => {
                    const localMatches = hybridRecipeService.search(aiRecipe.title);
                    if (localMatches && localMatches.length > 0) {
                        const localMatched = localMatches[0];
                        return {
                            ...aiRecipe,
                            id: localMatched.id,
                            title: localMatched.title,
                            image: localMatched.image,
                            readyInMinutes: localMatched.readyInMinutes,
                            healthScore: localMatched.healthScore,
                        };
                    }
                    return aiRecipe;
                });
            }

            // 5. Logic xử lý Description: Xóa các Tag của AI để UI sạch sẽ
            if (result.success && result.recipes && result.recipes.length > 0) {
                const cleanRecipes = result.recipes.map(recipe => {
                    if (recipe.description) {
                        recipe.description = recipe.description.replace(/\[Bữa sáng\]|\[Sáng\]|\[Bữa trưa\]|\[Trưa\]|\[Bữa tối\]|\[Tối\]/gi, '').trim();
                    }
                    return recipe;
                });

                // 6. Cache kết quả (TTL = đến hết ngày hôm nay)
                const ttl = minutesUntilEndOfDay();
                await cacheService.set(DAILY_MEALS_CACHE, cleanRecipes, ttl);

                // 7. Append tên món vào history để dùng cho lần refresh tiếp theo
                const newTitles = cleanRecipes.map(r => r.title);
                const existingHistory = await cacheService.get(DAILY_MEALS_HISTORY) || [];
                const updatedHistory = [...new Set([...existingHistory, ...newTitles])];
                await cacheService.set(DAILY_MEALS_HISTORY, updatedHistory, ttl);

                console.log(`[RecipeService] Cached ${cleanRecipes.length} suggestions, history now has ${updatedHistory.length} titles`);

                return {
                    success: true,
                    suggestions: cleanRecipes
                };
            }

            // Nếu result.error đã được formatError rồi (từ suggestRecipesGenAI), trả thẳng về
            return { success: false, error: result.error || "Không thể lấy gợi ý thực đơn." };
        } catch (error) {
            console.error("[RecipeService] suggestDailyMealsAI Error:", error);
            return { success: false, error: formatError(error) };
        }
    },

    async reconstructAIRecipe(title) {
        try {
            const titleLower = title.toLowerCase().trim();
            const titleMap = await cacheService.get(AI_RECIPE_TITLE_MAP) || {};
            const cachedId = titleMap[titleLower];

            if (cachedId) {
                const cachedRecipe = await cacheService.get(AI_RECIPE_CACHE_PREFIX + cachedId);
                if (cachedRecipe) {
                    console.log('[RecipeService] Reconstructed from cache (title):', title);
                    return { success: true, data: cachedRecipe };
                }
            }

            // Fallback 1: Tìm trong persistent storage (vĩnh viễn)
            const persistedRecipe = await recipeStorageService.getRecipeByTitle(title);
            if (persistedRecipe) {
                console.log('[RecipeService] Reconstructed from persistent storage (title):', title);
                return { success: true, data: persistedRecipe };
            }

            // Fallback: Tìm trong MealPlan (có thể dữ liệu gốc nằm ở đó)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: plans } = await supabase
                        .from('mealplans')
                        .select('*')
                        .eq('recipe_title', title)
                        .limit(1);

                    if (plans && plans.length > 0 && plans[0].recipe_data) {
                        console.log('[RecipeService] Reconstructed from MealPlan data:', title);
                        const recipe = plans[0].recipe_data;
                        this.saveAIRecipeToCache(recipe);
                        return { success: true, data: recipe };
                    }
                }
            } catch (pErr) {
                console.warn('[RecipeService] MealPlan fallback check failed:', pErr);
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
            const steps = recipeService.parseInstructions(aiRecipe.instructions);

            // Handle ingredients (could be string or array)
            let rawIngredients = [];
            if (Array.isArray(aiRecipe.ingredients)) {
                rawIngredients = aiRecipe.ingredients;
            } else if (typeof aiRecipe.ingredients === 'string') {
                // Try to split by lines and clean up markers like "-", "*", "1."
                rawIngredients = aiRecipe.ingredients.split('\n').map(i => i.replace(/^[-*•\d.]+\s+/, '').trim()).filter(i => !!i);
            }

            const extendedIngredients = rawIngredients.map((ing, idx) => {
                // Parse quantity from ingredient string (e.g. "200g Thịt heo", "2 muỗng canh Nước mắm", "1/2 thìa Tiêu")
                let amount = 0;
                let unit = '';
                let name = ing;

                // Pattern: number(+fraction) + optional unit + ingredient name
                // Matches: "200g Thịt", "2 muỗng canh Đường", "1/2 thìa cà phê Tiêu", "500ml Nước"
                const quantityMatch = ing.match(/^([\d]+(?:[./][\d]+)?)\s*(g|kg|ml|l|lít|muỗng canh|muỗng cà phê|muỗng|thìa cà phê|thìa canh|thìa|chén|bát|tô|củ|quả|trái|lá|nhánh|cây|miếng|lát|con|bó|gói|hộp|lon|chai|ít|chút|nhúm)?\s*(.+)/i);

                if (quantityMatch) {
                    // Handle fractions like 1/2
                    const numStr = quantityMatch[1];
                    if (numStr.includes('/')) {
                        const parts = numStr.split('/');
                        amount = parseFloat(parts[0]) / parseFloat(parts[1]);
                    } else {
                        amount = parseFloat(numStr);
                    }
                    unit = (quantityMatch[2] || '').trim();
                    name = (quantityMatch[3] || ing).trim();
                }

                return {
                    id: idx,
                    original: ing,
                    originalName: ing,
                    name: name,
                    nameClean: name,
                    amount: amount || 0,
                    unit: unit || ''
                };
            });

            // AI recipes use placeholder image (handled by RecipeImage component)
            const imageUrl = aiRecipe.image || null;

            const transformedRecipe = {
                id: aiRecipe.id || `ai_${aiRecipe.title.toLowerCase().trim().replace(/\s+/g, '_')}`,
                title: aiRecipe.title,
                image: imageUrl,
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

            // Auto-save vào persistent storage (vĩnh viễn)
            recipeStorageService.saveRecipe(transformedRecipe);

            return transformedRecipe;
        } catch (error) {
            console.error("Transform AI Recipe Error:", error);
            return null;
        }
    },

    async getRecipeDetails(id) {
        try {
            // 1. Tìm trong kho món truyền thống (local)
            const localRecipe = hybridRecipeService.getRecipeById(id);
            if (localRecipe) {
                const steps = recipeService.parseInstructions(localRecipe.instructions || '');

                const result = {
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
                };
                // Auto-save vào persistent storage
                recipeStorageService.saveRecipe(result);
                return { success: true, data: result };
            }

            // 2. Tìm trong cache AI (có TTL)
            if (typeof id === 'string' && id.startsWith('ai_')) {
                const cachedAIRecipe = await cacheService.get(AI_RECIPE_CACHE_PREFIX + id);
                if (cachedAIRecipe) {
                    console.log('[RecipeService] Loaded AI recipe from cache:', id);
                    // Auto-save vào persistent storage
                    recipeStorageService.saveRecipe(cachedAIRecipe);
                    return { success: true, data: cachedAIRecipe };
                }
            }

            // 3. FALLBACK: Tìm trong persistent storage (vĩnh viễn, không TTL)
            const persistedRecipe = await recipeStorageService.getRecipe(id);
            if (persistedRecipe) {
                console.log('[RecipeService] Loaded recipe from persistent storage:', id);
                return { success: true, data: persistedRecipe };
            }

            throw new Error("Recipe not found");
        } catch (error) {
            return { success: false, error: formatError(error) };
        }
    },

    /**
     * Get a curated food image URL based on recipe title keywords.
     * Uses direct Unsplash CDN URLs (no redirect) for reliable loading in React Native.
     * If searchKeyword (English) is provided by AI, uses it for dynamic high-accuracy search.
     */
    getFoodImageUrl(title, searchKeyword) {
        // 1. If AI provided a high-quality English keyword, use it with a reliable search service
        if (searchKeyword && searchKeyword.length > 2) {
            const cleanKeyword = searchKeyword.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ',');
            // Using loremflickr as fallback search with English keywords is very accurate
            return `https://loremflickr.com/400/300/${encodeURIComponent(cleanKeyword)},food,vietnamese`;
        }

        const t = title.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');

        // Curated Vietnamese food images from Unsplash (direct CDN URLs)
        const foodImages = {
            pho: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400&h=300&fit=crop',
            bun: 'https://images.unsplash.com/photo-1576577445504-6af96477db52?w=400&h=300&fit=crop',
            com: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&h=300&fit=crop',
            chao: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop',
            ga: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop',
            ca: 'https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?w=400&h=300&fit=crop',
            thit: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=400&h=300&fit=crop',
            canh: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
            rau: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',
            xoi: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop',
            banh: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
            mi: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop',
            tom: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&h=300&fit=crop',
            trung: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop',
            dau: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=300&fit=crop',
            xao: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop',
            kho: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop',
            nuong: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
            lau: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop',
            goi: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop',
            che: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop',
        };

        // Match keywords from title
        for (const [keyword, url] of Object.entries(foodImages)) {
            if (t.includes(keyword)) {
                return url;
            }
        }

        // Fallback: pick from general food images based on title hash
        const fallbackImages = [
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop',
        ];
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = ((hash << 5) - hash) + title.charCodeAt(i);
            hash |= 0;
        }
        return fallbackImages[Math.abs(hash) % fallbackImages.length];
    }
};
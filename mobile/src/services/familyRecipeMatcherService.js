import { familyMemberService } from './familyMemberService';

/**
 * Map of dietary preferences to ingredients they should avoid
 */
const DIETARY_RESTRICTIONS = {
    'Ăn chay': ['thịt', 'cá', 'tôm', 'cua', 'mực', 'sò', 'hến', 'ốc', 'bò', 'heo', 'gà', 'vịt', 'meat', 'fish', 'shrimp', 'chicken', 'pork', 'beef'],
    'Thuần chay': ['thịt', 'cá', 'tôm', 'trứng', 'sữa', 'phô mai', 'bơ', 'kem', 'meat', 'fish', 'egg', 'milk', 'cheese', 'butter', 'cream', 'dairy'],
    'Không gluten': ['bột mì', 'mì', 'bánh mì', 'lúa mạch', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'gluten'],
    'Ít carb': ['cơm', 'gạo', 'mì', 'khoai', 'bánh', 'đường', 'rice', 'noodle', 'potato', 'sugar', 'bread'],
    'Halal': ['thịt heo', 'heo', 'lợn', 'rượu', 'pork', 'ham', 'bacon', 'alcohol', 'wine'],
    'Kosher': ['thịt heo', 'heo', 'tôm', 'cua', 'sò', 'pork', 'shellfish', 'shrimp'],
};

/**
 * Map of health conditions to ingredients they should limit or avoid
 */
const HEALTH_RESTRICTIONS = {
    'Tiểu đường': ['đường', 'mật ong', 'kẹo', 'bánh ngọt', 'sugar', 'candy', 'honey', 'syrup'],
    'Huyết áp cao': ['muối', 'nước mắm', 'xì dầu', 'mì chính', 'salt', 'soy sauce', 'msg'],
    'Dị ứng hải sản': ['tôm', 'cua', 'mực', 'cá', 'sò', 'hến', 'ốc', 'shrimp', 'crab', 'fish', 'seafood', 'shellfish'],
    'Dị ứng đậu phộng': ['đậu phộng', 'lạc', 'bơ đậu phộng', 'peanut', 'groundnut'],
    'Không dung nạp lactose': ['sữa', 'phô mai', 'kem', 'bơ', 'milk', 'cheese', 'cream', 'yogurt', 'dairy'],
    'Dị ứng trứng': ['trứng', 'egg'],
    'Dị ứng đậu nành': ['đậu nành', 'đậu hũ', 'tàu hũ', 'nước tương', 'soy', 'tofu', 'soybean'],
    'Cholesterol cao': ['mỡ', 'nội tạng', 'lòng', 'phủ tạng', 'da gà', 'fat', 'organ', 'liver'],
};

/**
 * Service to calculate recipe compatibility with family dietary needs
 */
export const familyRecipeMatcherService = {
    /**
     * Get all family restrictions as a unified object
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, restrictions?: object, error?: string}>}
     */
    async getFamilyRestrictions(userId) {
        try {
            const result = await familyMemberService.getFamilyMembers(userId);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            const members = result.members || [];

            // Aggregate all restrictions
            const avoidIngredients = new Set();
            const limitIngredients = new Set();
            const dietaryPreferences = new Set();
            const healthConditions = new Set();
            const allergies = [];

            members.forEach(member => {
                // Dietary preferences
                if (member.dietaryPreferences && Array.isArray(member.dietaryPreferences)) {
                    member.dietaryPreferences.forEach(pref => {
                        dietaryPreferences.add(pref);
                        // Add ingredients to avoid based on preference
                        if (DIETARY_RESTRICTIONS[pref]) {
                            DIETARY_RESTRICTIONS[pref].forEach(ing => avoidIngredients.add(ing.toLowerCase()));
                        }
                    });
                }

                // Health conditions
                if (member.healthConditions?.predefined && Array.isArray(member.healthConditions.predefined)) {
                    member.healthConditions.predefined.forEach(cond => {
                        healthConditions.add(cond);
                        // Add ingredients to limit/avoid based on condition
                        if (HEALTH_RESTRICTIONS[cond]) {
                            HEALTH_RESTRICTIONS[cond].forEach(ing => limitIngredients.add(ing.toLowerCase()));
                        }
                    });
                }

                // Custom allergies from notes
                if (member.healthConditions?.notes) {
                    allergies.push({
                        memberName: member.name,
                        notes: member.healthConditions.notes,
                    });
                }
            });

            return {
                success: true,
                restrictions: {
                    avoidIngredients: Array.from(avoidIngredients),
                    limitIngredients: Array.from(limitIngredients),
                    dietaryPreferences: Array.from(dietaryPreferences),
                    healthConditions: Array.from(healthConditions),
                    allergies,
                    memberCount: members.length,
                },
            };
        } catch (error) {
            console.error('Error getting family restrictions:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Calculate family compatibility score for a recipe
     * @param {object} recipe - Recipe object with ingredients
     * @param {object} restrictions - Family restrictions from getFamilyRestrictions
     * @returns {object} - Score and compatibility details
     */
    calculateFamilyScore(recipe, restrictions) {
        if (!restrictions || !recipe) {
            return { score: 100, compatible: true, warnings: [], issues: [] };
        }

        const { avoidIngredients, limitIngredients } = restrictions;
        const recipeIngredients = this.extractRecipeIngredients(recipe);

        let score = 100;
        const warnings = [];
        const issues = [];
        let hasBlockingIssue = false;

        // Check for ingredients to avoid (critical - allergies, dietary restrictions)
        avoidIngredients.forEach(avoid => {
            const found = recipeIngredients.find(ing =>
                ing.toLowerCase().includes(avoid) || avoid.includes(ing.toLowerCase())
            );
            if (found) {
                score -= 30;
                issues.push({
                    type: 'avoid',
                    ingredient: found,
                    reason: `Không phù hợp với sở thích ăn uống của gia đình`,
                });
                hasBlockingIssue = true;
            }
        });

        // Check for ingredients to limit (warning - health conditions)
        limitIngredients.forEach(limit => {
            const found = recipeIngredients.find(ing =>
                ing.toLowerCase().includes(limit) || limit.includes(ing.toLowerCase())
            );
            if (found && !issues.find(i => i.ingredient === found)) {
                score -= 15;
                warnings.push({
                    type: 'limit',
                    ingredient: found,
                    reason: `Cần lưu ý do tình trạng sức khỏe của thành viên`,
                });
            }
        });

        // Ensure score doesn't go below 0
        score = Math.max(0, score);

        return {
            score,
            compatible: score >= 50 && !hasBlockingIssue,
            fullyCompatible: score === 100,
            warnings,
            issues,
            badge: this.getScoreBadge(score, hasBlockingIssue),
        };
    },

    /**
     * Extract ingredient names from a recipe object
     */
    extractRecipeIngredients(recipe) {
        const ingredients = [];

        // Spoonacular format
        if (recipe.extendedIngredients) {
            recipe.extendedIngredients.forEach(ing => {
                if (ing.nameClean) ingredients.push(ing.nameClean);
                if (ing.name) ingredients.push(ing.name);
            });
        }

        // Simple ingredients array
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
            recipe.ingredients.forEach(ing => {
                if (typeof ing === 'string') {
                    ingredients.push(ing);
                } else if (ing.name) {
                    ingredients.push(ing.name);
                }
            });
        }

        // Vietnamese recipe format
        if (recipe.nguyenLieu && Array.isArray(recipe.nguyenLieu)) {
            recipe.nguyenLieu.forEach(ing => {
                if (typeof ing === 'string') {
                    ingredients.push(ing);
                } else if (ing.ten) {
                    ingredients.push(ing.ten);
                }
            });
        }

        return [...new Set(ingredients)]; // Remove duplicates
    },

    /**
     * Get badge info based on score
     */
    getScoreBadge(score, hasBlockingIssue) {
        if (hasBlockingIssue) {
            return {
                type: 'danger',
                label: 'Không phù hợp',
                icon: 'warning',
                color: '#EF4444',
            };
        }
        if (score >= 90) {
            return {
                type: 'success',
                label: 'Phù hợp gia đình',
                icon: 'check-circle',
                color: '#10B981',
            };
        }
        if (score >= 70) {
            return {
                type: 'info',
                label: 'Cần lưu ý',
                icon: 'info',
                color: '#3B82F6',
            };
        }
        if (score >= 50) {
            return {
                type: 'warning',
                label: 'Hạn chế',
                icon: 'warning',
                color: '#F59E0B',
            };
        }
        return {
            type: 'danger',
            label: 'Không khuyến nghị',
            icon: 'error',
            color: '#EF4444',
        };
    },

    /**
     * Enrich recipes with family compatibility info
     * @param {Array} recipes - List of recipes
     * @param {string} userId - User ID
     * @returns {Promise<{success: boolean, recipes?: Array, error?: string}>}
     */
    async enrichRecipesWithFamilyInfo(recipes, userId) {
        try {
            if (!userId) {
                // No user, return recipes as-is
                return { success: true, recipes };
            }

            const restrictionsResult = await this.getFamilyRestrictions(userId);
            if (!restrictionsResult.success) {
                // If we can't get restrictions, return recipes without enrichment
                return { success: true, recipes };
            }

            const { restrictions } = restrictionsResult;

            // If no restrictions set, all recipes are compatible
            if (restrictions.avoidIngredients.length === 0 &&
                restrictions.limitIngredients.length === 0) {
                return {
                    success: true,
                    recipes: recipes.map(r => ({ ...r, familyScore: { score: 100, compatible: true } })),
                };
            }

            // Calculate scores for each recipe
            const enrichedRecipes = recipes.map(recipe => {
                const familyScore = this.calculateFamilyScore(recipe, restrictions);
                return {
                    ...recipe,
                    familyScore,
                };
            });

            // Sort by compatibility (compatible first, then by score)
            enrichedRecipes.sort((a, b) => {
                if (a.familyScore.compatible !== b.familyScore.compatible) {
                    return a.familyScore.compatible ? -1 : 1;
                }
                return b.familyScore.score - a.familyScore.score;
            });

            return { success: true, recipes: enrichedRecipes, restrictions };
        } catch (error) {
            console.error('Error enriching recipes:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Filter recipes to only show compatible ones
     * @param {Array} recipes - List of recipes
     * @param {object} restrictions - Family restrictions
     * @param {object} options - Filter options
     */
    filterCompatibleRecipes(recipes, restrictions, options = {}) {
        const { minScore = 50, showWarnings = true } = options;

        return recipes.filter(recipe => {
            const score = this.calculateFamilyScore(recipe, restrictions);
            if (!showWarnings && score.warnings.length > 0) {
                return false;
            }
            return score.score >= minScore && score.compatible;
        });
    },
};

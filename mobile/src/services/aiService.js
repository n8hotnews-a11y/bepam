import { supabase } from './supabaseConfig';
// Removed Gemini SDK - migrated to Vertex AI


// Cache để tránh gọi API liên tục khi bị rate limit
let rateLimitedUntil = 0;

export const aiService = {
    /**
     * Sử dụng Gemini để sửa lỗi OCR và trích xuất danh sách thực phẩm
     */
    async correctTextWithAI(rawText) {
        if (!rawText || rawText.length < 10) {
            console.log('⚠️ Text too short for AI processing');
            return [];
        }
        return this._callAI({ rawText });
    },

    async extractFromImage(base64Image) {
        if (!base64Image) return [];
        console.log('🖼️ Calling AI Image Extraction...');

        try {
            // Use analyzeImageGenAI for images instead of ocr-correction
            const { data, error } = await supabase.functions.invoke('analyzeImageGenAI', {
                body: {
                    imageBase64: base64Image,
                    mimeType: 'image/jpeg',
                    instructions: '1. Nhận diện thực phẩm. 2. Tên MÓN BẮT BUỘC TIẾNG VIỆT (VD: "Cải thìa" thay vì "Bok choy", "Táo" thay vì "Apple"). 3. category_id CHỈ ĐƯỢC CHỌN TRONG: ["vegetables", "meat", "seafood", "fruits", "dairy", "spices", "others"]. 4. Output JSON Array: [{name: "string", quantity: "string", category_id: "string"}]'
                }
            });

            if (error) {
                console.error("AI Function Error:", error);
                throw error;
            }

            if (!data || !data.success) {
                console.error('❌ AI Analysis Failed:', data?.error);
                return [];
            }

            const items = data.items || [];
            console.log(`✅ AI identified: ${JSON.stringify(items)}`);

            // Normalize data to ensure objects with expected fields
            return items.map(item => {
                let parsedAmount = 1;
                let parsedUnit = 'cái';

                // Parse quantity string if it exists (e.g. "300g" -> 300, "g")
                if (item.quantity) {
                    const qString = String(item.quantity).trim();
                    // Match number followed by optional unit
                    const match = qString.match(/^([\d.]+)\s*(.*)$/);
                    if (match) {
                        parsedAmount = parseFloat(match[1]);
                        if (match[2]) parsedUnit = match[2].trim();
                    } else if (!isNaN(parseFloat(qString))) {
                        parsedAmount = parseFloat(qString);
                    }
                }

                // If the unit comes separately from AI
                if (item.unit) {
                    parsedUnit = item.unit;
                }

                return {
                    name: item.name || item.item_name || 'Thực phẩm',
                    quantity: parsedAmount,
                    unit: parsedUnit,
                    category_id: item.category_id || 'others',
                    expiry_date: item.expiry_date || null
                };
            });

        } catch (error) {
            console.error('❌ AI Image Extraction Error:', error.message);
            return [];
        }
    },

    async _callAI(payload) {
        // Helper for raw text correction only
        const now = Date.now();
        if (now < rateLimitedUntil) {
            console.log(`⏳ Rate limited. Wait...`);
            return [];
        }

        try {
            console.log('🤖 Calling Vertex AI (via Supabase) for OCR Correction...');

            const { data, error } = await supabase.functions.invoke('ocr-correction', {
                body: payload
            });

            if (error) throw error;

            if (data && data.error) {
                console.error('❌ AI Business Error:', data.error);
                return [];
            }

            if (!Array.isArray(data)) {
                return [];
            }

            return data;

        } catch (error) {
            console.error('❌ AI Service Error:', error.message);
            return [];
        }
    },

    /**
     * Kiểm tra xem AI có sẵn sàng không
     */
    isAvailable() {
        return Date.now() >= rateLimitedUntil;
    },

    /**
     * Reset rate limit cache (khi user đổi API key)
     */
    resetRateLimit() {
        rateLimitedUntil = 0;
    }
};

export default aiService;
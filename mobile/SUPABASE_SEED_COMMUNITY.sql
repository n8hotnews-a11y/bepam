-- SEED DATA FOR COMMUNITY FEATURES

-- 1. Insert some Sample Groups
-- Note: Replace residence_id with actual IDs from your database if needed, 
-- but these subqueries will attempt to find them by name.

DO $$
DECLARE
    res_id uuid;
BEGIN
    -- Get some residence IDs
    SELECT id INTO res_id FROM residences WHERE name LIKE '%Vinhomes Riverside%' LIMIT 1;
    
    IF res_id IS NOT NULL THEN
        -- Insert Groups
        INSERT INTO groups (residence_id, name, description, type)
        VALUES 
        (res_id, 'Hội Yêu Bếp Riverside', 'Chia sẻ công thức nấu ăn và đặc sản vùng miền.', 'interest'),
        (res_id, 'Cộng đồng Mua Bán Riverside', 'Nơi trao đổi, mua bán đồ dùng trong cư dân.', 'buy_sell'),
        (res_id, 'Ban Quản Trị Official', 'Thông báo chính thức từ Ban Quản Trị tòa nhà.', 'official');
        
        -- Insert Stores
        INSERT INTO stores (name, address, type, opening_hours)
        VALUES 
        ('VinMart+ Riverside', 'Shophouse B1-02, Vinhomes Riverside', 'supermarket', '{"open": "07:00", "close": "22:00"}'),
        ('Circle K Riverside', 'Shophouse L3-10, Vinhomes Riverside', 'convenience', '{"open": "00:00", "close": "23:59"}');
    END IF;

    SELECT id INTO res_id FROM residences WHERE name LIKE '%Vinhomes Central Park%' LIMIT 1;
    IF res_id IS NOT NULL THEN
        INSERT INTO groups (residence_id, name, description, type)
        VALUES 
        (res_id, 'Cư dân Landmark 81', 'Nhóm giao lưu cho cư dân tòa Landmark 81.', 'interest'),
        (res_id, 'Chợ Đồ Cũ Central Park', 'Thanh lý đồ dùng gia đình giá rẻ.', 'buy_sell');

        INSERT INTO stores (name, address, type, opening_hours)
        VALUES 
        ('Annam Gourmet Central Park', 'Shophouse P6, Vinhomes Central Park', 'supermarket', '{"open": "08:00", "close": "21:00"}'),
        ('GS25 Central Park', 'Shophouse C2, Vinhomes Central Park', 'convenience', '{"open": "06:00", "close": "23:00"}');
    END IF;
END $$;

-- 2. Insert some Sample Listings (Publicly viewable)
-- Note: These need a valid user_id to be visible in 'Món ăn hàng xóm'
-- Replace with an actual user_id from your auth.users table if you want them linked to you.
/*
INSERT INTO community_listings (residence_id, user_id, title, description, price, category, status)
SELECT id, 'YOUR_USER_ID_HERE', 'Bánh chưng mẹ làm', 'Bán giúp mẹ 5 chiếc bánh chưng nếp nương', 50000, 'neighborhood_food', 'active'
FROM residences LIMIT 1;
*/

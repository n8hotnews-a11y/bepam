-- Community / Residency Schema

-- 1. Table for Apartment Complexes / Residences
CREATE TABLE IF NOT EXISTS public.residences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    coordinates JSONB, -- {lat, lng}
    type TEXT DEFAULT 'apartment', -- 'apartment', 'house_complex'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some mock residences for testing
INSERT INTO public.residences (name, address, coordinates)
VALUES 
('Vinhomes Central Park', '208 Nguyễn Hữu Cảnh, Bình Thạnh, HCM', '{"lat": 10.795, "lng": 106.722}'),
('Masteri Thảo Điền', '159 Xa lộ Hà Nội, Quận 2, HCM', '{"lat": 10.798, "lng": 106.752}'),
('Landmark 81', '720A Điện Biên Phủ, Bình Thạnh, HCM', '{"lat": 10.794, "lng": 106.721}'),
('Vinhomes Smart City', 'Tây Mỗ, Nam Từ Liêm, Hà Nội', '{"lat": 21.0025, "lng": 105.7489}'),
('Times City', '458 Minh Khai, Hai Bà Trưng, Hà Nội', '{"lat": 20.995, "lng": 105.867}'),
('Royal City', '72A Nguyễn Trãi, Thanh Xuân, Hà Nội', '{"lat": 21.002, "lng": 105.815}');

-- 2. Update Users table to link to residence
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS residence_id UUID REFERENCES public.residences(id);

-- 3. Community Listings Table
CREATE TABLE IF NOT EXISTS public.community_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    residence_id UUID REFERENCES public.residences(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'sale', 'giveaway', 'deal'
    category TEXT NOT NULL, -- 'neighborhood_food', 'supermarket', 'gift'
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_listings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Everyone can view residences
CREATE POLICY "Public profiles are viewable by everyone" ON public.residences
    FOR SELECT USING (true);

-- Listings are viewable by everyone (or just same residence residents - let's do everyone for now)
CREATE POLICY "Listings are viewable by everyone" ON public.community_listings
    FOR SELECT USING (true);

-- Users can manage their own listings
CREATE POLICY "Users can insert their own listings" ON public.community_listings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings" ON public.community_listings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings" ON public.community_listings
    FOR DELETE USING (auth.uid() = user_id);

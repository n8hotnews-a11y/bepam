import json
import random

categories = {
    "Rau củ": ["Rau", "Cải", "Xà lách", "Cà rốt", "Khoai tây", "Hành tây", "Cà chua", "Bắp cải", "Su hào", "Bầu", "Bí", "Mướp", "Khổ qua"],
    "Trái cây": ["Xoài", "Chuối", "Cam", "Quýt", "Bửi", "Thanh long", "Dưa hấu", "Sầu riêng", "Chôm chôm", "Măng cụt", "Vú sữa", "Ổi", "Mận"],
    "Thịt": ["Thịt heo", "Thịt bò", "Thịt gà", "Thịt vịt", "Thịt ngan", "Thịt cừu", "Thịt dê", "Sườn", "Giò heo", "Chả"],
    "Hải sản": ["Cá thu", "Cá hồi", "Côm", "Mực", "Cua", "Ghẹ", "Nghêu", "Sò", "Ốc", "Hàu", "Cá ngừ", "Cá điêu hồng", "Cá rô phi"],
    "Gia vị": ["Nước mắm", "Muối", "Đường", "Hạt nêm", "Bột ngọt", "Tương ớt", "Xì dầu", "Dầu ăn", "Hạt tiêu", "Tỏi", "Hành tím"],
    "Sữa & Đồ uống": ["Sữa tươi", "Sữa đặc", "Sữa chua", "Nước ngọt", "Bia", "Trà", "Cà phê", "Nước khoáng"],
    "Đồ khô": ["Mì tôm", "Miến", "Bún khô", "Phở khô", "Nấm hương", "Mộc nhĩ", "Tôm khô", "Mực khô"],
    "Bánh & Snacks": ["Bánh mì", "Bánh quy", "Kẹo", "Snack khoai tây", "Bánh bông lan", "Bánh bao"]
}

adjectives = ["tươi", "ngon", "sạch", "hữu cơ", "loại 1", "đặc sản", "nhập khẩu", "VietGAP", "đông lạnh", "sấy khô"]
brands = ["VinEco", "TH True", "Vinamilk", "Masan", "CP", "Acecook", "Knorr", "Maggi", "Ajinomoto"]

food_items = []
id_counter = 1

# Base items from previous cat command
base_items = [
    {"id": 1, "name": "Gạo Tám Xoan", "category": "Gạo", "unit": "kg"},
    {"id": 2, "name": "Gạo Lứt", "category": "Gạo", "unit": "kg"},
    {"id": 3, "name": "Thịt Heo (Ba Chỉ)", "category": "Thịt", "unit": "kg"},
    {"id": 4, "name": "Thịt Heo (Nạc Vai)", "category": "Thịt", "unit": "kg"},
    {"id": 5, "name": "Thịt Bò Thăn", "category": "Thịt", "unit": "kg"},
]
food_items.extend(base_items)
id_counter = 51

while len(food_items) < 5000:
    cat = random.choice(list(categories.keys()))
    main = random.choice(categories[cat])
    adj = random.choice(adjectives)
    brand = random.choice(brands)
    
    # Mix and match to create variety
    name_variants = [
        f"{main} {adj}",
        f"{main} {brand}",
        f"{main} {adj} {brand}",
        f"{brand} - {main} {adj}"
    ]
    name = random.choice(name_variants)
    
    # Avoid exact duplicates
    if any(item['name'] == name for item in food_items):
        continue
        
    unit = "kg"
    if cat in ["Sữa & Đồ uống", "Gia vị"]:
        unit = random.choice(["chai", "hộp", "lon", "gói"])
    elif cat == "Trái cây" or cat == "Rau củ":
        unit = random.choice(["kg", "quả", "trái", "bó"])
    elif cat == "Bánh & Snacks":
        unit = "gói"
        
    food_items.append({
        "id": id_counter,
        "name": name,
        "category": cat,
        "unit": unit
    })
    id_counter += 1

with open("/Users/tristant/Documents/ComNha/mobile/src/data/food-db.json", "w", encoding="utf-8") as f:
    json.dump(food_items, f, ensure_ascii=False, indent=2)

print(f"Generated {len(food_items)} items.")

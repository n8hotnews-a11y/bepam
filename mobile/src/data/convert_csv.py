import csv
import json
import random

csv_path = '/Users/tristant/Documents/ComNha/mobile/src/data/recipes_vietnam.csv'
js_path = '/Users/tristant/Documents/ComNha/mobile/src/data/vietnameseRecipes.js'

type_mapping = {
    'Món Kho': 'kho',
    'Món xào': 'xao',
    'Canh': 'canh',
    'Luộc': 'luoc',
    'Chiên': 'chien',
    'Chiên + Sốt': 'chien',
    'Nướng': 'nuong',
    'Hấp': 'hap',
    'Súp': 'canh',
    'Lẩu': 'lau'
}

recipes = []

try:
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            # Clean ingredients: usually split by comma or new lines
            raw_ing = row.get('Nguyên Liệu Chính', '')
            ingredients = []
            if raw_ing:
                # Remove bullets like '- '
                clean_raw = raw_ing.replace('- ', '').replace('\n', ',')
                parts = [p.strip() for p in clean_raw.split(',')]
                ingredients = [p for p in parts if p]

            # Type
            raw_type = row.get('Loại Món', 'Lẩu')
            type_code = type_mapping.get(raw_type, 'lau')

            # Ready time estimate based on type
            time_map = {
                'kho': 45, 'xao': 20, 'canh': 30, 'luoc': 20, 
                'chien': 30, 'nuong': 45, 'hap': 40, 'lau': 30
            }
            
            # Health score (random 60-90)
            health = random.randint(60, 95)
            if type_code in ['luoc', 'hap', 'canh', 'lau']:
                health += 5
            if type_code in ['chien', 'nuong']:
                health -= 10
            
            # Construct instructions from "Cách Chế Biến"
            instructions = row.get('Cách Chế Biến', '')

            # Image - Placeholder text
            img = f"https://via.placeholder.com/400x300.png?text={row.get('Tên Món', 'Mon An').replace(' ', '+')}"

            recipe = {
                'id': f"vn_{i+1}",
                'title': row.get('Tên Món', ''),
                'image': img,
                'readyInMinutes': time_map.get(type_code, 30),
                'healthScore': max(0, min(100, health)),
                'type': type_code,
                'ingredients': ingredients,
                'instructions': instructions,
                'isLocal': True,
                'cost': row.get('Chi Phí Dự Báo 2026 (VND)', ''),
                'calories': row.get('Calo Ước Tính (cho 1 suất)', '')
            }
            recipes.append(recipe)

    # Write JS file
    js_content = "export const VIETNAMESE_RECIPES = " + json.dumps(recipes, ensure_ascii=False, indent=4) + ";"
    
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully converted {len(recipes)} recipes.")

except Exception as e:
    print(f"Error: {e}")

-- Create table for tracking read status of food warnings
CREATE TABLE food_warnings_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventories(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('expired', 'expiring_soon')),
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, inventory_item_id, warning_type)
);

-- Create index for performance
CREATE INDEX idx_food_warnings_read_user_id ON food_warnings_read(user_id);
CREATE INDEX idx_food_warnings_read_inventory_item_id ON food_warnings_read(inventory_item_id);
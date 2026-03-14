-- Add Evolution API configuration fields to prefeituras
ALTER TABLE public.prefeituras
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT,
ADD COLUMN IF NOT EXISTS evolution_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS evolution_phone TEXT;
-- Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  metadata_url TEXT,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  supply NUMERIC NOT NULL,
  launch_cap NUMERIC NOT NULL,
  current_raised NUMERIC DEFAULT 0,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL, -- 'active', 'completed', 'cancelled'
  contract_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create token_investments table
CREATE TABLE IF NOT EXISTS token_investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES tokens(id) ON DELETE CASCADE NOT NULL,
  investor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  price_at_investment NUMERIC NOT NULL,
  tokens_received NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_investments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Tokens are viewable by everyone" ON tokens
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own tokens" ON tokens
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update their own tokens" ON tokens
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Token investments are viewable by everyone" ON token_investments
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own investments" ON token_investments
  FOR INSERT WITH CHECK (auth.uid() = investor_id);

-- Create trigger to update tokens.updated_at
CREATE OR REPLACE FUNCTION update_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_tokens_updated_at();

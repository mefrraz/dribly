-- Fix user_follows for Clerk auth (v12)
-- Clerk user IDs are strings like "user_3EoExVYqSm..." not UUIDs
-- RLS must use auth.jwt() ->> 'sub' instead of auth.uid()

-- 1. Drop ALL existing policies + constraints on user_follows
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_user_id_fkey;
ALTER TABLE IF EXISTS user_follows DROP CONSTRAINT IF EXISTS user_follows_user_id_fkey1;
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_follows'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_follows', pol.policyname);
    END LOOP;
END $$;

-- 2. Drop unique constraint that depends on user_id
ALTER TABLE user_follows DROP CONSTRAINT IF EXISTS user_follows_user_id_entity_type_entity_id_key;
ALTER TABLE user_follows DROP CONSTRAINT IF EXISTS user_follows_user_id_entity_type_entity_id_idx;

-- 3. Change user_id from UUID to TEXT
ALTER TABLE user_follows ALTER COLUMN user_id TYPE TEXT;

-- 4. Re-create unique constraint with TEXT type
ALTER TABLE user_follows ADD CONSTRAINT user_follows_user_id_entity_type_entity_id_key UNIQUE (user_id, entity_type, entity_id);

-- 5. Re-create RLS policies using Clerk JWT sub
CREATE POLICY "Users read own follows" ON user_follows
    FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users insert own follows" ON user_follows
    FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users delete own follows" ON user_follows
    FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

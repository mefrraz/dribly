-- v12.81: Allow anonymous push subscriptions (user_id nullable)
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE push_subscriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Allow anon inserts (for users without accounts)
DROP POLICY IF EXISTS "Users insert own subscriptions" ON push_subscriptions;
CREATE POLICY "Anyone can insert subscriptions" ON push_subscriptions
    FOR INSERT WITH CHECK (true);

-- Anyone can delete by endpoint (for unsubscribe)
DROP POLICY IF EXISTS "Users delete own subscriptions" ON push_subscriptions;
CREATE POLICY "Anyone can delete subscriptions" ON push_subscriptions
    FOR DELETE USING (true);

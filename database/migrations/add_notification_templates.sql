-- Notification templates for push notifications
CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (service key bypasses this for admin)
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read templates" ON notification_templates FOR SELECT USING (true);

-- Seed default templates
INSERT INTO notification_templates (id, title, body) VALUES
    ('game_starting', '🏀 {equipa_casa} vs {equipa_fora}', 'Começa às {hora} — {competicao}'),
    ('game_win', '✅ Vitória!', '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}'),
    ('game_loss', '❌ Derrota', '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}'),
    ('game_draw', '🤝 Empate', '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}'),
    ('game_result', '📊 Resultado', '{equipa_casa} {resultado_casa} - {resultado_fora} {equipa_fora}')
ON CONFLICT (id) DO NOTHING;

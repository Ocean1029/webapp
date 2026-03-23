CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    input_type TEXT NOT NULL CHECK (input_type IN ('screenshot', 'text')),
    raw_text TEXT NOT NULL,
    image_url TEXT,
    tone_mode TEXT NOT NULL CHECK (tone_mode IN ('counselor', 'bestfriend')),
    interest_score INT NOT NULL CHECK (interest_score BETWEEN 1 AND 10),
    subtext_translation JSONB NOT NULL,
    reply_suggestions JSONB NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

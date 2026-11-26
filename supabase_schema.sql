-- ========================================================
-- SCHEMA SQL PER A SUPABASE: CRM DR. COMERCIAL
-- ========================================================
-- Executa aquest script a l'editor SQL de Supabase (SQL Editor)
-- per crear la taula de distribuïdors amb tots els camps, 
-- contactes, interaccions, documents i el registre d'accessos d'administració.

-- 1. Taula de Distribuïdors / Importadors
CREATE TABLE IF NOT EXISTS distributors (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    legal_name TEXT,
    country TEXT NOT NULL,
    province TEXT,
    region TEXT,
    city TEXT,
    address TEXT,
    website TEXT,
    instagram TEXT,
    tax_id TEXT,
    status TEXT NOT NULL DEFAULT 'Actiu',
    priority TEXT DEFAULT 'Normal',
    distribution_type TEXT DEFAULT 'Importador & Distribuïdor',
    channels TEXT DEFAULT 'HORECA, Retail Especialitzat',
    
    -- Condicions comercials
    incoterm TEXT DEFAULT 'EXW',
    payment_terms TEXT DEFAULT '30 dies',
    currency TEXT DEFAULT 'EUR',
    moq TEXT DEFAULT '1 Palet',
    margin_commission TEXT,
    
    -- Especialització en vins escumosos i de vignerons
    sparkling_focus TEXT,
    annual_volume TEXT,
    related_wineries TEXT,
    
    -- Casajou / Corpinnat
    is_casajou BOOLEAN DEFAULT false,
    casajou_role TEXT,
    specialty_tags JSONB DEFAULT '[]'::jsonb,
    
    notes TEXT
);

-- 2. Taula de Contactes
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    distributor_id TEXT REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    is_primary BOOLEAN DEFAULT false
);

-- 3. Taula d'Interaccions i Tast de Vins
CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    distributor_id TEXT REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    next_step TEXT,
    next_date DATE
);

-- 4. Taula de Documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    distributor_id TEXT REFERENCES distributors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Tarifa',
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER
);

-- 5. Taula d'Auditoria i Registre d'Accessos (Seguretat & Panell Administradors)
CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMPTZ DEFAULT now(),
    timestamp TIMESTAMPTZ DEFAULT now(),
    username TEXT NOT NULL,
    device TEXT,
    status TEXT,
    success BOOLEAN DEFAULT true,
    details TEXT
);

-- Habilitar RLS (Row Level Security) amb accés complet per a la clau anònima (Anon Key)
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Accés total distributors" ON distributors;
CREATE POLICY "Accés total distributors" ON distributors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accés total contacts" ON contacts;
CREATE POLICY "Accés total contacts" ON contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accés total interactions" ON interactions;
CREATE POLICY "Accés total interactions" ON interactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accés total documents" ON documents;
CREATE POLICY "Accés total documents" ON documents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accés total access_logs" ON access_logs;
CREATE POLICY "Accés total access_logs" ON access_logs FOR ALL USING (true) WITH CHECK (true);

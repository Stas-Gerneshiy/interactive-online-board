CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT,
    role VARCHAR(20) DEFAULT 'user',
    blocked BOOLEAN DEFAULT false,
    auth_provider VARCHAR(30) DEFAULT 'local',
    google_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT 'Нова дошка',
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elements (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    x DOUBLE PRECISION DEFAULT 100,
    y DOUBLE PRECISION DEFAULT 100,
    width DOUBLE PRECISION DEFAULT 160,
    height DOUBLE PRECISION DEFAULT 100,
    text TEXT DEFAULT '',
    color VARCHAR(30) DEFAULT 'yellow',
    type VARCHAR(30) DEFAULT 'note',
    rotation DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_element_type CHECK (type IN ('note', 'rect', 'line'))
);

CREATE TABLE IF NOT EXISTS board_shares (
    id SERIAL PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    mode VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_share_mode CHECK (mode IN ('view', 'edit')),
    CONSTRAINT unique_board_share_mode UNIQUE (board_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id
ON boards(user_id);

CREATE INDEX IF NOT EXISTS idx_elements_board_id
ON elements(board_id);

CREATE INDEX IF NOT EXISTS idx_board_shares_token
ON board_shares(token);
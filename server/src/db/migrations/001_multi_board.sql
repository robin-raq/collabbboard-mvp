-- Migration 001: Multi-Board Support
-- Run this in Supabase SQL Editor
-- Adds a boards table for multi-board management

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards(owner_id);

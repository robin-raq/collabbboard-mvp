/**
 * Board CRUD REST Handlers
 *
 * All handlers receive (req, res) and handle auth internally.
 * Team model: all boards visible to all users, only owner can rename/delete.
 */

import http from 'http'
import { authenticateRequest } from '../auth.js'
import { supabase } from '../db/supabase.js'

// ---------------------------------------------------------------------------
// GET /api/boards — List all boards
// ---------------------------------------------------------------------------

export async function handleListBoards(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return
  }

  const { data: boards, error } = await supabase!
    .from('boards')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to fetch boards' }))
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ boards: boards ?? [] }))
}

// ---------------------------------------------------------------------------
// POST /api/boards — Create a new board
// ---------------------------------------------------------------------------

export async function handleCreateBoard(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  body: string,
): Promise<void> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return
  }

  let name = 'Untitled Board'
  try {
    const parsed = JSON.parse(body)
    if (parsed.name && typeof parsed.name === 'string' && parsed.name.trim()) {
      name = parsed.name.trim()
    }
  } catch {
    // Use default name
  }

  const { data: board, error } = await supabase!
    .from('boards')
    .insert({ owner_id: user.userId, name })
    .select('*')
    .single()

  if (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to create board' }))
    return
  }

  res.writeHead(201, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ board }))
}

// ---------------------------------------------------------------------------
// PATCH /api/boards/:id — Rename a board (owner only)
// ---------------------------------------------------------------------------

export async function handleRenameBoard(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  boardId: string,
  body: string,
): Promise<void> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return
  }

  // Check ownership
  const { data: board, error: fetchError } = await supabase!
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .single()

  if (fetchError || !board) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Board not found' }))
    return
  }

  if (board.owner_id !== user.userId) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Only the board owner can rename' }))
    return
  }

  let name: string
  try {
    const parsed = JSON.parse(body)
    name = parsed.name?.trim()
    if (!name) throw new Error('Missing name')
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Name is required' }))
    return
  }

  const { error: updateError } = await supabase!
    .from('boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', boardId)

  if (updateError) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to rename board' }))
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ board: { id: boardId, name } }))
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/:id — Delete a board (owner only)
// ---------------------------------------------------------------------------

export async function handleDeleteBoard(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  boardId: string,
): Promise<void> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Authentication required' }))
    return
  }

  // Check ownership
  const { data: board, error: fetchError } = await supabase!
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .single()

  if (fetchError || !board) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Board not found' }))
    return
  }

  if (board.owner_id !== user.userId) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Only the board owner can delete' }))
    return
  }

  // Delete the snapshot first (not foreign-keyed, uses board_id TEXT)
  await supabase!
    .from('board_snapshots')
    .delete()
    .eq('board_id', boardId)

  // Delete the board
  const { error: deleteError } = await supabase!
    .from('boards')
    .delete()
    .eq('id', boardId)

  if (deleteError) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to delete board' }))
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ success: true }))
}

import { supabase } from '../lib/supabase.js'

export interface CreateBoardInput {
  name: string
  ownerId: string
}

export async function createBoard(input: CreateBoardInput) {
  if (!supabase) throw new Error('Database not configured')

  const { data, error } = await supabase
    .from('boards')
    .insert({
      name: input.name,
      owner_id: input.ownerId,
    })
    .select()
    .single()

  if (error) throw error

  // Add owner as board member
  await supabase
    .from('board_members')
    .insert({
      board_id: data.id,
      user_id: input.ownerId,
      role: 'owner',
    })

  return data
}

export async function listBoardsForUser(userId: string) {
  if (!supabase) throw new Error('Database not configured')

  const { data, error } = await supabase
    .from('board_members')
    .select('board_id, role, boards(id, name, owner_id, invite_code, created_at, updated_at)')
    .eq('user_id', userId)
    .is('boards.deleted_at', null)

  if (error) throw error
  return data
}

export async function getBoard(boardId: string) {
  if (!supabase) throw new Error('Database not configured')

  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .is('deleted_at', null)
    .single()

  if (error) throw error
  return data
}

export async function deleteBoard(boardId: string, userId: string) {
  if (!supabase) throw new Error('Database not configured')

  // Soft delete — only owner can delete
  const { error } = await supabase
    .from('boards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', boardId)
    .eq('owner_id', userId)

  if (error) throw error
}

export async function saveSnapshot(boardId: string, snapshot: Uint8Array) {
  if (!supabase) throw new Error('Database not configured')

  const { error } = await supabase
    .from('board_snapshots')
    .insert({
      board_id: boardId,
      snapshot: Buffer.from(snapshot).toString('base64'),
    })

  if (error) throw error
}

export async function loadLatestSnapshot(boardId: string): Promise<Uint8Array | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('snapshot')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return new Uint8Array(Buffer.from(data.snapshot as string, 'base64'))
}

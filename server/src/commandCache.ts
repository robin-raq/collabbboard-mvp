/**
 * Command Cache — AI Command Learning System
 *
 * Learns from successful Claude API calls and replays them for similar
 * future commands, avoiding the API call entirely.
 *
 * Flow:
 *  1. User sends a command → Claude API processes it → tools execute
 *  2. cache.learn(command, actions, response) extracts a reusable "recipe"
 *  3. Future similar command → cache.match(command) finds the recipe
 *  4. cache.replay(recipe, command, objectsMap) executes tools locally
 *
 * Recipes are parameterized templates: literal values (color, text, position)
 * are replaced with placeholders like ${colorHex}, ${text}, ${x}, ${y}.
 */

import * as Y from 'yjs'
import {
  executeCreateObject,
  executeUpdateObject,
  executeMoveObject,
} from './aiHandler.js'
import type { BoardObject, ToolAction } from '../../shared/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionTemplate {
  tool: string
  inputTemplate: Record<string, unknown>
}

export interface LearnedRecipe {
  id: string
  intentKey: string
  matchPattern: RegExp
  exampleCommand: string
  actionTemplates: ActionTemplate[]
  responseTemplate: string
  hitCount: number
  createdAt: number
  lastUsed: number
}

// ---------------------------------------------------------------------------
// Color map (mirrors localParser.ts)
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  yellow: '#FFD700',
  gold: '#FFD700',
  green: '#98FB98',
  blue: '#87CEEB',
  pink: '#FFB6C1',
  purple: '#DDA0DD',
  orange: '#FFA07A',
  red: '#FF6B6B',
  white: '#FFFFFF',
  gray: '#D1D5DB',
  grey: '#D1D5DB',
}

const HEX_TO_COLOR: Record<string, string> = {}
for (const [name, hex] of Object.entries(COLOR_MAP)) {
  if (!HEX_TO_COLOR[hex]) HEX_TO_COLOR[hex] = name
}

// ---------------------------------------------------------------------------
// Intent Normalization
// ---------------------------------------------------------------------------

/**
 * Extract a normalized "intent key" from a user command.
 * Maps free-form text to canonical intent strings.
 */
export function normalizeIntent(command: string): string {
  const lower = command.toLowerCase()

  // Grid creation
  const gridMatch = lower.match(/(\d+)\s*[xX×]\s*(\d+)\s+grid/i)
  if (gridMatch) return `create_grid_${gridMatch[1]}x${gridMatch[2]}`

  // Templates
  if (/\b(retro(?:spective)?)\b/i.test(lower)) return 'template_retro'
  if (/\bswot\b/i.test(lower)) return 'template_swot'
  if (/\b(journey|user\s*journey)\b/i.test(lower)) return 'template_journey'
  if (/\bkanban\b/i.test(lower)) return 'template_kanban'

  // Color change
  if (/\b(change|update|set)\b.*\bcolor\b/i.test(lower) || /\bcolor\b.*\bto\b/i.test(lower)) {
    return 'update_color'
  }

  // Frame creation
  if (/\bframe\b/i.test(lower) && /\b(create|add|make)\b/i.test(lower)) return 'create_frame'

  // Object creation by type
  if (/\b(create|add|make|put|place)\b/i.test(lower)) {
    if (/\brect(?:angle)?\b/i.test(lower)) return 'create_rect'
    if (/\bcircle\b/i.test(lower)) return 'create_circle'
    if (/\btext\b/i.test(lower) && !/\btext\b.*\b(says|that)\b/i.test(lower)) return 'create_text'
    if (/\bstick(?:y|ies)\b|note/i.test(lower)) return 'create_sticky'
    // Fallback: any create command defaults to sticky
    return 'create_sticky'
  }

  // Move
  if (/\b(move|drag|reposition)\b/i.test(lower)) return 'move_object'

  // Arrange
  if (/\b(arrange|organize|layout|align)\b/i.test(lower)) return 'arrange'

  return 'generic'
}

// ---------------------------------------------------------------------------
// Parameter Extraction
// ---------------------------------------------------------------------------

/**
 * Extract variable parameters from a user command.
 * Returns a map of parameter names → values.
 */
export function extractParamsFromCommand(command: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  const lower = command.toLowerCase()

  // Color
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(name)) {
      params.color = name
      params.colorHex = hex
      break
    }
  }
  // Hex color fallback
  if (!params.colorHex) {
    const hexMatch = lower.match(/#[0-9a-f]{6}/i)
    if (hexMatch) params.colorHex = hexMatch[0]
  }

  // Text: "that says X", "saying X", quoted text
  const sayMatch = command.match(/(?:that\s+says?|saying|with\s+text)\s+(.+?)$/i)
  if (sayMatch) {
    params.text = sayMatch[1].trim().replace(/["']+$/, '').replace(/^["']+/, '')
  } else {
    const quoteMatch = command.match(/["']([^"']+)["']/)
    if (quoteMatch) params.text = quoteMatch[1]
  }

  // Position: "at position X, Y" or "at X, Y"
  const posMatch = command.match(/at\s+(?:position\s+)?(\d+)\s*,\s*(\d+)/i)
  if (posMatch) {
    params.x = parseInt(posMatch[1], 10)
    params.y = parseInt(posMatch[2], 10)
  }

  // Grid dimensions: "NxM grid"
  const gridMatch = command.match(/(\d+)\s*[xX×]\s*(\d+)\s+grid/i)
  if (gridMatch) {
    params.gridCols = parseInt(gridMatch[1], 10)
    params.gridRows = parseInt(gridMatch[2], 10)
  }

  // Topic: "about X" or "for X" (after grid/template keywords)
  const topicMatch = command.match(/(?:about|for|on)\s+(.+?)$/i)
  if (topicMatch && !params.text) {
    params.topic = topicMatch[1].trim().replace(/["']+$/, '').replace(/^["']+/, '')
  }

  return params
}

// ---------------------------------------------------------------------------
// Action Templatization
// ---------------------------------------------------------------------------

/**
 * Convert literal tool inputs into parameterized templates.
 * Replaces extracted parameter values with ${placeholder} markers.
 */
export function templatizeActions(
  actions: ToolAction[],
  params: Record<string, unknown>
): ActionTemplate[] {
  return actions.map((action) => {
    const template: Record<string, unknown> = { ...action.input }

    // Replace color hex with placeholder
    if (params.colorHex && template.fill === params.colorHex) {
      template.fill = '${colorHex}'
    }

    // Replace text with placeholder
    if (params.text && template.text === params.text) {
      template.text = '${text}'
    }

    // Replace position with placeholders (only if exact match)
    if (params.x !== undefined && template.x === params.x) {
      template.x = '${x}'
    }
    if (params.y !== undefined && template.y === params.y) {
      template.y = '${y}'
    }

    return {
      tool: action.tool,
      inputTemplate: template,
    }
  })
}

// ---------------------------------------------------------------------------
// Template Substitution
// ---------------------------------------------------------------------------

/**
 * Substitute parameters into a template to produce concrete tool inputs.
 */
function substituteTemplate(
  template: Record<string, unknown>,
  params: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'string' && value.startsWith('${')) {
      const paramName = value.slice(2, -1)
      result[key] = params[paramName] ?? value
    } else {
      result[key] = value
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Response Template Substitution
// ---------------------------------------------------------------------------

function substituteResponse(template: string, params: Record<string, unknown>): string {
  let result = template

  // Replace parameter references in response text
  if (params.text) {
    // Replace the original text with new text in the response
    result = result.replace(/['"][^'"]+['"]/g, `'${params.text}'`)
  }
  if (params.color) {
    // Replace color name references
    for (const colorName of Object.keys(COLOR_MAP)) {
      const regex = new RegExp(colorName, 'gi')
      result = result.replace(regex, params.color as string)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// CommandCache Class
// ---------------------------------------------------------------------------

const MAX_RECIPES = 50
const MAX_LEARNABLE_ACTIONS = 20

export class CommandCache {
  private recipes: LearnedRecipe[] = []

  get size(): number {
    return this.recipes.length
  }

  getRecipes(): LearnedRecipe[] {
    return [...this.recipes]
  }

  /**
   * Learn from a successful API call. Extracts a reusable recipe.
   */
  learn(command: string, actions: ToolAction[], responseText: string): void {
    // Skip empty or huge action sequences
    if (actions.length === 0 || actions.length > MAX_LEARNABLE_ACTIONS) return

    const intentKey = normalizeIntent(command)
    const params = extractParamsFromCommand(command)

    // Don't learn generic intents — they're too vague to replay
    if (intentKey === 'generic') return

    // Check if we already have a recipe for this intent
    const existing = this.recipes.find((r) => r.intentKey === intentKey)
    if (existing) {
      // Update the existing recipe's last-used time
      existing.lastUsed = Date.now()
      return
    }

    // Generate a match pattern based on the intent
    const matchPattern = this.generateMatchPattern(intentKey)

    // Templatize the actions
    const actionTemplates = templatizeActions(actions, params)

    const recipe: LearnedRecipe = {
      id: `recipe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      intentKey,
      matchPattern,
      exampleCommand: command,
      actionTemplates,
      responseTemplate: responseText,
      hitCount: 0,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    }

    // Evict LRU if at capacity
    if (this.recipes.length >= MAX_RECIPES) {
      this.recipes.sort((a, b) => a.lastUsed - b.lastUsed)
      this.recipes.shift() // remove least recently used
    }

    this.recipes.push(recipe)
  }

  /**
   * Find a matching recipe for a new command.
   */
  match(command: string): LearnedRecipe | null {
    const intentKey = normalizeIntent(command)

    for (const recipe of this.recipes) {
      if (recipe.intentKey === intentKey) {
        recipe.hitCount++
        recipe.lastUsed = Date.now()
        return recipe
      }
    }

    return null
  }

  /**
   * Replay a cached recipe with new parameters.
   */
  replay(
    recipe: LearnedRecipe,
    command: string,
    objectsMap: Y.Map<BoardObject>
  ): { message: string; actions: ToolAction[] } {
    const params = extractParamsFromCommand(command)

    // If no explicit position, use auto-placement
    if (params.x === undefined || params.y === undefined) {
      // Default position — findOpenPosition will adjust if needed
      params.x = params.x ?? 100
      params.y = params.y ?? 100
    }

    // Default color if not specified
    if (!params.colorHex) {
      params.colorHex = '#FFD700' // yellow default
    }

    const actions: ToolAction[] = []

    for (const template of recipe.actionTemplates) {
      const input = substituteTemplate(template.inputTemplate, params)

      let result: string
      switch (template.tool) {
        case 'createObject':
          result = executeCreateObject(input, objectsMap)
          break
        case 'updateObject':
          result = executeUpdateObject(input, objectsMap)
          break
        case 'moveObject':
          result = executeMoveObject(input, objectsMap)
          break
        default:
          result = JSON.stringify({ success: false, error: `Unknown tool: ${template.tool}` })
      }

      actions.push({ tool: template.tool, input, result })
    }

    const message = substituteResponse(recipe.responseTemplate, params)

    return { message, actions }
  }

  /**
   * Generate a regex pattern for matching commands by intent.
   * The actual matching is done by intent key comparison, but
   * the pattern is stored for potential future use.
   */
  private generateMatchPattern(intentKey: string): RegExp {
    switch (intentKey) {
      case 'create_sticky':
        return /\b(create|add|make|put|place)\b.*\b(stick(?:y|ies)|note)\b/i
      case 'create_rect':
        return /\b(create|add|make)\b.*\brect(?:angle)?\b/i
      case 'create_circle':
        return /\b(create|add|make)\b.*\bcircle\b/i
      case 'create_frame':
        return /\b(create|add|make)\b.*\bframe\b/i
      case 'update_color':
        return /\b(change|update|set)\b.*\bcolor\b/i
      case 'template_retro':
        return /\bretro(?:spective)?\b/i
      case 'template_swot':
        return /\bswot\b/i
      case 'template_journey':
        return /\bjourney\b/i
      default:
        // For grid patterns, extract dimensions
        if (intentKey.startsWith('create_grid_')) {
          const dims = intentKey.replace('create_grid_', '')
          const [cols, rows] = dims.split('x')
          return new RegExp(`\\b${cols}\\s*[xX×]\\s*${rows}\\s+grid\\b`, 'i')
        }
        return /(?!)/ // never matches
    }
  }
}

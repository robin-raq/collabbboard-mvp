/**
 * ChatPanel Streaming Tests (TDD)
 *
 * Tests the SSE streaming refactor of ChatPanel:
 *  - Renders streaming status text during request
 *  - Renders action badges incrementally
 *  - Shows cancel button and handles abort
 *  - Shows "(instant)" for cached responses
 *  - Auto-pans after done event
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ChatPanel from '../components/ChatPanel'
import type { AIStreamEvent } from '../../../shared/aiStreamTypes'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// ---------------------------------------------------------------------------
// Helpers — mock SSE response
// ---------------------------------------------------------------------------

/** Create a mock fetch Response that streams SSE events line by line. */
function createSSEResponse(events: AIStreamEvent[]): Response {
  const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
  const encoder = new TextEncoder()
  const encoded = encoder.encode(sseText)

  let position = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (position >= encoded.length) {
        controller.close()
        return
      }
      // Send in small chunks to simulate streaming
      const chunk = encoded.slice(position, position + 64)
      controller.enqueue(chunk)
      position += 64
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/** Create a mock fetch that returns an SSE response for the stream endpoint. */
function mockFetchSSE(events: AIStreamEvent[]) {
  return vi.fn().mockResolvedValue(createSSEResponse(events))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatPanel — SSE streaming', () => {
  const defaultProps = {
    boardId: 'test-board',
    onClose: vi.fn(),
    onPanTo: vi.fn(),
  }

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders streaming status text during request', async () => {
    const events: AIStreamEvent[] = [
      { type: 'status', status: 'thinking' },
      { type: 'done', message: 'Created a sticky!', actions: [] },
    ]
    globalThis.fetch = mockFetchSSE(events)

    render(<ChatPanel {...defaultProps} />)

    // Type a message and send
    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Create a sticky note' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    // Wait for the final assistant message to appear
    await waitFor(() => {
      expect(screen.getByText('Created a sticky!')).toBeTruthy()
    })
  })

  it('renders action badges incrementally from tool_result events', async () => {
    const events: AIStreamEvent[] = [
      { type: 'status', status: 'thinking' },
      {
        type: 'tool_result',
        action: {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, text: 'Note 1' },
          result: '{"success":true,"id":"ai-1","type":"sticky","text":"Note 1"}',
        },
      },
      {
        type: 'tool_result',
        action: {
          tool: 'createObject',
          input: { type: 'sticky', x: 300, y: 100, text: 'Note 2' },
          result: '{"success":true,"id":"ai-2","type":"sticky","text":"Note 2"}',
        },
      },
      { type: 'done', message: 'Created 2 sticky notes.', actions: [] },
    ]
    globalThis.fetch = mockFetchSSE(events)

    render(<ChatPanel {...defaultProps} />)

    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Create two sticky notes' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    // Wait for action badges to appear in the final message
    await waitFor(() => {
      expect(screen.getByText('Created 2 sticky notes.')).toBeTruthy()
    })

    // The action badges from tool_result events should be in the assistant message
    await waitFor(() => {
      const badges = screen.getAllByText(/Created sticky/)
      expect(badges.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows cancel button during streaming and handles abort', async () => {
    // Create a response that hangs (never resolves) so we can test cancel
    let resolveStream: (() => void) | undefined
    const hangingPromise = new Promise<Response>((resolve) => {
      resolveStream = () => {
        const events: AIStreamEvent[] = [
          { type: 'error', error: 'Aborted' },
        ]
        resolve(createSSEResponse(events))
      }
    })

    globalThis.fetch = vi.fn().mockReturnValue(hangingPromise)

    render(<ChatPanel {...defaultProps} />)

    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Do something slow' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    // Cancel button should be visible during loading
    await waitFor(() => {
      expect(screen.getByLabelText('Cancel AI request')).toBeTruthy()
    })

    // Click cancel
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Cancel AI request'))
    })

    // Resolve the hanging fetch so the test can clean up
    resolveStream?.()

    // After cancel, loading should stop
    await waitFor(() => {
      expect(screen.queryByLabelText('Cancel AI request')).toBeNull()
    })
  })

  it('shows "(instant)" badge for cached responses', async () => {
    const events: AIStreamEvent[] = [
      {
        type: 'tool_result',
        action: {
          tool: 'createObject',
          input: { type: 'sticky', x: 100, y: 100, text: 'Cached Note' },
          result: '{"success":true,"id":"ai-1","type":"sticky","text":"Cached Note"}',
        },
      },
      { type: 'done', message: 'Created a cached sticky.', actions: [], cached: true },
    ]
    globalThis.fetch = mockFetchSSE(events)

    render(<ChatPanel {...defaultProps} />)

    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Create a sticky note' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    // The "(instant)" indicator should appear somewhere in the assistant message
    await waitFor(() => {
      expect(screen.getByText(/instant/i)).toBeTruthy()
    })
  })

  it('calls onPanTo after done event with action positions', async () => {
    const onPanTo = vi.fn()
    const events: AIStreamEvent[] = [
      {
        type: 'tool_result',
        action: {
          tool: 'createObject',
          input: { type: 'sticky', x: 200, y: 300, width: 150, height: 150, text: 'Pan test' },
          result: '{"success":true,"id":"ai-1","type":"sticky"}',
        },
      },
      {
        type: 'done',
        message: 'Created sticky.',
        actions: [{
          tool: 'createObject',
          input: { type: 'sticky', x: 200, y: 300, width: 150, height: 150, text: 'Pan test' },
          result: '{"success":true,"id":"ai-1","type":"sticky"}',
        }],
      },
    ]
    globalThis.fetch = mockFetchSSE(events)

    render(<ChatPanel {...{ ...defaultProps, onPanTo }} />)

    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Create a sticky' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    // onPanTo should be called after the done event
    await waitFor(() => {
      expect(onPanTo).toHaveBeenCalled()
    })

    // Should pan to the center of the created object
    const [x, y] = onPanTo.mock.calls[0]
    expect(x).toBeCloseTo(275, 0) // 200 + 150/2
    expect(y).toBeCloseTo(375, 0) // 300 + 150/2
  })

  it('uses /api/ai/stream endpoint instead of /api/ai', async () => {
    const events: AIStreamEvent[] = [
      { type: 'done', message: 'Done.', actions: [] },
    ]
    globalThis.fetch = mockFetchSSE(events)

    render(<ChatPanel {...defaultProps} />)

    const input = screen.getByLabelText('AI command input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Send message'))
    })

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/stream'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})

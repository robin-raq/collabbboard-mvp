import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import { clerkClient } from '@clerk/express'

const WS_PORT = parseInt(process.env.WS_PORT ?? '1234', 10)

interface AuthenticatedSocket extends WebSocket {
  userId?: string
  boardId?: string
}

/**
 * Start the y-websocket compatible WebSocket server.
 * JWT is verified on the upgrade handshake before allowing connection.
 */
export function startWsServer(): void {
  const server = http.createServer()
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', async (request, socket, head) => {
    try {
      // Extract board ID from URL path: /board-abc123
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      const boardId = url.pathname.slice(1) // remove leading /

      if (!boardId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
        socket.destroy()
        return
      }

      // Extract token from query param or header
      const token = url.searchParams.get('token')
        ?? request.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      // Verify JWT with Clerk
      try {
        const client = clerkClient()
        const verified = await client.verifyToken(token)
        const userId = verified.sub

        wss.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedSocket
          authWs.userId = userId
          authWs.boardId = boardId
          wss.emit('connection', authWs, request)
        })
      } catch {
        socket.write('HTTP/1.1 401 Invalid Token\r\n\r\n')
        socket.destroy()
      }
    } catch {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
      socket.destroy()
    }
  })

  // For now, basic echo — y-websocket utils will replace this
  wss.on('connection', (ws: AuthenticatedSocket) => {
    console.log(`WS connected: user=${ws.userId} board=${ws.boardId}`)

    ws.on('close', () => {
      console.log(`WS disconnected: user=${ws.userId} board=${ws.boardId}`)
    })
  })

  server.listen(WS_PORT, () => {
    console.log(`WebSocket server running on port ${WS_PORT}`)
  })
}

import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

const WS_PORT = parseInt(process.env.WS_PORT ?? '1234', 10)

interface AuthenticatedSocket extends WebSocket {
  userId?: string
  boardId?: string
}

/**
 * Start the y-websocket compatible WebSocket server.
 * TODO: Add JWT verification on the upgrade handshake once Clerk is configured.
 */
export function startWsServer(): void {
  const server = http.createServer()
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      const boardId = url.pathname.slice(1) // remove leading /

      if (!boardId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
        socket.destroy()
        return
      }

      // Extract token for future JWT verification
      const token = url.searchParams.get('token')
      // TODO: verify token with Clerk when CLERK_SECRET_KEY is set

      wss.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedSocket
        authWs.userId = token ?? 'anonymous'
        authWs.boardId = boardId
        wss.emit('connection', authWs, request)
      })
    } catch {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
      socket.destroy()
    }
  })

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

import 'dotenv/config'
import app from './app.js'
import { startWsServer } from './ws/server.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

// Start HTTP API server
app.listen(PORT, () => {
  console.log(`HTTP API server running on port ${PORT}`)
})

// Start WebSocket server
startWsServer()

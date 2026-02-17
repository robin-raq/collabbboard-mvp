interface RemoteUser {
  userId: string
  userName: string
  userColor: string
  cursor?: { x: number; y: number }
}

interface PresenceBarProps {
  remoteUsers: RemoteUser[]
  connected: boolean
}

export function PresenceBar({ remoteUsers, connected }: PresenceBarProps) {
  const users = remoteUsers

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-md border border-gray-200">
      {/* Connection status */}
      <div
        className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        title={connected ? 'Connected' : 'Disconnected'}
      />

      {/* User avatars */}
      <div className="flex -space-x-1.5">
        {users.map((user) => (
          <div
            key={user.userId}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
            style={{ backgroundColor: user.userColor }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>

      {users.length > 0 && (
        <span className="text-xs text-gray-500">
          {users.length} online
        </span>
      )}
    </div>
  )
}

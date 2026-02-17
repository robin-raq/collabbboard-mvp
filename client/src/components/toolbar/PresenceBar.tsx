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
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-md border border-gray-200 max-w-xs">
      {/* Connection status */}
      <div
        className={`h-2 w-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        title={connected ? 'Connected' : 'Disconnected'}
      />

      {/* Show online count and user list */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
          {users.length > 0 ? `${users.length} user${users.length !== 1 ? 's' : ''}` : 'You'}
        </span>

        {users.length > 0 && (
          <>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-600 truncate">
              {users.map((u) => u.userName).join(', ')}
            </span>
          </>
        )}
      </div>

      {/* User avatars (for quick visual identification) */}
      {users.length > 0 && (
        <>
          <span className="text-gray-300 ml-1">•</span>
          <div className="flex -space-x-1.5 flex-shrink-0 ml-1">
            {users.slice(0, 3).map((user) => (
              <div
                key={user.userId}
                className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                style={{ backgroundColor: user.userColor }}
                title={user.userName}
              >
                {user.userName.charAt(0).toUpperCase()}
              </div>
            ))}
            {users.length > 3 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gray-400 text-[9px] font-bold text-white">
                +{users.length - 3}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

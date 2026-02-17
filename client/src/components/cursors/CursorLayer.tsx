import { Group, Circle, Text, Rect } from 'react-konva'

interface RemoteUser {
  userId: string
  userName: string
  userColor: string
  cursor?: { x: number; y: number }
}

interface CursorLayerProps {
  remoteUsers: RemoteUser[]
  currentUserCursor?: { x: number; y: number }
  currentUserColor?: string
}

export function CursorLayer({ remoteUsers, currentUserCursor, currentUserColor }: CursorLayerProps) {
  return (
    <Group>
      {/* Render current user's own cursor */}
      {currentUserCursor && currentUserColor && (
        <Group x={currentUserCursor.x} y={currentUserCursor.y}>
          {/* Cursor pointer dot */}
          <Circle
            radius={5}
            fill={currentUserColor}
            stroke="white"
            strokeWidth={2}
          />

          {/* Name label with background */}
          <Group x={12} y={-5}>
            {/* Background rectangle */}
            <Rect
              x={0}
              y={0}
              width={Math.max('You'.length * 7, 50)}
              height={20}
              fill={currentUserColor}
              cornerRadius={3}
              opacity={0.95}
            />
            {/* User name text */}
            <Text
              x={4}
              y={2}
              text="You"
              fontSize={12}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fill="white"
            />
          </Group>
        </Group>
      )}

      {/* Render remote users' cursors */}
      {remoteUsers.map((user) => {
        if (!user.cursor) return null

        return (
          <Group key={user.userId} x={user.cursor.x} y={user.cursor.y}>
            {/* Cursor pointer dot */}
            <Circle
              radius={5}
              fill={user.userColor}
              stroke="white"
              strokeWidth={2}
            />

            {/* Name label with background */}
            <Group x={12} y={-5}>
              {/* Background rectangle */}
              <Rect
                x={0}
                y={0}
                width={Math.max(user.userName.length * 7, 50)}
                height={20}
                fill={user.userColor}
                cornerRadius={3}
                opacity={0.95}
              />
              {/* User name text */}
              <Text
                x={4}
                y={2}
                text={user.userName}
                fontSize={12}
                fontFamily="system-ui, sans-serif"
                fontStyle="bold"
                fill="white"
              />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}

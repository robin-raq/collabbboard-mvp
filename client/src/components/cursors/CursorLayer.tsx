import { Group, Circle, Text } from 'react-konva'

interface RemoteUser {
  userId: string
  userName: string
  userColor: string
  cursor?: { x: number; y: number }
}

interface CursorLayerProps {
  remoteUsers: RemoteUser[]
}

export function CursorLayer({ remoteUsers }: CursorLayerProps) {
  return (
    <Group>
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
            <Group x={12} y={-8}>
              {/* Background rectangle for readability */}
              <Circle
                radius={20}
                fill={user.userColor}
                opacity={0.9}
              />
              {/* User name text */}
              <Text
                x={-8}
                y={-5}
                text={user.userName}
                fontSize={12}
                fontFamily="system-ui, sans-serif"
                fontStyle="bold"
                fill="white"
                align="center"
              />
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}

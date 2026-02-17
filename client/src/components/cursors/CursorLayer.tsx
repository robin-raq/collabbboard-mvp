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
            {/* Cursor dot */}
            <Circle
              radius={4}
              fill={user.userColor}
              stroke="white"
              strokeWidth={1}
            />
            {/* Name label */}
            <Text
              x={8}
              y={-6}
              text={user.userName}
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill="white"
              padding={2}
            />
            {/* Label background */}
            <Group x={6} y={-10}>
              {/* Rendered behind by Konva draw order — simplified for MVP */}
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}

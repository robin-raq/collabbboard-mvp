import { Group, Circle, Text } from 'react-konva'
import type { AwarenessState } from '../../../../shared/types'

interface CursorLayerProps {
  remoteUsers: Map<number, AwarenessState>
}

export function CursorLayer({ remoteUsers }: CursorLayerProps) {
  return (
    <Group>
      {Array.from(remoteUsers.entries()).map(([clientId, state]) => {
        if (!state.cursor) return null

        return (
          <Group key={clientId} x={state.cursor.x} y={state.cursor.y}>
            {/* Cursor dot */}
            <Circle
              radius={4}
              fill={state.userColor}
              stroke="white"
              strokeWidth={1}
            />
            {/* Name label */}
            <Text
              x={8}
              y={-6}
              text={state.userName}
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

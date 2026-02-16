import { useEffect, useState, useCallback, useRef } from 'react'
import type { WebsocketProvider } from 'y-websocket'
import type { AwarenessState } from '../../../shared/types'

interface UseAwarenessReturn {
  remoteUsers: Map<number, AwarenessState>
  updateCursor: (x: number, y: number) => void
}

export function useAwareness(
  provider: WebsocketProvider | null,
  localUser: { userId: string; userName: string; userColor: string } | null
): UseAwarenessReturn {
  const [remoteUsers, setRemoteUsers] = useState<Map<number, AwarenessState>>(new Map())
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!provider || !localUser) return

    const awareness = provider.awareness

    // Set local awareness state
    awareness.setLocalStateField('user', {
      userId: localUser.userId,
      userName: localUser.userName,
      userColor: localUser.userColor,
      cursor: null,
      lastSeen: Date.now(),
    } satisfies AwarenessState)

    // Listen for awareness changes
    const onChange = () => {
      const states = new Map<number, AwarenessState>()
      awareness.getStates().forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.user) {
          states.set(clientId, state.user as AwarenessState)
        }
      })
      setRemoteUsers(states)
    }

    awareness.on('change', onChange)
    onChange()

    return () => {
      awareness.off('change', onChange)
    }
  }, [provider, localUser])

  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!provider || !localUser) return

      // Throttle cursor updates to 50ms
      if (throttleRef.current) return
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null
      }, 50)

      provider.awareness.setLocalStateField('user', {
        userId: localUser.userId,
        userName: localUser.userName,
        userColor: localUser.userColor,
        cursor: { x, y },
        lastSeen: Date.now(),
      } satisfies AwarenessState)
    },
    [provider, localUser]
  )

  return { remoteUsers, updateCursor }
}

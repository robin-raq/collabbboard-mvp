import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace', color: '#d32f2f', background: '#fff3e0', border: '1px solid #ff9800', lineHeight: 1.6 }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#e65100' }}>❌ React Error</h1>
          <p style={{ margin: '5px 0' }}>
            <strong>Error:</strong> {this.state.error?.message}
          </p>
          <pre style={{ margin: '10px 0', fontSize: '12px', overflow: 'auto', background: '#fff', padding: '10px', borderRadius: '4px' }}>
            {this.state.error?.stack}
          </pre>
          <p style={{ margin: '10px 0', fontSize: '12px', color: '#666' }}>
            Check browser console (F12) for more details.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

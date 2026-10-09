import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Catches a crash anywhere on a screen and shows a way back, instead of a blank page.
 * Unsaved visit notes are kept as a draft, so reloading does not lose them.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="page narrow">
        <h1>Something went wrong on this screen</h1>
        <div className="alert">The app hit an error it did not expect. Records already saved are safe.</div>
        <div className="muted">If you were in the middle of a visit, your unsaved notes are kept and will come back when you reopen that visit.</div>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>Reload the app</button>
          <a className="btn" href="/">Go to the patient list</a>
        </div>
        <details className="muted sm">
          <summary>Technical detail to pass on</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
        </details>
      </main>
    )
  }
}

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children?: ReactNode; }
interface State { readonly hasError: boolean; readonly error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--on-surface)' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 16 }}>
            {this.state.error?.message || 'Error inesperado'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '8px 16px', background: 'var(--surface-tint)', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11 }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

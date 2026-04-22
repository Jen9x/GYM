import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, errorInfo } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '880px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
            padding: '28px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Something crashed in the app</h1>
          <p style={{ marginTop: '8px', color: '#4b5563', lineHeight: 1.6 }}>
            The app hit a runtime error. The details below will help us pinpoint the exact problem instead of landing on a blank screen.
          </p>

          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              fontWeight: 600,
              wordBreak: 'break-word',
            }}
          >
            {error.message || String(error)}
          </div>

          {errorInfo?.componentStack && (
            <pre
              style={{
                marginTop: '16px',
                padding: '16px',
                background: '#111827',
                color: '#e5e7eb',
                borderRadius: '12px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              {errorInfo.componentStack}
            </pre>
          )}

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '12px 18px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}

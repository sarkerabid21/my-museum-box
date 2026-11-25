import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          displayMessage = `Data access error (${parsed.operationType} on ${parsed.path ?? 'collection'}): ${parsed.error}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#F7F5F0] text-[#1C1917] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 p-8">
            <p className="text-xs font-mono tracking-wider text-[#8A5A2B] mb-2">
              MY MUSEUM · RECOVERY
            </p>
            <h1 className="text-3xl font-editorial font-semibold text-stone-900 mb-3">
              Something interrupted the gallery
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed mb-6 break-words">
              {displayMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-[#1C1917] text-[#F7F5F0] text-sm font-medium hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Reload Gallery
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TrackPack uncaught error:', error, errorInfo);

    // Auto recover from ChunkLoadError / stale asset caching once automatically
    const isChunkError = 
      error.name === 'ChunkLoadError' || 
      error.message?.includes('Loading chunk') ||
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Unexpected token');

    if (isChunkError && !sessionStorage.getItem('tp_chunk_auto_reloaded')) {
      sessionStorage.setItem('tp_chunk_auto_reloaded', 'true');
      console.log('Auto recovering from stale bundle chunk error...');
      this.handleReset();
    }
  }

  private handleReset = () => {
    // Clear caches and reload to recover from stale chunks or worker locks
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A1F44] text-white p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-white">TrackPack Security & Safety Guard</h2>
          
          <p className="text-gray-300 text-xs sm:text-sm max-w-md mb-2 leading-relaxed">
            Don't panic! Your waybills, receipts, and account data are <strong>100% safe and intact</strong> in our secure cloud database.
          </p>

          <p className="text-gray-400 text-xs max-w-sm mb-6">
            The app encountered a temporary browser cache refresh requirement.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs mb-6">
            <button
              onClick={this.handleReset}
              className="w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0A1F44] font-extrabold text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              🔄 Reload & Refresh App
            </button>

            <button
              onClick={this.handleGoHome}
              className="w-full px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer"
            >
              🏠 Go to Home
            </button>
          </div>

          <div className="pt-4 border-t border-white/10 w-full max-w-md">
            <button
              onClick={() => (this as any).setState({ showDetails: !this.state.showDetails })}
              className="text-[11px] text-gray-400 hover:text-gray-200 underline cursor-pointer"
            >
              {this.state.showDetails ? 'Hide Diagnostics' : 'Show Technical Diagnostics'}
            </button>

            {this.state.showDetails && (
              <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/10 text-left font-mono text-[10px] text-red-300 overflow-x-auto max-h-40">
                <p className="font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
                <p className="mt-1 text-gray-400 text-[9px]">{this.state.error?.stack}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

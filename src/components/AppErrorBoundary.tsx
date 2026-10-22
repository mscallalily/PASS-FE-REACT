import React from 'react';
export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="min-h-screen p-6 flex items-center justify-center"><section role="alert" className="max-w-sm space-y-4"><h1 className="text-xl font-bold">This page could not be loaded</h1><p className="text-sm text-slate-600">Check your connection and reload the page. Your last action may already have been saved.</p><button onClick={() => window.location.reload()} className="bg-blue-600 text-white rounded-xl px-5 py-3">Reload page</button></section></main> : this.props.children;
  }
}

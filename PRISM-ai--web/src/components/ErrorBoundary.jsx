import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ErrorBoundary.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-card">
          <span className="tape tl" />
          <AlertTriangle size={48} />
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. The development team has been notified.</p>
          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <pre>{String(this.state.error)}</pre>
          </details>
          <div className="error-boundary-actions">
            <button onClick={this.handleReset} className="btn btn-primary">Try again</button>
            <a href="/dashboard" className="btn btn-outline">Go to dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

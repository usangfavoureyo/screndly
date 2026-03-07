import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        haptics.medium();
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#000000] p-4 text-center">
                    <div className="bg-red-50 dark:bg-black border border-red-100 dark:border-red-900/30 rounded-2xl p-8 max-w-md w-full shadow-sm">
                        <div className="flex justify-center mb-4">
                            <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-full">
                                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Something went wrong
                        </h2>

                        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
                            The application encountered an unexpected error. We've logged this issue.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-3 bg-gray-100 dark:bg-[#111111] rounded-lg text-left overflow-hidden">
                                <p className="font-mono text-xs text-red-600 break-words">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <Button
                            onClick={this.handleReload}
                            className="w-full bg-[#ec1e24] hover:bg-[#d11b20] text-white rounded-lg gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reload Application
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

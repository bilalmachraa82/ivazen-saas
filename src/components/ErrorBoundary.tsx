import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Detect stale chunk errors (after deploy, old cached JS filenames 404)
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('text/html')
  );
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Auto-recover from stale chunk errors by clearing caches and reloading
    if (isChunkLoadError(error)) {
      const reloadKey = 'chunk-reload-ts';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();

      // Only auto-reload once per 30 seconds to avoid infinite loops
      if (!lastReload || now - Number(lastReload) > 30000) {
        sessionStorage.setItem(reloadKey, String(now));
        // Clear service worker caches then reload
        if ('caches' in window) {
          caches.keys().then(names => {
            Promise.all(names.map(name => caches.delete(name))).then(() => {
              window.location.reload();
            });
          });
        } else {
          window.location.reload();
        }
        return;
      }
    }

    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  private handleReload = () => {
    // Clear caches on manual reload too
    if ('caches' in window) {
      caches.keys().then(names => {
        Promise.all(names.map(name => caches.delete(name))).then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
            </div>
            
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Algo correu mal
            </h1>
            
            <p className="mb-6 text-muted-foreground">
              Pedimos desculpa pelo incómodo. Ocorreu um erro inesperado na aplicação.
            </p>
            
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 rounded-lg bg-muted p-4 text-left">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Detalhes do erro:
                </p>
                <code className="text-xs text-muted-foreground">
                  {this.state.error.message}
                </code>
              </div>
            )}
            
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar Página
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="gap-2">
                <Home className="h-4 w-4" />
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

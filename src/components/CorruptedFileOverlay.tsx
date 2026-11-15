import React from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

interface CorruptedFileOverlayProps {
  filename?: string | null;
  detail?: string | null;
  onRetry?: () => void;
}

export function CorruptedFileOverlay({
  filename,
  detail,
  onRetry,
}: CorruptedFileOverlayProps) {
  return (
    <div
      role="alert"
      data-testid="corrupted-file-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/95 text-red-50 p-8 text-center select-none backdrop-blur-sm"
    >
      <div className="max-w-lg w-full rounded-xl border border-red-500/40 bg-red-900/40 p-8 shadow-2xl space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 border border-red-400/30">
          <ShieldAlert className="h-8 w-8 text-red-300" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white">
          Archivo corrupto o en conflicto. Resuélvelo en tu editor de texto.
        </h2>

        {filename && (
          <p className="text-xs font-mono text-red-200/90 bg-red-950/60 px-3 py-1.5 rounded border border-red-500/30 inline-block">
            {filename}
          </p>
        )}

        {detail && (
          <p className="text-xs text-red-200/80 font-mono break-words bg-black/25 p-3 rounded-md border border-red-500/20">
            {detail}
          </p>
        )}

        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-xs font-semibold text-red-950 hover:bg-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Verificar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ViewErrorBoundaryProps {
  filename?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface ViewErrorBoundaryState {
  error: Error | null;
}

export class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ViewErrorBoundaryProps) {
    if (prevProps.filename !== this.props.filename && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <CorruptedFileOverlay
          filename={this.props.filename}
          detail={this.state.error.message}
          onRetry={() => {
            this.setState({ error: null });
            this.props.onRetry?.();
          }}
        />
      );
    }

    return this.props.children;
  }
}

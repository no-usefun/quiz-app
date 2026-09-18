"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md rounded-[8.8px] bg-white border border-[#d1dee8] p-8 text-center shadow-sm space-y-4 text-left">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#fbeee8] border border-[#d1dee8] text-[#8c381c]">
              <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-[#111111]">
                {this.props.fallbackTitle || "Something went wrong"}
              </h2>
              <p className="text-xs text-[#78716b] leading-relaxed font-medium">
                {this.props.fallbackMessage ||
                  "An unexpected error occurred. Your recorded progress has been safely preserved."}
              </p>
              {this.state.error?.message && (
                <div className="mt-2 rounded bg-[#f5f5f4] p-2 text-[10px] font-mono text-[#78716b] text-left truncate">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh View
              </button>
              <Link
                href="/dashboard/student"
                className="flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#f5f5f4] py-2.5 px-4 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] transition-all border border-[#d1dee8]"
              >
                <Home className="h-3.5 w-3.5 text-[#78716b]" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

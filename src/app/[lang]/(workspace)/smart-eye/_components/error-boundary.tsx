"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/[lang]/(workspace)/smart-eye/_components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/locales";
import { getSmartEyeCopy } from "../_lib/copy";

interface Props { children: ReactNode; lang: Locale; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    const copy = getSmartEyeCopy(this.props.lang).common;
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />{copy.errorTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                {this.state.error?.message || copy.unexpectedError}
              </p>
              <Button onClick={() => this.setState({ hasError: false, error: null })} className="gap-2">
                <RefreshCw className="h-4 w-4" />{copy.retry}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

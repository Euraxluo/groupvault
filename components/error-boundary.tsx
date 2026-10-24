"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[GroupVault] render error", error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950">
            <p className="font-semibold">This screen could not be rendered.</p>
            <p className="mt-2 text-sm text-red-800">
              No transaction was submitted. Retry the view or reload the page.
            </p>
            <Button className="mt-4" variant="outline" onClick={this.reset}>
              Retry
            </Button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

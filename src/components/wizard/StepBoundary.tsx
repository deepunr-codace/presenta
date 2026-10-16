"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { SECONDARY_BTN } from "@/lib/styles";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui-kit/ErrorNotice";

type Props = {
  /** Remounting the boundary (for example with a new step key) clears the error. */
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * Error boundary around the active wizard step. A render error in one step
 * shows an ErrorNotice with Retry instead of a blank column; the stepper and
 * context panel keep working so the user can also move to another step.
 */
export class StepBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console -- surfaced in development only
      console.error("Wizard step failed to render", error, info.componentStack);
    }
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ErrorNotice
        title="This step could not be shown"
        message={error.message || "Something went wrong while rendering this step."}
        actions={
          <Button variant="outline" size="sm" className={SECONDARY_BTN} onClick={this.retry}>
            <ArrowsClockwise data-icon="inline-start" /> Retry
          </Button>
        }
      />
    );
  }
}

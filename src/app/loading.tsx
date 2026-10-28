import { ShellSkeleton } from "@/components/ui-kit/Skeleton";

/** Shown instantly while the next page loads. It has the app's frame, so the sidebar stays put. */
export default function Loading() {
  return <ShellSkeleton />;
}

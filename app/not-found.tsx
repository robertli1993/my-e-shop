import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/summary";

export default function NotFound() {
  return (
    <EmptyState
      icon={<AlertTriangle className="icon" strokeWidth={1.75} aria-hidden="true" />}
      title="That page went offline"
      copy="The link may be old, or the product may no longer be in the catalog."
    >
      <Link className="btn btn-primary" href="/">
        Back to the collection
      </Link>
    </EmptyState>
  );
}

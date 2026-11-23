import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export default function InboxPage() {
  return (
    // useSearchParams (for ?chat=) needs a Suspense boundary
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

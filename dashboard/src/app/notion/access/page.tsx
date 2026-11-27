import { Suspense } from "react";
import NotionAccess from "@/components/NotionAccess";

export default function NotionAccessPage() {
  return (
    <Suspense fallback={null}>
      <NotionAccess />
    </Suspense>
  );
}

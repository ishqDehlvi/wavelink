import { Suspense } from "react";
import NotionPages from "@/components/NotionPages";

export default function NotionPage() {
  return (
    // useSearchParams (for ?page=) needs a Suspense boundary
    <Suspense fallback={null}>
      <NotionPages />
    </Suspense>
  );
}

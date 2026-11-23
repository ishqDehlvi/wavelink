import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container-x flex-1 py-24">
        <p className="eyebrow">404</p>
        <h1 className="font-display mt-3 text-4xl font-bold">Nothing here.</h1>
        <p className="mt-3 max-w-md text-muted">
          The page you asked for does not exist. The documentation index lists everything that does.
        </p>
        <Link href="/docs" className="btn mt-8">
          Open the docs
        </Link>
      </main>
      <Footer />
    </>
  );
}

import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><section>
    <Image src="/paper-logo.webp" width={150} height={150} alt="Throwit paper mascot" priority />
    <h1>Lost in airspace.</h1>
    <p>This Throwit link is invalid or has expired. Return home and create a fresh hotspot link.</p>
    <Link href="/">Back to Throwit</Link>
  </section></main>;
}

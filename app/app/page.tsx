import { Toaster } from "sonner";
import StreamInput from "./components/StreamInput";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center w-full max-w-3xl">
        <StreamInput />
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
}

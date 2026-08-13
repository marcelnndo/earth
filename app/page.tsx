import RotatingEarth from "../components/ui/wireframe-dotted-globe";

export default function DemoOne() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 p-4">
      <RotatingEarth width={800} height={600} />
    </div>
  );
}

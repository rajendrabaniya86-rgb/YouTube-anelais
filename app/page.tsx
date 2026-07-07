import ParkingGame from "@/components/parking-game"

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-6">
      <header className="text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">Parking Challenge</h1>
        <p className="mt-1 text-sm text-muted-foreground">Steer smooth, brake early, park clean.</p>
      </header>
      <ParkingGame />
    </main>
  )
}

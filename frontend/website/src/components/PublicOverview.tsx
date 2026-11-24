import { Link } from "react-router-dom";
import { Button, Card, CardContent } from "@/components/ui/basic";

export function PublicOverview() {
  return (
    <main
      id="public-main"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 pb-16"
    >
      <section className="max-w-3xl space-y-6 py-14 sm:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--ds-text-primary)] sm:text-6xl">
          Your clinic visit and follow-up, in one place
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--ds-text-secondary)]">
          Check in when you arrive at a clinic. At home, use JEEVIKA to view
          linked visits and prescriptions and share a daily check-in.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-12" asChild>
            <Link to="/kiosk">Start clinic check-in</Link>
          </Button>
          <Button variant="outline" className="min-h-12" asChild>
            <Link to="/home/sign-in">Open my patient account</Link>
          </Button>
        </div>
      </section>
      <section
        aria-label="Patient services"
        className="grid gap-3 md:grid-cols-3"
      >
        {[
          [
            "Before your visit",
            "Choose a language, review consent choices and request a queue token at the kiosk.",
          ],
          [
            "After your visit",
            "Find your linked clinic events and prescriptions in your Health Thread.",
          ],
          [
            "Between visits",
            "Record symptoms or a confirmed reading and view changes over time.",
          ],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardContent className="space-y-2 p-5">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="leading-relaxed text-[var(--ds-text-secondary)]">
                {description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

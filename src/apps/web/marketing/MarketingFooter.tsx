import { Wallet, ArrowRight } from "lucide-react"
import { Button } from "@web/components/ui/button"
import type { MarketingPageId } from "./MarketingNav"

type Props = {
  onNavigate?: (page: MarketingPageId) => void
}

export const MarketingFooter = ({ onNavigate }: Props) => {
  return (
    <footer className="border-t bg-card py-14 text-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Call to action card */}
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border bg-background p-8 text-center sm:flex-row sm:text-left">
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold tracking-tight">Ready to pace your spending?</h3>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Join Pacer today — free, private, and zero complexity.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 gap-2 rounded-xl px-6 text-xs font-bold">
            <a href="/api/auth/google">
              Get Started Now <ArrowRight className="size-3.5" />
            </a>
          </Button>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-3.5" />
            </span>
            <span className="font-bold text-foreground">Pacer</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate?.("home")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Calculator
            </button>
            <button
              onClick={() => onNavigate?.("features")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </button>
            <button
              onClick={() => onNavigate?.("why-pacer")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Why Pacer
            </button>
            <button
              onClick={() => onNavigate?.("faq")}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              FAQ
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

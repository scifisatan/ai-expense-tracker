import { Wallet, ArrowRight } from "lucide-react"
import { Button } from "@web/components/ui/button"
import ThemeToggle from "@web/components/ThemeToggle"
import { cn } from "@web/lib/utils"

export type MarketingPageId = "home" | "features" | "why-pacer" | "faq"

type Props = {
  currentPage: MarketingPageId
  onNavigate: (page: MarketingPageId) => void
}

export const MarketingNav = ({ currentPage, onNavigate }: Props) => {
  const NAV_LINKS: { id: MarketingPageId; label: string }[] = [
    { id: "home", label: "Calculator & Home" },
    { id: "features", label: "How It Works" },
    { id: "why-pacer", label: "Why Pacer" },
    { id: "faq", label: "FAQ & Help" }
  ]

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-foreground">Pacer</span>
        </button>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-2 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive = currentPage === link.id
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={cn(
                  "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </button>
            )
          })}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" className="gap-1.5 rounded-xl font-bold">
            <a href="/api/auth/google">
              Get Started <ArrowRight className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex border-t bg-muted/20 px-4 py-2 md:hidden">
        <div className="flex w-full items-center justify-around gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = currentPage === link.id
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}

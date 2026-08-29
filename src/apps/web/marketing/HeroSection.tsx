import { motion } from "framer-motion"
import { ArrowRight, Bot, Lock, Compass, CheckCircle2 } from "lucide-react"
import { Button } from "@web/components/ui/button"
import { InteractiveDemo } from "./InteractiveDemo"

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        {/* Top Feature Pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3.5 py-1 text-xs font-semibold text-muted-foreground"
        >
          <Compass className="size-3.5 text-primary" />
          <span>Intentional Pacing for Modern Humans</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
        >
          Stop tracking 20 categories. <br className="hidden sm:inline" />
          <span className="text-primary">Know your number today.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Pacer locks in your savings off the top, isolates your fixed bills, and gives you
          one guilt-free daily spending number. Spend under it, and the surplus automatically
          funds your wishlist.
        </motion.p>

        {/* Primary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="h-12 w-full gap-2 rounded-2xl px-7 text-sm font-bold sm:w-auto">
            <a href="/api/auth/google">
              Get Started with Google <ArrowRight className="size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-2xl px-7 text-sm font-bold sm:w-auto">
            <a href="#simulator">Try the Live Calculator</a>
          </Button>
        </motion.div>

        {/* Value Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-primary" /> Free & Open
          </span>
          <span className="flex items-center gap-1.5">
            <Bot className="size-4 text-primary" /> Telegram Voice & Text AI
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="size-4 text-primary" /> Private & Zero Ad Tracking
          </span>
        </motion.div>

        {/* Interactive Simulator Section */}
        <motion.div
          id="simulator"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-14"
        >
          <InteractiveDemo />
        </motion.div>
      </div>
    </section>
  )
}

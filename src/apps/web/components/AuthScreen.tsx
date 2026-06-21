import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Globe,
  Lock,
  MessageCircle,
  MoveRight,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web/components/ui/card";
import { Separator } from "@web/components/ui/separator";
import { Footer } from "@web/components/ui/footer";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@web/components/ui/navigation-menu";
import ThemeToggle from "@web/components/ThemeToggle";
import { formatMoney } from "@web/helper";
import { cn } from "@web/lib/utils";

// Fade-and-rise as the element scrolls into view. `once` so it doesn't replay
// on scroll-back; the negative margin triggers it slightly before fully visible.
const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

// Local brand lockup — mirrors the Dashboard header without sharing a component,
// so the landing and the app feel like the same product.
const Brand = () => (
  <div className="flex items-center gap-2">
    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <Wallet className="size-4" />
    </span>
    <span className="text-base font-semibold tracking-tight">Budget</span>
  </div>
);

const NAV_LINKS = [
  { href: "#preview", label: "Preview" },
  { href: "#features", label: "Features" },
];

const Nav = () => (
  <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
      <Brand />
      <NavigationMenu className="hidden sm:flex">
        <NavigationMenuList>
          {NAV_LINKS.map((link) => (
            <NavigationMenuItem key={link.href}>
              <NavigationMenuLink
                href={link.href}
                className={navigationMenuTriggerStyle()}
              >
                {link.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        {/* Server-side OAuth redirect — must stay a plain link, not a tRPC call. */}
        <Button asChild size="sm">
          <a href="/api/auth/google">Sign in</a>
        </Button>
      </div>
    </div>
  </header>
);

type Feature = {
  icon: typeof Sparkles;
  title: string;
  body: string;
};

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "Type it like you'd say it",
    body: "“Lunch 12” or “Got paid 2400” — we read it and file it for you.",
  },
  {
    icon: MessageCircle,
    title: "Capture from Telegram",
    body: "Add on the go from chat. Everything stays in sync with the web.",
  },
  {
    icon: Lock,
    title: "Yours, private by default",
    body: "No setup, no API keys. Your money stays yours, not a product.",
  },
];

const FeatureCard = ({ icon: Icon, title, body }: Feature) => (
  <Card className="h-full">
    <CardHeader>
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4.5" />
      </span>
      <CardTitle className="mt-3 text-base">{title}</CardTitle>
      <CardDescription>{body}</CardDescription>
    </CardHeader>
  </Card>
);

// A purely presentational mock of the feed — no data fetching on a pre-auth route.
const PreviewRow = ({
  label,
  meta,
  amountMinor,
  income = false,
}: {
  label: string;
  meta: string;
  amountMinor: number;
  income?: boolean;
}) => (
  <div className="flex items-center gap-3">
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        income
          ? "bg-income-muted text-income"
          : "bg-expense-muted text-expense",
      )}
    >
      {income ? (
        <ArrowDownRight className="size-4" />
      ) : (
        <ArrowUpRight className="size-4" />
      )}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{label}</p>
      <p className="truncate text-xs text-muted-foreground">{meta}</p>
    </div>
    <span
      className={cn(
        "tabular text-sm font-semibold",
        income ? "text-income" : "text-foreground",
      )}
    >
      {income ? "+" : "−"}
      {formatMoney(amountMinor, "USD")}
    </span>
  </div>
);

const Preview = () => (
  <Card className="relative overflow-hidden">
    <CardContent className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Current balance
        </p>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
          {formatMoney(184_250, "USD")}
        </p>
      </div>
      <Separator />
      <div className="space-y-3">
        <PreviewRow label="Coffee" meta="Today · Food" amountMinor={450} />
        <PreviewRow
          label="Paycheck"
          meta="Yesterday · Income"
          amountMinor={240_000}
          income
        />
      </div>
    </CardContent>
  </Card>
);

const Hero = () => {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => [
      "effortless",
      "private",
      "in plain words",
      "always in sync",
      "yours",
    ],
    [],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((n) => (n === titles.length - 1 ? 0 : n + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <section
      id="preview"
      className="grid scroll-mt-20 items-center gap-10 py-12 sm:py-20 lg:grid-cols-2 lg:gap-12"
    >
      {/* Hero copy */}
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <Badge variant="secondary">Money, in plain words</Badge>
        <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          <span>Money tracking that's</span>
          <span className="relative flex w-full justify-center overflow-hidden pt-1 pb-2 lg:justify-start">
            &nbsp;
            {titles.map((title, index) => (
              <motion.span
                key={index}
                className="absolute font-semibold text-primary"
                initial={{ opacity: 0, y: -100 }}
                transition={{ type: "spring", stiffness: 50 }}
                animate={
                  titleNumber === index
                    ? { y: 0, opacity: 1 }
                    : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                }
              >
                {title}
              </motion.span>
            ))}
          </span>
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground text-balance sm:text-lg">
          Log spending on the web or from Telegram in plain language — calm,
          private, and always in sync.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
          {/* Server-side OAuth redirect — must stay a plain link, not a tRPC call. */}
          <Button asChild size="lg" className="gap-2">
            <a href="/api/auth/google">
              Continue with Google <MoveRight className="size-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <a href="#features">See features</a>
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Free. No card. Connect Telegram later.
        </p>
      </div>

      <motion.div
        className="relative mx-auto w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-primary/15 blur-3xl"
        />
        <p className="mb-3 text-center text-sm font-medium text-muted-foreground lg:text-left">
          This is what you'll see
        </p>
        <Preview />
      </motion.div>
    </section>
  );
};

const Features = () => (
  <section id="features" className="scroll-mt-20 py-12 sm:py-16">
    <Reveal className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Everything you need, nothing you don't
      </h2>
      <p className="mt-3 text-muted-foreground">
        Built to get out of your way — add money in seconds, from anywhere.
      </p>
    </Reveal>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {features.map((f, i) => (
        <Reveal key={f.title} delay={i * 0.12} className="h-full">
          <FeatureCard {...f} />
        </Reveal>
      ))}
    </div>
  </section>
);

const AuthScreen = () => {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* warm ambient glow — borrowed from BalanceHero so the page feels in-app */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <Nav />

      <main className="relative mx-auto max-w-5xl px-4">
        <Hero />
        <Features />
      </main>

      <Reveal className="relative mx-auto max-w-5xl px-4">
        <Footer
          logo={
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
          }
          brandName="Budget"
          socialLinks={[
            {
              icon: <Send className="h-5 w-5" />,
              href: "https://t.me",
              label: "Telegram",
            },
            {
              icon: <Globe className="h-5 w-5" />,
              href: "https://github.com",
              label: "GitHub",
            },
          ]}
          mainLinks={[
            { href: "#preview", label: "Preview" },
            { href: "#features", label: "Features" },
            { href: "/api/auth/google", label: "Sign in" },
          ]}
          legalLinks={[
            { href: "#", label: "Privacy" },
            { href: "#", label: "Terms" },
          ]}
          copyright={{
            text: `© ${new Date().getFullYear()} Budget`,
            license: "Web and Telegram, always in sync.",
          }}
        />
      </Reveal>
    </div>
  );
};

export default AuthScreen;

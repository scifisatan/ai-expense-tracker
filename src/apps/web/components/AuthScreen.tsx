import { Wallet, MessageCircle } from "lucide-react"

import { Button } from "@web/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@web/components/ui/card"
import ThemeToggle from "@web/components/ThemeToggle"

const AuthScreen = () => {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-6" />
          </div>
          <CardTitle className="mt-4 text-xl">Welcome to Budget</CardTitle>
          <CardDescription>
            Track your spending on the web and through Telegram — calm,
            private, and always in sync.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Server-side OAuth redirect — must stay a plain link, not a tRPC call. */}
          <Button asChild size="lg" className="w-full">
            <a href="/api/auth/google">Sign in with Google</a>
          </Button>
        </CardContent>

        <CardFooter>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              After signing in, connect Telegram from Settings to add
              transactions in natural language.
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default AuthScreen

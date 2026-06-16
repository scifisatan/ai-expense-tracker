import { createRoot } from "react-dom/client"
import App from "@web/App"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { trpc } from "@web/trpc"
import { httpBatchLink } from "@trpc/client"
import { Toaster } from "@web/components/ui/sonner"
import { TooltipProvider } from "@web/components/ui/tooltip"

const queryClient = new QueryClient()
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api"
    })
  ]
})

const domNode = document.getElementById("root")!
createRoot(domNode).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </trpc.Provider>
)

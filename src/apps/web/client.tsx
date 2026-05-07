import { createRoot } from "react-dom/client"
import App from "@web/App"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { trpc } from "@web/trpc"
import { httpBatchLink } from "@trpc/client"

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
      <App />
    </QueryClientProvider>
  </trpc.Provider>
)

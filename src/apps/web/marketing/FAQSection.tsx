import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@web/lib/utils"

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const FAQS = [
    {
      q: "How is Pacer different from Mint, YNAB, or normal budget apps?",
      a: "Traditional apps demand hours of categorizing past expenses into dozens of buckets, causing guilt and burnout. Pacer is forward-looking: it pays your savings and bills first, then tells you the exact amount you can spend today without worrying."
    },
    {
      q: "How does the Telegram bot work?",
      a: "You link your Telegram account via a 6-digit code in Settings. Once linked, you can text 'Lunch 15' or send a voice message directly to the bot. It parses the details and updates your dashboard instantly."
    },
    {
      q: "What is the difference between the Want Fund and Needs Reserve?",
      a: "The Want Fund is funded organically from your daily discipline — every time you spend under your daily allowance, the leftover surplus sweeps into this fund so you can buy wishlist rewards guilt-free. The Needs Reserve is an off-the-top safety cushion allocated when you set up your cycle for mandatory essentials like emergency repairs or medical bills."
    },
    {
      q: "What happens if I overspend on a certain day?",
      a: "Pacer doesn't fail your budget or penalize you with alerts. It dynamically amortizes the deficit across the remaining days of your cycle, so tomorrow's number adjusts slightly to keep you perfectly on track."
    },
    {
      q: "Is my financial data private and secure?",
      a: "Yes. Pacer does not sell data or run advertisements. Authentication uses industry-standard Google OAuth, and all database records are strictly isolated to your account."
    },
    {
      q: "Can I use Nepalese Rupee (NPR) or other currencies?",
      a: "Yes! Pacer supports multi-currency formatting including NPR (Rs.), USD ($), EUR (€), GBP (£), JPY (¥), and many more."
    }
  ]

  return (
    <section id="faq" className="border-t bg-muted/10 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Got Questions?</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border bg-card transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-4 text-left font-bold text-foreground sm:p-5"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180 text-primary"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="border-t px-4 pt-3 pb-4 text-xs leading-relaxed text-muted-foreground sm:px-5 sm:text-sm">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

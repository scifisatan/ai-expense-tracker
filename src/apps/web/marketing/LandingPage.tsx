import { useEffect, useState } from "react"
import { MarketingNav, type MarketingPageId } from "./MarketingNav"
import { HeroSection } from "./HeroSection"
import { ComparisonSection } from "./ComparisonSection"
import { FeaturesSection } from "./FeaturesSection"
import { FAQSection } from "./FAQSection"
import { MarketingFooter } from "./MarketingFooter"

export const LandingPage = () => {
  const [currentPage, setCurrentPage] = useState<MarketingPageId>(() => {
    const hash = window.location.hash.replace("#", "")
    if (hash === "features" || hash === "why-pacer" || hash === "faq") {
      return hash as MarketingPageId
    }
    return "home"
  })

  const handleNavigate = (page: MarketingPageId) => {
    setCurrentPage(page)
    window.location.hash = page === "home" ? "" : page
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Listen to hash change from browser forward/back buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "")
      if (hash === "features" || hash === "why-pacer" || hash === "faq") {
        setCurrentPage(hash as MarketingPageId)
      } else {
        setCurrentPage("home")
      }
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingNav currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="transition-opacity duration-200">
        {currentPage === "home" && <HeroSection />}
        {currentPage === "features" && <FeaturesSection />}
        {currentPage === "why-pacer" && <ComparisonSection />}
        {currentPage === "faq" && <FAQSection />}
      </main>
      <MarketingFooter onNavigate={handleNavigate} />
    </div>
  )
}

export default LandingPage

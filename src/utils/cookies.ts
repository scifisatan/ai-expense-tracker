export const getCookie = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(";")

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=")
    if (key === name) {
      return valueParts.join("=") || null
    }
  }

  return null
}

import { GoogleGenAI } from "@google/genai"

const keyFromArg = process.argv[2]?.trim()
const apiKey = keyFromArg || process.env.GEMINI_API_KEY?.trim()
const model = process.env.QUERYLENS_GEMINI_MODEL?.trim() || "gemini-2.5-flash"

function mask(value: string) {
  if (value.length <= 10) return "*".repeat(value.length)
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

async function main() {
  if (!apiKey) {
    console.error("Missing API key. Pass it as argument or set GEMINI_API_KEY.")
    process.exit(1)
  }

  const client = new GoogleGenAI({ apiKey })

  try {
    const response = await client.models.generateContent({
      model,
      contents: "Reply with exactly: OK",
      config: {
        temperature: 0,
      },
    })

    console.log(`Gemini key check: PASS (${mask(apiKey)})`)
    console.log(`Model: ${model}`)
    console.log(`Response: ${(response.text || "").trim() || "<empty>"}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Gemini key check: FAIL (${mask(apiKey)})`)
    console.error(`Model: ${model}`)
    console.error(`Error: ${message}`)
    process.exit(2)
  }
}

main()

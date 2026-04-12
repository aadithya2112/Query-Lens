import { renderToStaticMarkup } from "react-dom/server"

import ExplorerPage from "@/app/explorer/page"

describe("/explorer page", () => {
  it("renders the source context experience", async () => {
    const element = await ExplorerPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Source context")
    expect(html).toContain("Connected sources")
    expect(html).toContain("PostgreSQL preview")
    expect(html).toContain("MongoDB preview")
  })
})

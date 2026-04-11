import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import ExplorerPage from "@/app/explorer/page"

describe("/explorer page", () => {
  it("renders the explorer shell with the unified browser and workbench", () => {
    const html = renderToStaticMarkup(React.createElement(ExplorerPage))

    expect(html).toContain("Database explorer")
    expect(html).toContain("Unified source browser")
    expect(html).toContain("Relational editor")
    expect(html).toContain("public / customers")
  })
})

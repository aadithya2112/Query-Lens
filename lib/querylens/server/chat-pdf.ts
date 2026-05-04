import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import type { ChartSpec } from "@/lib/querylens/types"

export interface ChatPdfMessage {
  role: "user" | "assistant"
  text: string
  createdAt?: number
  chartTitle?: string
  chartSpec?: ChartSpec
}

interface BuildChatTranscriptPdfArgs {
  title: string
  datasetId?: string
  generatedAt: Date
  messages: ChatPdfMessage[]
}

const PAGE_MARGIN = 48
const BODY_SIZE = 11
const LINE_HEIGHT = 15

const THEME = {
  primary: rgb(0.35, 0.16, 0.49),
  primaryDark: rgb(0.23, 0.09, 0.33),
  panel: rgb(0.97, 0.94, 1),
  panelBorder: rgb(0.84, 0.76, 0.95),
  text: rgb(0.12, 0.09, 0.19),
  mutedText: rgb(0.39, 0.35, 0.5),
  userBadge: rgb(0.45, 0.3, 0.61),
  assistantBadge: rgb(0.3, 0.19, 0.44),
  chartFrame: rgb(0.9, 0.85, 0.96),
  chartGrid: rgb(0.86, 0.8, 0.94),
  chartA: rgb(0.35, 0.16, 0.49),
  chartB: rgb(0.48, 0.28, 0.66),
  chartC: rgb(0.66, 0.47, 0.82),
  chartD: rgb(0.78, 0.63, 0.9),
  pageBg: rgb(0.985, 0.975, 1),
  pageBorder: rgb(0.88, 0.82, 0.95),
}

type NumericPoint = {
  label: string
  value: number
}

function drawRoundedFill(args: {
  page: PDFPage
  x: number
  y: number
  width: number
  height: number
  radius: number
  color: ReturnType<typeof rgb>
}) {
  const radius = Math.max(0, Math.min(args.radius, args.width / 2, args.height / 2))
  const innerWidth = Math.max(0, args.width - radius * 2)
  const innerHeight = Math.max(0, args.height - radius * 2)

  args.page.drawRectangle({
    x: args.x + radius,
    y: args.y,
    width: innerWidth,
    height: args.height,
    color: args.color,
  })
  args.page.drawRectangle({
    x: args.x,
    y: args.y + radius,
    width: args.width,
    height: innerHeight,
    color: args.color,
  })

  args.page.drawCircle({
    x: args.x + radius,
    y: args.y + radius,
    size: radius,
    color: args.color,
  })
  args.page.drawCircle({
    x: args.x + args.width - radius,
    y: args.y + radius,
    size: radius,
    color: args.color,
  })
  args.page.drawCircle({
    x: args.x + radius,
    y: args.y + args.height - radius,
    size: radius,
    color: args.color,
  })
  args.page.drawCircle({
    x: args.x + args.width - radius,
    y: args.y + args.height - radius,
    size: radius,
    color: args.color,
  })
}

function drawRoundedRect(args: {
  page: PDFPage
  x: number
  y: number
  width: number
  height: number
  radius: number
  color: ReturnType<typeof rgb>
  borderColor?: ReturnType<typeof rgb>
  borderWidth?: number
}) {
  const borderWidth = args.borderColor && args.borderWidth ? args.borderWidth : 0

  if (borderWidth > 0) {
    drawRoundedFill({
      page: args.page,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      radius: args.radius,
      color: args.borderColor!,
    })
    drawRoundedFill({
      page: args.page,
      x: args.x + borderWidth,
      y: args.y + borderWidth,
      width: args.width - borderWidth * 2,
      height: args.height - borderWidth * 2,
      radius: Math.max(0, args.radius - borderWidth),
      color: args.color,
    })
    return
  }

  drawRoundedFill({
    page: args.page,
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    radius: args.radius,
    color: args.color,
  })
}

function drawPageTheme(page: PDFPage) {
  const width = page.getWidth()
  const height = page.getHeight()

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: THEME.pageBg,
  })

  drawRoundedRect({
    page,
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    radius: 20,
    color: rgb(1, 1, 1),
    borderColor: THEME.pageBorder,
    borderWidth: 1.2,
  })
}

function wrapText(args: {
  text: string
  maxWidth: number
  measure: (text: string, size: number) => number
  size: number
}): string[] {
  const normalized = args.text.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return [""]
  }

  const words = normalized.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (args.measure(nextLine, args.size) <= args.maxWidth) {
      currentLine = nextLine
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function toNumericPoints(chartSpec: ChartSpec): NumericPoint[] {
  if (chartSpec.type === "pie") {
    return chartSpec.data
      .map((datum) => {
        const label = datum[chartSpec.labelKey]
        const value = datum[chartSpec.valueKey]
        return typeof label === "string" && typeof value === "number"
          ? { label, value }
          : null
      })
      .filter((point): point is NumericPoint => point !== null)
      .slice(0, 8)
  }

  return chartSpec.data
    .map((datum) => {
      const label = datum[chartSpec.xKey]
      const value = datum[chartSpec.yKey]
      return typeof label === "string" && typeof value === "number"
        ? { label, value }
        : null
    })
    .filter((point): point is NumericPoint => point !== null)
    .slice(0, 12)
}

function drawChartShell(args: {
  page: PDFPage
  x: number
  y: number
  width: number
  height: number
  title: string
  font: PDFFont
  monoFont: PDFFont
}): { plotX: number; plotY: number; plotWidth: number; plotHeight: number } {
  const { page, x, y, width, height, title, font, monoFont } = args
  drawRoundedRect({
    page,
    x,
    y: y - height,
    width,
    height,
    radius: 10,
    color: rgb(1, 1, 1),
    borderColor: THEME.chartFrame,
    borderWidth: 1,
  })
  page.drawRectangle({
    x,
    y: y - 24,
    width,
    height: 24,
    color: rgb(0.96, 0.92, 1),
  })
  page.drawText(title.slice(0, 72), {
    x: x + 10,
    y: y - 16,
    size: 10,
    font,
    color: THEME.primaryDark,
  })
  page.drawText("NatWest-style insight chart", {
    x: x + width - 145,
    y: y - 16,
    size: 8,
    font: monoFont,
    color: THEME.mutedText,
  })

  return {
    plotX: x + 10,
    plotY: y - height + 12,
    plotWidth: width - 20,
    plotHeight: height - 40,
  }
}

function drawGrid(args: {
  page: PDFPage
  x: number
  y: number
  width: number
  height: number
}) {
  const { page, x, y, width, height } = args
  for (let i = 0; i < 4; i += 1) {
    const yy = y + (height / 3) * i
    page.drawLine({
      start: { x, y: yy },
      end: { x: x + width, y: yy },
      color: THEME.chartGrid,
      thickness: 0.8,
    })
  }
}

function drawBarChart(args: {
  page: PDFPage
  points: NumericPoint[]
  x: number
  y: number
  width: number
  height: number
  monoFont: PDFFont
}) {
  const { page, points, x, y, width, height, monoFont } = args
  const max = Math.max(...points.map((point) => point.value), 1)
  const slot = width / points.length
  const barWidth = Math.max(8, slot * 0.6)

  points.forEach((point, index) => {
    const normalized = point.value / max
    const barHeight = Math.max(2, normalized * (height - 20))
    const barX = x + index * slot + (slot - barWidth) / 2
    const barY = y + 16
    page.drawRectangle({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      color: THEME.chartA,
      borderColor: THEME.primaryDark,
      borderWidth: 0.5,
    })
    page.drawText(point.label.slice(0, 8), {
      x: barX,
      y: y + 3,
      size: 7,
      font: monoFont,
      color: THEME.mutedText,
    })
  })
}

function drawLineChart(args: {
  page: PDFPage
  points: NumericPoint[]
  x: number
  y: number
  width: number
  height: number
  monoFont: PDFFont
}) {
  const { page, points, x, y, width, height, monoFont } = args
  const max = Math.max(...points.map((point) => point.value), 1)
  const min = Math.min(...points.map((point) => point.value), 0)
  const range = Math.max(1, max - min)
  const span = Math.max(points.length - 1, 1)

  let prevX = x
  let prevY = y + ((points[0]?.value ?? 0) - min) / range * (height - 18) + 10
  points.forEach((point, index) => {
    const px = x + (index / span) * width
    const py = y + ((point.value - min) / range) * (height - 18) + 10
    if (index > 0) {
      page.drawLine({
        start: { x: prevX, y: prevY },
        end: { x: px, y: py },
        color: THEME.chartA,
        thickness: 2,
      })
    }
    page.drawCircle({
      x: px,
      y: py,
      size: 2.3,
      color: THEME.chartB,
      borderColor: THEME.primaryDark,
      borderWidth: 0.4,
    })
    if (index % 2 === 0 || points.length <= 6) {
      page.drawText(point.label.slice(0, 8), {
        x: px - 8,
        y: y + 3,
        size: 7,
        font: monoFont,
        color: THEME.mutedText,
      })
    }
    prevX = px
    prevY = py
  })
}

function drawCompositionChart(args: {
  page: PDFPage
  points: NumericPoint[]
  x: number
  y: number
  width: number
  height: number
  monoFont: PDFFont
  boldFont: PDFFont
}) {
  const { page, points, x, y, width, height, monoFont, boldFont } = args
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const maxBarWidth = width - 110
  const rowHeight = Math.max(12, Math.floor((height - 8) / points.length))
  const colors = [THEME.chartA, THEME.chartB, THEME.chartC, THEME.chartD]

  points.forEach((point, index) => {
    const pct = total > 0 ? point.value / total : 0
    const barW = Math.max(2, pct * maxBarWidth)
    const rowY = y + height - (index + 1) * rowHeight
    page.drawText(point.label.slice(0, 14), {
      x,
      y: rowY + 3,
      size: 8,
      font: monoFont,
      color: THEME.mutedText,
    })
    page.drawRectangle({
      x: x + 82,
      y: rowY + 1,
      width: barW,
      height: rowHeight - 4,
      color: colors[index % colors.length],
      borderColor: THEME.primaryDark,
      borderWidth: 0.3,
    })
    page.drawText(`${Math.round(pct * 100)}%`, {
      x: x + 87 + barW,
      y: rowY + 3,
      size: 8,
      font: boldFont,
      color: THEME.primaryDark,
    })
  })
}

function drawChartForMessage(args: {
  page: PDFPage
  chartSpec: ChartSpec
  x: number
  topY: number
  width: number
  font: PDFFont
  monoFont: PDFFont
  boldFont: PDFFont
}) {
  const chartHeight = 176
  const shell = drawChartShell({
    page: args.page,
    x: args.x,
    y: args.topY,
    width: args.width,
    height: chartHeight,
    title: args.chartSpec.title,
    font: args.boldFont,
    monoFont: args.monoFont,
  })
  const points = toNumericPoints(args.chartSpec)
  if (points.length === 0) {
    return
  }
  drawGrid({
    page: args.page,
    x: shell.plotX,
    y: shell.plotY,
    width: shell.plotWidth,
    height: shell.plotHeight,
  })
  if (args.chartSpec.type === "bar") {
    drawBarChart({
      page: args.page,
      points,
      x: shell.plotX,
      y: shell.plotY,
      width: shell.plotWidth,
      height: shell.plotHeight,
      monoFont: args.monoFont,
    })
    return
  }

  if (args.chartSpec.type === "pie") {
    drawCompositionChart({
      page: args.page,
      points,
      x: shell.plotX,
      y: shell.plotY,
      width: shell.plotWidth,
      height: shell.plotHeight,
      monoFont: args.monoFont,
      boldFont: args.boldFont,
    })
    return
  }

  drawLineChart({
    page: args.page,
    points,
    x: shell.plotX,
    y: shell.plotY,
    width: shell.plotWidth,
    height: shell.plotHeight,
    monoFont: args.monoFont,
  })
}

export async function buildChatTranscriptPdf(
  args: BuildChatTranscriptPdfArgs,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const bodyFont = await document.embedFont(StandardFonts.Helvetica)
  const monoFont = await document.embedFont(StandardFonts.Courier)
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold)

  let page = document.addPage()
  drawPageTheme(page)
  let y = page.getHeight() - PAGE_MARGIN
  const contentWidth = page.getWidth() - PAGE_MARGIN * 2
  const cardPadding = 14

  const drawLine = (params: {
    text: string
    x?: number
    size?: number
    font?: typeof bodyFont
    color?: ReturnType<typeof rgb>
  }) => {
    page.drawText(params.text, {
      x: params.x ?? PAGE_MARGIN,
      y,
      size: params.size ?? BODY_SIZE,
      font: params.font ?? bodyFont,
      color: params.color ?? THEME.text,
    })
    y -= LINE_HEIGHT
  }

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight > PAGE_MARGIN) {
      return
    }

    page = document.addPage()
    drawPageTheme(page)
    y = page.getHeight() - PAGE_MARGIN
  }

  const headerHeight = 84
  ensureSpace(headerHeight + 16)
  drawRoundedRect({
    page,
    x: PAGE_MARGIN,
    y: y - headerHeight,
    width: contentWidth,
    height: headerHeight,
    radius: 16,
    color: THEME.primary,
    borderColor: THEME.primaryDark,
    borderWidth: 1.5,
  })
  y -= 26
  drawLine({
    text: args.title,
    x: PAGE_MARGIN + 16,
    size: 19,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  drawLine({
    text: `Generated: ${args.generatedAt.toLocaleString()}${args.datasetId ? `  |  Dataset: ${args.datasetId}` : ""}`,
    x: PAGE_MARGIN + 16,
    size: 10,
    font: monoFont,
    color: rgb(0.93, 0.9, 0.98),
  })
  y -= 12

  for (const [index, message] of args.messages.entries()) {
    const roleLabel = message.role === "user" ? "User" : "Assistant"
    const timestamp = message.createdAt
      ? new Date(message.createdAt).toLocaleString()
      : null
    const lineHeader = timestamp
      ? `${index + 1}. ${roleLabel}  (${timestamp})`
      : `${index + 1}. ${roleLabel}`
    const lines = wrapText({
      text: message.text,
      maxWidth: contentWidth - cardPadding * 2,
      measure: (text, size) => bodyFont.widthOfTextAtSize(text, size),
      size: BODY_SIZE,
    })
    const hasChart = Boolean(message.chartSpec)
    const chartHeight = hasChart ? 184 : 0
    const chartBlockPadding = hasChart ? 18 : 0
    const textHeight = lines.length * LINE_HEIGHT
    const headerAndPadding = 60
    const cardHeight =
      headerAndPadding + textHeight + chartBlockPadding + chartHeight + 10

    ensureSpace(cardHeight + 12)
    const cardTop = y
    const cardBottom = y - cardHeight
    drawRoundedRect({
      page,
      x: PAGE_MARGIN,
      y: cardBottom,
      width: contentWidth,
      height: cardHeight,
      radius: 14,
      color: THEME.panel,
      borderColor: THEME.panelBorder,
      borderWidth: 1,
    })

    const badgeColor =
      message.role === "user" ? THEME.userBadge : THEME.assistantBadge
    drawRoundedRect({
      page,
      x: PAGE_MARGIN + cardPadding,
      y: cardTop - 26,
      width: 88,
      height: 16,
      radius: 6,
      color: badgeColor,
    })
    page.drawText(roleLabel, {
      x: PAGE_MARGIN + cardPadding + 10,
      y: cardTop - 22,
      size: 10,
      font: boldFont,
      color: rgb(1, 1, 1),
    })

    y -= 38
    drawLine({
      text: lineHeader,
      x: PAGE_MARGIN + cardPadding,
      size: 10,
      font: monoFont,
      color: THEME.mutedText,
    })
    lines.forEach((line) => {
      drawLine({
        text: line,
        x: PAGE_MARGIN + cardPadding,
      })
    })

    if (message.chartSpec) {
      y -= 8
      if (message.chartTitle) {
        drawLine({
          text: message.chartTitle,
          x: PAGE_MARGIN + cardPadding,
          size: 11,
          font: boldFont,
          color: THEME.primaryDark,
        })
      }
      const chartWidth = contentWidth - cardPadding * 2
      drawChartForMessage({
        page,
        chartSpec: message.chartSpec,
        x: PAGE_MARGIN + cardPadding,
        topY: y + 4,
        width: chartWidth,
        font: bodyFont,
        monoFont,
        boldFont,
      })
      y -= 180
    }

    y = cardBottom - 12
  }

  return await document.save()
}

// ============================================================
// DataTalk AI Engine - Core Types, Data & Agent Orchestration
// ============================================================

export interface Column {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean'
  isPII?: boolean
  description?: string
}

export interface Table {
  name: string
  columns: Column[]
  rowCount: number
  description?: string
}

export interface Database {
  name: string
  type: 'mysql' | 'postgresql' | 'csv' | 'excel'
  tables: Table[]
  connected: boolean
  description?: string
}

export interface DataSource {
  id: string
  name: string
  type: 'database' | 'csv' | 'excel' | 'pdf' | 'docx' | 'txt'
  size?: string
  uploadedAt?: Date
  status: 'ready' | 'processing' | 'error'
  recordCount?: number
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  xKey: string
  yKey: string
  data: Record<string, any>[]
  explanation: string
  color?: string
}

export interface InsightCard {
  id: string
  category: 'trend' | 'anomaly' | 'comparison' | 'summary' | 'warning'
  title: string
  description: string
  value?: string
  change?: number
  importance: 'high' | 'medium' | 'low'
  icon: string
}

export interface WhatIfScenario {
  variable: string
  originalValue: number
  newValue: number
  unit: string
  impact: {
    metric: string
    change: number
    newValue: number
    confidence: number
  }[]
}

export interface DataQualityReport {
  completeness: number
  accuracy: number
  biasWarnings: string[]
  missingFields: string[]
  outliers: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  simpleContent?: string
  timestamp: Date
  queries?: string[]
  chartData?: ChartData
  insightCards?: InsightCard[]
  confidence?: number
  sources?: string[]
  followUpQuestions?: string[]
  dataQuality?: DataQualityReport
  isStory?: boolean
  agentSteps?: AgentStep[]
  intent?: string
  whatIf?: WhatIfScenario
}

export interface AgentStep {
  agent: string
  status: 'running' | 'done' | 'error'
  description: string
  duration?: number
}

// ============================================================
// MOCK DATABASES
// ============================================================

export const SAMPLE_DATABASES: Database[] = [
  {
    name: 'sales_db',
    type: 'postgresql',
    connected: true,
    description: 'Primary sales & orders database',
    tables: [
      {
        name: 'orders',
        rowCount: 48320,
        description: 'All customer orders',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'customer_id', type: 'number' },
          { name: 'amount', type: 'number', description: 'Order total in USD' },
          { name: 'date', type: 'date' },
          { name: 'region', type: 'string' },
          { name: 'product_id', type: 'number' },
          { name: 'status', type: 'string' },
          { name: 'channel', type: 'string' },
        ],
      },
      {
        name: 'customers',
        rowCount: 12450,
        description: 'Customer profiles',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string', isPII: true },
          { name: 'email', type: 'string', isPII: true },
          { name: 'country', type: 'string' },
          { name: 'segment', type: 'string' },
          { name: 'created_at', type: 'date' },
          { name: 'lifetime_value', type: 'number' },
        ],
      },
      {
        name: 'products',
        rowCount: 842,
        description: 'Product catalog',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'price', type: 'number' },
          { name: 'stock', type: 'number' },
          { name: 'margin', type: 'number' },
        ],
      },
      {
        name: 'regions',
        rowCount: 8,
        description: 'Sales regions',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string' },
          { name: 'manager', type: 'string', isPII: true },
          { name: 'revenue_target', type: 'number' },
          { name: 'ytd_revenue', type: 'number' },
        ],
      },
      {
        name: 'expenses',
        rowCount: 9830,
        description: 'Company expenses',
        columns: [
          { name: 'id', type: 'number' },
          { name: 'category', type: 'string' },
          { name: 'amount', type: 'number' },
          { name: 'date', type: 'date' },
          { name: 'department', type: 'string' },
        ],
      },
    ],
  },
  {
    name: 'analytics_dw',
    type: 'postgresql',
    connected: true,
    description: 'Analytics data warehouse',
    tables: [
      {
        name: 'fact_revenue',
        rowCount: 250000,
        columns: [
          { name: 'date_id', type: 'number' },
          { name: 'product_id', type: 'number' },
          { name: 'channel_id', type: 'number' },
          { name: 'revenue', type: 'number' },
          { name: 'units', type: 'number' },
          { name: 'cost', type: 'number' },
        ],
      },
      {
        name: 'dim_time',
        rowCount: 1825,
        columns: [
          { name: 'date_id', type: 'number' },
          { name: 'date', type: 'date' },
          { name: 'month', type: 'string' },
          { name: 'quarter', type: 'string' },
          { name: 'year', type: 'number' },
          { name: 'is_weekend', type: 'boolean' },
        ],
      },
      {
        name: 'dim_channel',
        rowCount: 12,
        columns: [
          { name: 'channel_id', type: 'number' },
          { name: 'channel_name', type: 'string' },
          { name: 'region', type: 'string' },
          { name: 'manager', type: 'string', isPII: true },
        ],
      },
      {
        name: 'dim_product',
        rowCount: 842,
        columns: [
          { name: 'product_id', type: 'number' },
          { name: 'name', type: 'string' },
          { name: 'category', type: 'string' },
          { name: 'brand', type: 'string' },
          { name: 'launch_date', type: 'date' },
        ],
      },
    ],
  },
]

export const SAMPLE_DATA_SOURCES: DataSource[] = [
  { id: 'ds1', name: 'sales_db', type: 'database', status: 'ready', recordCount: 48320 },
  { id: 'ds2', name: 'analytics_dw', type: 'database', status: 'ready', recordCount: 250000 },
]

// ============================================================
// PROACTIVE INSIGHTS
// ============================================================

export const PROACTIVE_INSIGHTS: InsightCard[] = [
  {
    id: 'pi1',
    category: 'anomaly',
    title: 'Revenue Spike Detected',
    description: 'North America revenue surged 34% above the 90-day average in the last 7 days',
    value: '+$42K',
    change: 34,
    importance: 'high',
    icon: '⚡',
  },
  {
    id: 'pi2',
    category: 'trend',
    title: 'APAC Growth Trend',
    description: 'Asia Pacific orders have grown consistently for 6 consecutive weeks',
    value: '+18%',
    change: 18,
    importance: 'high',
    icon: '📈',
  },
  {
    id: 'pi3',
    category: 'warning',
    title: 'Low Stock Alert',
    description: '23 products have less than 10 units remaining in inventory',
    value: '23 items',
    importance: 'medium',
    icon: '⚠️',
  },
  {
    id: 'pi4',
    category: 'comparison',
    title: 'Q1 vs Q1 Prior Year',
    description: 'Overall revenue is 12% ahead of same quarter last year',
    value: '+12%',
    change: 12,
    importance: 'medium',
    icon: '📊',
  },
  {
    id: 'pi5',
    category: 'summary',
    title: 'Top Customer Segment',
    description: 'Enterprise customers represent 68% of revenue despite being 22% of accounts',
    value: '68%',
    importance: 'low',
    icon: '💡',
  },
]

// ============================================================
// SUGGESTED QUERIES BY CONTEXT
// ============================================================

export const SUGGESTED_QUERIES = [
  'What are the top regions by revenue this quarter?',
  'Show me product category performance trends over the last 6 months',
  'Which customers have churn risk based on order frequency?',
  'Compare Q1 2024 vs Q1 2023 revenue by channel',
  'What caused the revenue spike in North America last week?',
  'Show me the top 10 products by margin',
  'How is our new product launch performing?',
  'What percentage of customers are repeat buyers?',
]

// ============================================================
// AI AGENT SIMULATION ENGINE
// ============================================================

function generateSQL(question: string, context: string): string {
  const q = question.toLowerCase()
  if (q.includes('region') || q.includes('regional')) {
    return `SELECT 
  region,
  SUM(amount) as total_revenue,
  COUNT(*) as order_count,
  AVG(amount) as avg_order_value
FROM orders
WHERE date >= DATE_TRUNC('quarter', CURRENT_DATE)
GROUP BY region
ORDER BY total_revenue DESC;`
  }
  if (q.includes('product') && (q.includes('top') || q.includes('best'))) {
    return `SELECT 
  p.name as product_name,
  p.category,
  SUM(o.amount) as total_revenue,
  COUNT(o.id) as order_count,
  p.margin as margin_pct
FROM orders o
JOIN products p ON o.product_id = p.id
GROUP BY p.name, p.category, p.margin
ORDER BY total_revenue DESC
LIMIT 10;`
  }
  if (q.includes('trend') || q.includes('monthly') || q.includes('month')) {
    return `SELECT 
  DATE_TRUNC('month', date) as month,
  SUM(amount) as revenue,
  COUNT(*) as orders,
  AVG(amount) as avg_order
FROM orders
WHERE date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month ASC;`
  }
  if (q.includes('customer') || q.includes('churn')) {
    return `SELECT 
  c.segment,
  COUNT(DISTINCT c.id) as customer_count,
  SUM(c.lifetime_value) as total_ltv,
  AVG(c.lifetime_value) as avg_ltv,
  MAX(o.date) as last_order_date
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.segment
ORDER BY total_ltv DESC;`
  }
  if (q.includes('compare') || q.includes('vs') || q.includes('versus')) {
    return `SELECT 
  dt.quarter,
  dt.year,
  SUM(fr.revenue) as quarterly_revenue,
  SUM(fr.units) as units_sold,
  SUM(fr.revenue - fr.cost) as gross_profit
FROM fact_revenue fr
JOIN dim_time dt ON fr.date_id = dt.date_id
WHERE dt.year IN (2023, 2024)
GROUP BY dt.quarter, dt.year
ORDER BY dt.year, dt.quarter;`
  }
  return `SELECT 
  region,
  SUM(amount) as total_revenue,
  COUNT(*) as order_count
FROM orders
WHERE date >= '2024-01-01'
GROUP BY region
ORDER BY total_revenue DESC;`
}

function generateChartData(question: string, results: Record<string, any>[]): ChartData {
  const q = question.toLowerCase()
  if (q.includes('trend') || q.includes('monthly') || q.includes('over time')) {
    return {
      type: 'line',
      title: 'Revenue Trend Over Time',
      xKey: 'month',
      yKey: 'revenue',
      data: [
        { month: 'Jan', revenue: 98000 },
        { month: 'Feb', revenue: 112000 },
        { month: 'Mar', revenue: 125000 },
        { month: 'Apr', revenue: 108000 },
        { month: 'May', revenue: 134000 },
        { month: 'Jun', revenue: 145000 },
        { month: 'Jul', revenue: 138000 },
        { month: 'Aug', revenue: 152000 },
        { month: 'Sep', revenue: 167000 },
        { month: 'Oct', revenue: 178000 },
        { month: 'Nov', revenue: 189000 },
        { month: 'Dec', revenue: 210000 },
      ],
      explanation: 'The line chart shows a clear upward growth trajectory, with a notable acceleration in Q4. December peaked at $210K, a 114% increase from January.',
    }
  }
  if (q.includes('product') || q.includes('category')) {
    return {
      type: 'bar',
      title: 'Revenue by Product Category',
      xKey: 'category',
      yKey: 'revenue',
      data: [
        { category: 'Electronics', revenue: 245000 },
        { category: 'Software', revenue: 189000 },
        { category: 'Services', revenue: 156000 },
        { category: 'Hardware', revenue: 98000 },
        { category: 'Accessories', revenue: 67000 },
      ],
      explanation: 'Electronics leads all categories with $245K in revenue. Software and Services together account for 56% of total revenue.',
    }
  }
  if (q.includes('compare') || q.includes('quarter') || q.includes('q1') || q.includes('q2')) {
    return {
      type: 'bar',
      title: 'Quarterly Revenue Comparison 2023 vs 2024',
      xKey: 'quarter',
      yKey: 'revenue',
      data: [
        { quarter: 'Q1 2023', revenue: 320000, year: 2023 },
        { quarter: 'Q1 2024', revenue: 358400, year: 2024 },
        { quarter: 'Q2 2023', revenue: 285000, year: 2023 },
        { quarter: 'Q2 2024', revenue: 312000, year: 2024 },
        { quarter: 'Q3 2023', revenue: 340000, year: 2023 },
        { quarter: 'Q3 2024', revenue: 395000, year: 2024 },
        { quarter: 'Q4 2023', revenue: 420000, year: 2023 },
        { quarter: 'Q4 2024', revenue: 498000, year: 2024 },
      ],
      explanation: 'All quarters in 2024 outperform their 2023 counterparts. Q4 2024 shows the largest absolute gain at +$78K.',
    }
  }
  if (q.includes('region')) {
    return {
      type: 'bar',
      title: 'Revenue by Region',
      xKey: 'region',
      yKey: 'revenue',
      data: [
        { region: 'North America', revenue: 125000 },
        { region: 'Europe', revenue: 98500 },
        { region: 'Asia Pacific', revenue: 87200 },
        { region: 'LATAM', revenue: 45300 },
        { region: 'MEA', revenue: 32100 },
      ],
      explanation: 'North America dominates with 32% of total revenue. Asia Pacific is the fastest growing region at +18% MoM.',
    }
  }
  if (q.includes('customer') || q.includes('segment')) {
    return {
      type: 'pie',
      title: 'Revenue by Customer Segment',
      xKey: 'segment',
      yKey: 'revenue',
      data: [
        { segment: 'Enterprise', revenue: 68 },
        { segment: 'Mid-Market', revenue: 22 },
        { segment: 'SMB', revenue: 10 },
      ],
      explanation: 'Enterprise customers are your highest-value segment. Despite being fewer in number, they drive 68% of all revenue.',
    }
  }
  return {
    type: 'bar',
    title: 'Revenue by Region',
    xKey: 'region',
    yKey: 'revenue',
    data: [
      { region: 'North America', revenue: 125000 },
      { region: 'Europe', revenue: 98500 },
      { region: 'Asia Pacific', revenue: 87200 },
      { region: 'LATAM', revenue: 45300 },
    ],
    explanation: 'North America leads revenue across all measured regions.',
  }
}

function generateInsights(question: string): InsightCard[] {
  const q = question.toLowerCase()
  const cards: InsightCard[] = []
  if (q.includes('region') || q.includes('revenue')) {
    cards.push({
      id: `insight-${Date.now()}-1`,
      category: 'anomaly',
      title: 'North America Outperforms',
      description: '34% above baseline — highest in 12 months',
      value: '+$42K',
      change: 34,
      importance: 'high',
      icon: '⚡',
    })
    cards.push({
      id: `insight-${Date.now()}-2`,
      category: 'trend',
      title: 'LATAM Accelerating',
      description: 'Consistent 8-week growth streak, up 12% from last quarter',
      value: '+12%',
      change: 12,
      importance: 'medium',
      icon: '📈',
    })
  }
  if (q.includes('product') || q.includes('category')) {
    cards.push({
      id: `insight-${Date.now()}-3`,
      category: 'comparison',
      title: 'Electronics Dominant',
      description: 'Electronics category is 31% of revenue — highest share ever recorded',
      value: '31%',
      importance: 'high',
      icon: '🏆',
    })
  }
  if (q.includes('customer') || q.includes('churn')) {
    cards.push({
      id: `insight-${Date.now()}-4`,
      category: 'warning',
      title: 'Churn Risk: 84 Accounts',
      description: 'High-value customers with no orders in 60+ days',
      value: '84 at risk',
      importance: 'high',
      icon: '⚠️',
    })
  }
  cards.push({
    id: `insight-${Date.now()}-5`,
    category: 'summary',
    title: 'Data Completeness: 94%',
    description: 'Missing values detected in 6% of rows — results are reliable',
    value: '94%',
    importance: 'low',
    icon: '✅',
  })
  return cards
}

function generateDataQuality(question: string): DataQualityReport {
  return {
    completeness: 94,
    accuracy: 97,
    biasWarnings: question.toLowerCase().includes('customer') 
      ? ['Customer data may be skewed toward enterprise segment (68% of labeled records)']
      : [],
    missingFields: question.toLowerCase().includes('region') 
      ? ['region: 3.2% null values — LATAM data partially missing']
      : [],
    outliers: ['2 orders flagged as statistical outliers (>3σ from mean) — included in results'],
  }
}

function generateConfidence(question: string): number {
  const q = question.toLowerCase()
  if (q.includes('why') || q.includes('cause') || q.includes('predict')) return Math.round(72 + Math.random() * 8)
  if (q.includes('trend') || q.includes('compare')) return Math.round(85 + Math.random() * 8)
  return Math.round(88 + Math.random() * 8)
}

function generateFollowUps(question: string): string[] {
  const q = question.toLowerCase()
  if (q.includes('region')) {
    return [
      'Why is North America growing so fast?',
      'Break down North America by product category',
      'Forecast next quarter regional performance',
    ]
  }
  if (q.includes('product') || q.includes('category')) {
    return [
      'Which products have the highest margin?',
      'Show me inventory levels for top products',
      'What is the return rate by category?',
    ]
  }
  if (q.includes('customer') || q.includes('churn')) {
    return [
      'Who are the top 10 customers by lifetime value?',
      'What is the average order frequency?',
      'Show me cohort retention analysis',
    ]
  }
  return [
    'Show me this data as a trend over time',
    'What are the main drivers of this metric?',
    'Compare this to last year',
    'Which segment is underperforming?',
  ]
}

function generateStory(question: string, answer: string): string {
  return `📖 **Data Story**\n\nImagine your business as a map, with revenue flowing like rivers to different territories.\n\n${answer}\n\nThe data tells a story of **growth** — but not evenly distributed. North America is experiencing a rainfall of orders while some other regions are still waiting for their season.\n\n_The opportunity?_ Replicate what's working in your top regions in the markets that are still developing. Based on this data, a targeted campaign in APAC could unlock an estimated **$28K–$45K** in additional quarterly revenue.\n\n_The risk?_ LATAM order volume is healthy, but average order value has declined 8% — worth investigating before the trend deepens.`
}

function detectIntent(question: string): string {
  const q = question.toLowerCase()
  if (q.startsWith('why') || q.includes('cause') || q.includes('reason')) return 'root_cause'
  if (q.includes('compare') || q.includes('vs') || q.includes('versus')) return 'comparison'
  if (q.includes('trend') || q.includes('over time') || q.includes('monthly')) return 'trend'
  if (q.includes('top') || q.includes('best') || q.includes('highest')) return 'ranking'
  if (q.includes('predict') || q.includes('forecast') || q.includes('what if')) return 'prediction'
  if (q.includes('breakdown') || q.includes('break down') || q.includes('split')) return 'breakdown'
  return 'summary'
}

function generateWhatIf(question: string): WhatIfScenario | undefined {
  const q = question.toLowerCase()
  if (q.includes('what if') || q.includes('increase') || q.includes('reduce') || q.includes('by %') || q.includes('double')) {
    const pct = q.match(/(\d+)%?/)?.[1] ? parseInt(q.match(/(\d+)%/)![1]) : 20
    return {
      variable: 'Marketing Spend',
      originalValue: 50000,
      newValue: 50000 * (1 + pct / 100),
      unit: 'USD/month',
      impact: [
        { metric: 'Total Revenue', change: pct * 0.85, newValue: 388000 * (1 + (pct * 0.85) / 100), confidence: 74 },
        { metric: 'New Customers', change: pct * 0.6, newValue: Math.round(340 * (1 + (pct * 0.6) / 100)), confidence: 68 },
        { metric: 'CAC', change: pct * 0.3, newValue: Math.round(125 * (1 + (pct * 0.3) / 100)), confidence: 71 },
      ],
    }
  }
  return undefined
}

// ============================================================
// MAIN AI RESPONSE GENERATOR
// ============================================================

export async function generateAIResponse(
  question: string,
  conversationHistory: ChatMessage[],
  activeSources: string[]
): Promise<Omit<ChatMessage, 'id' | 'timestamp'>> {
  // Simulate multi-agent processing delay
  await new Promise(resolve => setTimeout(resolve, 1800 + Math.random() * 800))

  const intent = detectIntent(question)
  const sql = generateSQL(question, activeSources.join(', '))
  const chartData = generateChartData(question, [])
  const insights = generateInsights(question)
  const confidence = generateConfidence(question)
  const followUps = generateFollowUps(question)
  const quality = generateDataQuality(question)
  const whatIf = generateWhatIf(question)

  const q = question.toLowerCase()
  let content = ''

  if (intent === 'root_cause') {
    content = `🔍 **Root Cause Analysis**\n\nThe primary driver of this pattern is **multi-factor**: marketing channel mix shift (accounts for ~42% of the variance) combined with seasonal demand uplift and a recent pricing adjustment in the enterprise tier.\n\n**Key Contributors:**\n• Marketing spend increased 28% in North America — driving 1,340 new leads\n• Product launch of "Pro Suite" in February added $38K to average monthly revenue\n• Enterprise contracts renewed at 94% rate — higher than industry average of 78%\n\n**What this means:** The growth is sustainable, not a one-time spike. However, reliance on one region creates concentration risk.`
  } else if (intent === 'trend') {
    content = `📈 **Trend Analysis**\n\nRevenue shows a **consistent upward trend** over the analyzed period, growing at an average monthly rate of 7.2%.\n\n**Key Observations:**\n• Strong Q4 seasonality — December is typically 35% above the monthly average\n• The 6-month moving average crossed the 12-month average in September — a **golden cross** signal\n• No significant dips or anomalies detected in the trend line\n\n**Forecast:** Based on current momentum, next quarter is projected to reach **$215K–$235K** in revenue (confidence: ${confidence}%).`
  } else if (intent === 'comparison') {
    content = `📊 **Comparison Analysis**\n\n2024 is outperforming 2023 across all four quarters. The gap is widening — Q4 2024 shows a **+18.6% improvement** vs Q4 2023.\n\n**Quarter-by-Quarter Summary:**\n• Q1: +12.0% YoY (+$38.4K)\n• Q2: +9.5% YoY (+$27K)\n• Q3: +16.2% YoY (+$55K)\n• Q4: +18.6% YoY (+$78K)\n\n**Key Insight:** The acceleration in H2 2024 suggests your product and market investments from early 2024 are now compounding.`
  } else if (intent === 'ranking') {
    content = `🏆 **Top Performers**\n\nHere are the leaders based on your query:\n\n**Top 5 by Revenue:**\n1. North America — $125,000 (32% of total)\n2. Europe — $98,500 (25% of total)\n3. Asia Pacific — $87,200 (22% of total)\n4. LATAM — $45,300 (11% of total)\n5. MEA — $32,100 (8% of total)\n\n**Notable:** North America's lead is growing — it was 28% last quarter. Asia Pacific has the highest growth rate at +18% MoM.`
  } else if (intent === 'prediction') {
    content = `🎯 **What-If Simulation**\n\nBased on historical response rates and current channel efficiency:\n\n**Scenario:** Increasing marketing spend by ${whatIf?.newValue ? Math.round(((whatIf.newValue - whatIf.originalValue) / whatIf.originalValue) * 100) : 20}%\n\n**Predicted Impact:**\n• Revenue: +${whatIf?.impact[0].change?.toFixed(0) || 17}% increase (high probability)\n• New customers: +${whatIf?.impact[1].change?.toFixed(0) || 12}% growth\n• CAC will likely rise slightly due to market saturation\n\n_Note: Predictions are based on linear regression models with ${confidence}% historical fit accuracy. Real-world results may vary._`
  } else {
    content = `📋 **Summary**\n\nHere's what the data shows for your question:\n\nNorth America leads with **$125,000** in revenue from 1,200 orders this quarter. Europe follows at $98,500 with strong average order values. Asia Pacific is the momentum story — orders up 18% from last period.\n\n**Key Takeaways:**\n• Total revenue: $388,100 across all regions\n• Average order value: $323\n• Best performing channel: Direct Sales (42% of revenue)\n• Growth rate: +12% QoQ overall`
  }

  const simpleContent = `In plain terms: ${
    intent === 'root_cause' ? 'Revenue went up mostly because of more marketing spend and a successful product launch.' :
    intent === 'trend' ? 'Sales are going up steadily — think of it like a climbing staircase, each month higher than the last.' :
    intent === 'comparison' ? 'This year is better than last year in every quarter — you\'re doing about 12-18% better each time.' :
    intent === 'ranking' ? 'North America is your #1 region, making about $125K. Europe is #2 at $98K.' :
    'Your sales data shows healthy numbers with North America leading the way.'
  }`

  return {
    role: 'assistant',
    content,
    simpleContent,
    queries: [sql],
    chartData,
    insightCards: insights,
    confidence,
    sources: activeSources.length > 0 ? activeSources : ['orders', 'fact_revenue', 'dim_time'],
    followUpQuestions: followUps,
    dataQuality: quality,
    isStory: false,
    intent,
    whatIf: whatIf || undefined,
    agentSteps: [
      { agent: 'Intent Agent', status: 'done', description: `Detected intent: ${intent}`, duration: 120 },
      { agent: 'Query Agent', status: 'done', description: 'Generated optimized SQL query', duration: 340 },
      intent === 'root_cause' || intent === 'summary' 
        ? { agent: 'Retrieval Agent', status: 'done', description: 'Searched document knowledge base (3 chunks)', duration: 280 }
        : { agent: 'Retrieval Agent', status: 'done', description: 'No unstructured data needed', duration: 45 },
      { agent: 'Analysis Agent', status: 'done', description: `Performed ${intent} analysis`, duration: 520 },
      { agent: 'Visualization Agent', status: 'done', description: `Generated ${chartData.type} chart`, duration: 180 },
      { agent: 'Explanation Agent', status: 'done', description: 'Generated human-friendly explanation', duration: 220 },
    ],
  }
}

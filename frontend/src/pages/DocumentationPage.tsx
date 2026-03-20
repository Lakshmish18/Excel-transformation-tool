/**
 * Documentation: getting started, all 17 operations, features, FAQ.
 * Searchable and tabbed.
 */
import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Book, Code, Video, HelpCircle } from 'lucide-react'

type DocCategory = 'getting-started' | 'operations' | 'features' | 'api' | 'faq'

interface DocSection {
  id: string
  title: string
  content: string
  category: DocCategory
}

const DOCUMENTATION: DocSection[] = [
  // --- Getting Started ---
  {
    id: 'intro',
    title: 'Introduction',
    category: 'getting-started',
    content: `
# Welcome to Excel Data Transformation Tool

Transform your Excel files without writing code. This tool helps you:
- Clean messy data
- Calculate new columns
- Merge multiple files
- Automate repetitive tasks

## Quick Start

1. **Upload** your Excel file (.xlsx)
2. **Preview** your data and check for issues
3. **Build** a transformation pipeline
4. **Download** your transformed file

No formulas, no coding, just results!
`,
  },
  {
    id: 'upload-file',
    title: 'How to Upload a File',
    category: 'getting-started',
    content: `
# Uploading Files

## Supported Formats
- Excel (.xlsx) files only
- Maximum file size: 50MB
- Files with multiple sheets supported

## Upload Methods

### Drag & Drop
1. Click "Transform Single File" on the home page
2. Drag your .xlsx file to the upload area
3. Drop to upload

### Click to Browse
1. Click the upload area
2. Select a file from your computer
3. Click "Open"

## What Happens Next
- File is uploaded to temporary storage
- Sheet names are detected automatically
- Headers are identified
- You're taken to the preview page
`,
  },
  // --- Operations (all 17) ---
  {
    id: 'filter',
    title: 'Filter Rows',
    category: 'operations',
    content: `
# Filter Rows

Keep only rows that match your conditions. Like Excel's AutoFilter, but more powerful.

## Parameters
- **Column**: Which column to filter
- **Operator**: equals, not_equals, greater_than, less_than, greater_equal, less_equal, contains, not_contains, date_range
- **Value**: What to compare against

## Examples
- **High-value sales**: Column = total_revenue, Operator = greater_than, Value = 1000
- **By region**: Column = region, Operator = equals, Value = California

Filters are applied in order. Add multiple filter operations to combine conditions.
`,
  },
  {
    id: 'replace',
    title: 'Find & Replace',
    category: 'operations',
    content: `
# Find & Replace

Replace text values in a column. Useful for standardizing categories or fixing typos.

## Parameters
- **Column**: The column to modify
- **Old value**: Text to find (exact match)
- **New value**: Replacement text

## Examples
- Change "USA" to "United States"
- Change "N/A" to empty or "Unknown"
- Standardize product codes
`,
  },
  {
    id: 'math',
    title: 'Math Operations',
    category: 'operations',
    content: `
# Math Operations

Perform calculations: add, subtract, multiply, or divide. Create new columns from existing ones.

## Parameters
- **Operation**: add, subtract, multiply, divide
- **Column A**: First value (column)
- **Column B or Value**: Second value (column or fixed number)
- **New column**: Name for the result

## Examples
- **Total price**: multiply(price, quantity) → total_price
- **Discount amount**: subtract(price, discounted_price) → discount_amount
- **Markup 10%**: multiply(cost, 1.10) → selling_price

Column B can be another column or a number. Division by zero yields null.
`,
  },
  {
    id: 'sort',
    title: 'Sort',
    category: 'operations',
    content: `
# Sort

Order rows by one or more columns, ascending or descending.

## Parameters
- **Columns**: List of { column, ascending }. First column is primary sort; others break ties.

## Examples
- Sort by revenue descending: [{ column: "revenue", ascending: false }]
- Sort by date then name: [{ column: "date", ascending: true }, { column: "name", ascending: true }]
`,
  },
  {
    id: 'select_columns',
    title: 'Select Columns',
    category: 'operations',
    content: `
# Select Columns

Keep only the columns you need. All other columns are removed.

## Parameters
- **Columns**: List of column names to keep

## Use case
Reduce file size or focus on specific fields before export or further transformation.
`,
  },
  {
    id: 'remove_duplicates',
    title: 'Remove Duplicates',
    category: 'operations',
    content: `
# Remove Duplicates

Remove duplicate rows. Optionally consider only certain columns when determining duplicates.

## Parameters
- **Columns** (optional): Columns to use for duplicate detection. If omitted, entire row is used.

## Example
Keep one row per customer by using "customer_id" as the key.
`,
  },
  {
    id: 'remove_blank_rows',
    title: 'Remove Blank Rows',
    category: 'operations',
    content: `
# Remove Blank Rows

Remove rows where selected columns have empty or blank values.

## Parameters
- **Columns**: Columns to check for blanks. If any of these are empty, the row is removed.

Useful after filtering or when cleaning imported data with empty lines.
`,
  },
  {
    id: 'text_cleanup',
    title: 'Text Cleanup',
    category: 'operations',
    content: `
# Text Cleanup

Clean text in a column: trim spaces, change case, remove special characters.

## Parameters
- **Column**: Column to clean
- **Operations**: List of: trim, lowercase, uppercase, remove_symbols

## Examples
- Trim leading/trailing spaces
- Normalize to lowercase for matching
- Remove punctuation or symbols
`,
  },
  {
    id: 'convert_to_numeric',
    title: 'Convert to Number',
    category: 'operations',
    content: `
# Convert to Number

Parse text as numbers so you can use math operations or sort numerically.

## Parameters
- **Column**: Column containing text that looks like numbers

Values that cannot be parsed become null. Use before math or sort for best results.
`,
  },
  {
    id: 'split_column',
    title: 'Split Column',
    category: 'operations',
    content: `
# Split Column

Split one column into multiple columns using a separator (e.g. comma, tab, space).

## Parameters
- **Column**: Column to split
- **Separator**: Delimiter (e.g. ",", "\\t", " ")
- **New columns**: Names for the resulting columns

Useful for "Full Name" → First, Last or "Address" → Street, City, Zip.
`,
  },
  {
    id: 'merge_columns',
    title: 'Merge Columns',
    category: 'operations',
    content: `
# Merge Columns

Combine multiple columns into one (e.g. First + " " + Last → Full Name).

## Parameters
- **Columns**: Columns to merge (in order)
- **Separator** (optional): String between values (e.g. " ", "-")
- **New column**: Name for the result
`,
  },
  {
    id: 'date_format',
    title: 'Date Format',
    category: 'operations',
    content: `
# Date Format

Convert date formats (e.g. MM/DD/YYYY to YYYY-MM-DD) or parse text as dates.

## Parameters
- **Column**: Column with date or date-like text
- **Output format**: Desired format string

Ensures consistent dates for sorting, filtering, and reporting.
`,
  },
  {
    id: 'gross_profit',
    title: 'Gross Profit',
    category: 'operations',
    content: `
# Gross Profit

Add a gross profit column: Revenue minus Cost of Goods Sold (COGS).

## Parameters
- **Revenue column**: Column containing revenue/sales
- **COGS column**: Column containing cost of goods sold
- **New column**: Name for gross profit (e.g. "gross_profit")
`,
  },
  {
    id: 'net_profit',
    title: 'Net Profit',
    category: 'operations',
    content: `
# Net Profit

Add a net profit column: Gross profit minus expenses.

## Parameters
- **Gross profit column**: From previous step or existing column
- **Expenses column**: Operating/other expenses
- **New column**: Name for net profit
`,
  },
  {
    id: 'profit_loss',
    title: 'P&L Statement',
    category: 'operations',
    content: `
# P&L Statement

Build a profit and loss view: revenue, costs, and profit by period (e.g. monthly or quarterly).

## Parameters
- **Date column**: For grouping by period
- **Revenue column**
- **Cost/expense columns**
- **Period**: month or quarter

Useful for financial reporting and dashboards.
`,
  },
  {
    id: 'aggregate',
    title: 'Aggregate',
    category: 'operations',
    content: `
# Aggregate

Group by one or more columns and summarize with sum, average, count, min, max.

## Parameters
- **Group by**: Column(s) to group by
- **Aggregations**: For each numeric column, choose: sum, avg, count, min, max
- **Result**: New table with one row per group

Example: Group by "region", sum "revenue", count "order_id" for regional totals.
`,
  },
  // --- Features ---
  {
    id: 'save-pipeline',
    title: 'Save & Load Pipelines',
    category: 'features',
    content: `
# Save & Load Pipelines

## Save a Pipeline
1. Build your transformation pipeline
2. Click "Save Pipeline"
3. Enter a name (e.g. "Monthly Sales Report")
4. Optionally add a description
5. Save to cloud (if signed in) or use local storage

## Load a Pipeline
1. Click "Load Pipeline" or open from History
2. Select a saved pipeline
3. Operations are restored; you can run on new data

## Use Cases
- Recurring reports: same pipeline every month
- Templates: common transformations ready to reuse
- Share: export as JSON to share with others
`,
  },
  {
    id: 'batch-mode',
    title: 'Batch Processing',
    category: 'features',
    content: `
# Batch Processing Multiple Files

Apply the same transformation to many files at once.

## How To Use
1. Click "Batch Process Files" on the home page
2. Upload multiple .xlsx files (same structure recommended)
3. Select the sheet name (must exist in all files)
4. Build one pipeline — it applies to every file
5. Click "Process All Files"
6. Download results as a ZIP

## Tips
- Test your pipeline on one file first
- All files should have matching column names for the same pipeline
- Results are packaged as a ZIP for easy download
`,
  },
  {
    id: 'merge-files',
    title: 'Merge Multiple Files',
    category: 'features',
    content: `
# Merge Multiple Files

Combine data from two or more Excel files.

## Strategies
- **Append**: Stack rows (same columns). Good for combining monthly reports.
- **Join**: SQL-style join on a key column (e.g. product_id). Enrich one table with another.
- **Union**: Like append but remove duplicate rows.

## How To Use
1. Click "Merge Files" on the home page
2. Upload two or more files
3. Choose strategy (Append, Join, Union)
4. For Join: select join column and type (inner, left, right, outer)
5. Run merge and download result
`,
  },
  {
    id: 'history',
    title: 'Transformation History',
    category: 'features',
    content: `
# Transformation History

View and replay past transformations (when signed in with Supabase).

- **History page**: List of recent runs with file name, pipeline summary, row counts
- **Restore**: Load a past pipeline to run again on new data
- **Download**: Re-download transformed files if still available

History is stored in the cloud when you're signed in; otherwise recent activity is tracked locally.
`,
  },
  // --- API ---
  {
    id: 'api',
    title: 'API Documentation',
    category: 'api',
    content: `
# API Documentation

The Excel Data Transformation Tool exposes a REST API for developers.

## Base URL
When running locally: \`http://localhost:8000/api/v1\`

## Key Endpoints
- **POST /upload-excel** — Upload a file, returns fileId and sheet names
- **GET /preview-sheet** — Preview rows for a sheet
- **POST /preview-transform** — Preview transformation with operations
- **POST /validate-pipeline** — Validate operations without applying
- **POST /export-transform** — Apply operations and return file (blob)
- **POST /merge-files** — Merge multiple uploaded files
- **POST /batch-transform** — Transform multiple files with same pipeline

## Authentication
The current app uses session-based file storage. For production, consider adding API keys or OAuth.

For full request/response schemas, inspect the OpenAPI docs at \`/docs\` when the backend is running.
`,
  },
  // --- FAQ ---
  {
    id: 'faq-file-size',
    title: 'File Size Limits',
    category: 'faq',
    content: `
## What's the maximum file size?

**50MB** per file for single and batch modes.

If your file is larger:
1. Split it into smaller files and use batch mode
2. Or filter/select columns first to reduce size
`,
  },
  {
    id: 'faq-formulas',
    title: 'Do Excel Formulas Transfer?',
    category: 'faq',
    content: `
## Do Excel formulas appear in the output?

**No.** The output contains values only, not formulas.

Transformations produce new values. If you need formulas in the final file, add them in Excel after downloading.
`,
  },
  {
    id: 'faq-sheets',
    title: 'Multiple Sheets',
    category: 'faq',
    content: `
## Can I transform multiple sheets at once?

Each run works on **one sheet** at a time. To transform multiple sheets:
1. Run the pipeline for the first sheet, download
2. Start a new flow, select the next sheet, apply same or different pipeline
3. Or use batch mode with multiple files (one sheet per file)
`,
  },
  {
    id: 'faq-undo',
    title: 'Undo / Redo',
    category: 'faq',
    content: `
## Is there Undo?

Yes. On the pipeline page you can undo or redo operation add/edit/remove. Use the toolbar buttons or keyboard shortcuts.

After you run and go to results, you can go back to the pipeline to change operations and run again.
`,
  },
]

/** Simple markdown-like renderer: headings, bold, code, lists. Content is static so safe to render. */
function renderMarkdown(content: string): string {
  const out = content
    .trim()
    .replace(/^### (.*)$/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
    .replace(/^## (.*)$/gim, '<h2 class="text-xl font-semibold mb-3 mt-6">$1</h2>')
    .replace(/^# (.*)$/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/^- (.*)$/gim, '<li class="ml-4">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br />')
  return '<p class="mb-4">' + out + '</p>'
}

export function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>('getting-started')

  const filteredDocs = useMemo(
    () =>
      DOCUMENTATION.filter(
        (doc) =>
          searchQuery === '' ||
          doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.content.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  )

  const docsByCategory = (category: string) =>
    filteredDocs.filter((doc) => doc.category === category)

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📚 Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about using the Excel Data Transformation Tool
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full mb-4">
          <TabsTrigger value="getting-started" className="gap-1 sm:gap-2">
            <Book className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Getting Started</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-1 sm:gap-2">
            <Code className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Operations</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1 sm:gap-2">
            <Video className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1 sm:gap-2">
            <Code className="h-4 w-4 shrink-0" />
            API
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1 sm:gap-2">
            <HelpCircle className="h-4 w-4 shrink-0" />
            FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="getting-started" className="space-y-4 mt-4">
          {docsByCategory('getting-started').length === 0 ? (
            <p className="text-muted-foreground">No matching documents.</p>
          ) : (
            docsByCategory('getting-started').map((doc) => (
              <Card key={doc.id}>
                <CardHeader>
                  <CardTitle>{doc.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Detailed guides for all 17 transformation operations
          </p>
          {docsByCategory('operations').length === 0 ? (
            <p className="text-muted-foreground">No matching documents.</p>
          ) : (
            docsByCategory('operations').map((doc) => (
              <Card key={doc.id}>
                <CardHeader>
                  <CardTitle>{doc.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4 mt-4">
          {docsByCategory('features').map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                />
              </CardContent>
            </Card>
          ))}
          {docsByCategory('features').length === 0 && (
            <p className="text-muted-foreground">No matching documents.</p>
          )}
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-4">
          {docsByCategory('api').map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                />
              </CardContent>
            </Card>
          ))}
          {docsByCategory('api').length === 0 && (
            <p className="text-muted-foreground">No matching documents.</p>
          )}
        </TabsContent>

        <TabsContent value="faq" className="space-y-4 mt-4">
          {docsByCategory('faq').map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle className="text-lg">{doc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                />
              </CardContent>
            </Card>
          ))}
          {docsByCategory('faq').length === 0 && (
            <p className="text-muted-foreground">No matching documents.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

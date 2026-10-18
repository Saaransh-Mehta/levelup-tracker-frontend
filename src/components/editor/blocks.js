import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Minus, Pilcrow, SquareCode, TextQuote,
} from 'lucide-react'

// Blocks offered by the "/" menu. `md` is the markdown shortcut that does the same thing.
export const BLOCKS = [
  { id: 'text', label: 'Text', hint: 'Plain paragraph', icon: Pilcrow, keywords: 'paragraph p plain',
    run: (c) => c.setParagraph().run() },
  { id: 'h1', label: 'Heading 1', hint: 'Big section title', icon: Heading1, md: '#', keywords: 'title h1',
    run: (c) => c.setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Heading 2', hint: 'Medium section title', icon: Heading2, md: '##', keywords: 'subtitle h2',
    run: (c) => c.setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Heading 3', hint: 'Small section title', icon: Heading3, md: '###', keywords: 'h3',
    run: (c) => c.setHeading({ level: 3 }).run() },
  { id: 'todo', label: 'To-do list', hint: 'Steps you can tick off', icon: ListTodo, md: '[ ]',
    keywords: 'task checkbox milestone check', run: (c) => c.toggleTaskList().run() },
  { id: 'bullet', label: 'Bulleted list', hint: 'Simple list', icon: List, md: '-', keywords: 'ul unordered',
    run: (c) => c.toggleBulletList().run() },
  { id: 'number', label: 'Numbered list', hint: 'List with numbers', icon: ListOrdered, md: '1.',
    keywords: 'ol ordered', run: (c) => c.toggleOrderedList().run() },
  { id: 'quote', label: 'Quote', hint: 'Highlight a thought', icon: TextQuote, md: '>', keywords: 'blockquote',
    run: (c) => c.toggleBlockquote().run() },
  { id: 'divider', label: 'Divider', hint: 'Separate sections', icon: Minus, md: '---', keywords: 'hr line rule',
    run: (c) => c.setHorizontalRule().run() },
  { id: 'code', label: 'Code', hint: 'Monospaced block', icon: SquareCode, md: '```', keywords: 'pre snippet',
    run: (c) => c.toggleCodeBlock().run() },
]

export const filterBlocks = (query) => {
  const q = query.trim().toLowerCase()
  if (!q) return BLOCKS
  return BLOCKS.filter((b) => `${b.label} ${b.keywords}`.toLowerCase().includes(q))
}

// Counts to-dos in an editor JSON document. Mirrors countTasks on the server.
export const countTasks = (node, tally = { done: 0, total: 0 }) => {
  if (!node || typeof node !== 'object') return tally
  if (node.type === 'taskItem') {
    tally.total += 1
    if (node.attrs?.checked) tally.done += 1
  }
  if (Array.isArray(node.content)) node.content.forEach((child) => countTasks(child, tally))
  return tally
}

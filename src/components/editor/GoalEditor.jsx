import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { AnimatePresence, motion } from 'motion/react'
import { Bold, Code, Heading2, Italic, Strikethrough, TextQuote } from 'lucide-react'
import { SlashCommand } from './SlashCommand'
import { filterBlocks } from './blocks'

const MENU_HEIGHT = 340

function SlashMenu({ menu, active, onHover }) {
  const itemRefs = useRef([])

  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const rect = menu.rect
  if (!rect) return null
  const flip = rect.bottom + MENU_HEIGHT > window.innerHeight
  const style = flip
    ? { left: rect.left, bottom: window.innerHeight - rect.top + 6 }
    : { left: rect.left, top: rect.bottom + 6 }

  return (
    <motion.div
      className="slash-menu"
      style={{ ...style, transformOrigin: flip ? 'bottom left' : 'top left' }}
      initial={{ opacity: 0, scale: 0.95, y: flip ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      role="listbox"
      aria-label="Insert block"
    >
      {menu.items.length === 0 ? (
        <p className="slash-empty">No matching blocks</p>
      ) : (
        <>
          <p className="slash-heading">Blocks</p>
          {menu.items.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                ref={(el) => (itemRefs.current[i] = el)}
                type="button"
                role="option"
                aria-selected={i === active}
                className="slash-item"
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  menu.command(item)
                }}
              >
                {i === active && (
                  <motion.span layoutId="slash-active" className="slash-active"
                    transition={{ type: 'spring', stiffness: 700, damping: 45 }} />
                )}
                <span className="slash-icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="slash-text">
                  <span className="slash-label">{item.label}</span>
                  <span className="slash-hint">{item.hint}</span>
                </span>
                {item.md && <kbd className="slash-md">{item.md}</kbd>}
              </button>
            )
          })}
        </>
      )}
    </motion.div>
  )
}

function FormatBar({ editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h2: e.isActive('heading', { level: 2 }),
      quote: e.isActive('blockquote'),
    }),
  })

  const buttons = [
    { key: 'bold', label: 'Bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'Italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'strike', label: 'Strikethrough', icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run() },
    { key: 'code', label: 'Inline code', icon: Code, run: () => editor.chain().focus().toggleCode().run() },
    { key: 'h2', label: 'Heading', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: 'quote', label: 'Quote', icon: TextQuote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ]

  return (
    <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }} className="bubble-menu">
      {buttons.map(({ key, label, icon: Icon, run }, i) => (
        <span key={key} className="bubble-group">
          {i === 4 && <span className="bubble-sep" aria-hidden="true" />}
          <button type="button" className={`bubble-btn ${state[key] ? 'is-on' : ''}`} onClick={run}
            aria-label={label} aria-pressed={state[key]} title={label}>
            <Icon size={16} />
          </button>
        </span>
      ))}
    </BubbleMenu>
  )
}

// A Notion-style block editor for a goal's note. Calls onChange with the JSON document.
function GoalEditor({ content, onChange, autoFocus = false }) {
  const [menu, setMenu] = useState(null)
  const [active, setActive] = useState(0)
  const live = useRef({ menu: null, active: 0, onChange })

  useEffect(() => {
    live.current = { menu, active, onChange }
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? `Heading ${node.attrs.level}` : "Write something, or type '/' for blocks",
      }),
      SlashCommand.configure({
        items: filterBlocks,
        onOpen: (props) => {
          setActive(0)
          setMenu({ items: props.items, rect: props.clientRect?.(), command: props.command })
        },
        onUpdate: (props) => {
          setActive(0)
          setMenu({ items: props.items, rect: props.clientRect?.(), command: props.command })
        },
        onClose: () => setMenu(null),
        onKeyDown: (event) => {
          const { menu: m, active: a } = live.current
          if (!m) return false
          const count = m.items.length
          if (event.key === 'ArrowDown' && count) {
            setActive((a + 1) % count)
            return true
          }
          if (event.key === 'ArrowUp' && count) {
            setActive((a - 1 + count) % count)
            return true
          }
          if (event.key === 'Enter' && count) {
            m.command(m.items[a])
            return true
          }
          if (event.key === 'Escape') {
            setMenu(null)
            return true
          }
          return false
        },
      }),
    ],
    content,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'goal-doc', 'aria-label': 'Goal notes' } },
    onUpdate: ({ editor: e }) => live.current.onChange(e.getJSON()),
  })

  if (!editor) return null

  return (
    <div className="goal-editor">
      <EditorContent editor={editor} />
      <FormatBar editor={editor} />
      {createPortal(
        <AnimatePresence>
          {menu && <SlashMenu key="slash" menu={menu} active={active} onHover={setActive} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export default GoalEditor

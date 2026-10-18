import { Extension } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'

// Opens the block menu when "/" is typed. The menu itself is React state in GoalEditor;
// this extension only reports open/update/close and forwards key presses to it.
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      items: () => [],
      onOpen: () => {},
      onUpdate: () => {},
      onClose: () => {},
      onKeyDown: () => false,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommand'),
        char: '/',
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => this.options.items(query),
        command: ({ editor, range, props }) => props.run(editor.chain().focus().deleteRange(range)),
        render: () => ({
          onStart: (props) => this.options.onOpen(props),
          onUpdate: (props) => this.options.onUpdate(props),
          onExit: () => this.options.onClose(),
          onKeyDown: ({ event }) => this.options.onKeyDown(event),
        }),
      }),
    ]
  },
})

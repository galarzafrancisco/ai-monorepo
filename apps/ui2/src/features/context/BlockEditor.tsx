import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  linkPlugin,
  codeBlockPlugin,
  tablePlugin,
  imagePlugin,
  codeMirrorPlugin
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { content } from './content'


export function BlockEditor() {
  return <MDXEditor markdown={content} plugins={[
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    codeBlockPlugin(),
    markdownShortcutPlugin(),
    tablePlugin(),
    imagePlugin(),
    codeMirrorPlugin(),
  ]} />
}
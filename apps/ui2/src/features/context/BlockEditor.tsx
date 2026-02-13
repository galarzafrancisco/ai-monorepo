import { MDXEditor, headingsPlugin } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

export function BlockEditor() {
  return <MDXEditor markdown={'# Hello World'} plugins={[headingsPlugin()]} />
}
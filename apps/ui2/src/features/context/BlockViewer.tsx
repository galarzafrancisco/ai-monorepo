import { content } from './content'

import React, { useMemo } from "react";
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import './md.css';

const md = new MarkdownIt({
  html: false,      // set true ONLY if you trust content
  linkify: true,
  typographer: true,
})
  .use(taskLists, { enabled: true, label: true, labelAfter: true })
  .use(footnote);

// open external links in new tab
const defaultRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet("href") || "";
  const isExternal = /^(https?:)?\/\//i.test(href);
  if (isExternal) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultRender(tokens, idx, options, env, self);
};

export function MarkdownViewer({ markdown }: { markdown: string }) {
  const html = useMemo(() => md.render(markdown), [markdown]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function BlockViewer() {
  return (
    <MarkdownViewer markdown={content} />
  )
}

import { createElement, Fragment } from 'react';

function parseMarkdownBlocks(source) {
  const normalised = String(source ?? '').replace(/\r\n?/g, '\n');
  const lines = normalised.split('\n');
  const blocks = [];
  let index = 0;

  const isHorizontalRule = (line) => /^(?:\s*)([-*_])(?:\s*\1){2,}\s*$/.test(line);
  const isListLine = (line) => /^(\s*)(?:[-*+]|\d+\.)\s+/.test(line);
  const isOrdered = (marker) => /\d+\./.test(marker);

  while (index < lines.length) {
    const rawLine = lines[index];
    if (rawLine.trim() === '') {
      index += 1;
      continue;
    }

    if (isHorizontalRule(rawLine)) {
      blocks.push({ type: 'thematicBreak' });
      index += 1;
      continue;
    }

    if (rawLine.startsWith('```')) {
      const language = rawLine.slice(3).trim() || null;
      index += 1;
      const codeLines = [];
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].startsWith('```')) {
        index += 1;
      }
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 6),
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(rawLine)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    const listMatch = rawLine.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = isOrdered(listMatch[2]);
      const items = [];

      while (index < lines.length) {
        const current = lines[index];
        const currentMatch = current.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!currentMatch) {
          break;
        }
        const currentOrdered = isOrdered(currentMatch[2]);
        if (currentOrdered !== ordered) {
          break;
        }

        let itemContent = currentMatch[3];
        index += 1;

        const continuation = [];
        while (index < lines.length && lines[index].startsWith('    ')) {
          continuation.push(lines[index].slice(4));
          index += 1;
        }

        if (continuation.length > 0) {
          itemContent = `${itemContent}\n${continuation.join('\n')}`;
        }

        items.push(itemContent);
      }

      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines = [rawLine];
    index += 1;
    while (index < lines.length && lines[index].trim() !== '') {
      if (
        isHorizontalRule(lines[index]) ||
        lines[index].startsWith('```') ||
        /^>\s?/.test(lines[index]) ||
        /^(#{1,6})\s+/.test(lines[index]) ||
        isListLine(lines[index])
      ) {
        break;
      }
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks;
}

function nextSpecialIndex(remaining) {
  const match = remaining.slice(1).search(/[!\[`*_\\\n]/);
  return match === -1 ? -1 : match + 1;
}

function renderElement(tag, key, props, children, components) {
  const Component = components && components[tag];
  const elementProps = { ...props, key };
  if (Component) {
    return createElement(Component, elementProps, children);
  }
  return createElement(tag, elementProps, children);
}

function renderInline(content, keyPrefix, components) {
  const nodes = [];
  let index = 0;
  let key = 0;

  const pushNode = (node) => {
    nodes.push(node);
    key += 1;
  };

  while (index < content.length) {
    const remaining = content.slice(index);

    if (remaining.startsWith('\\') && remaining.length > 1) {
      pushNode(remaining[1]);
      index += 2;
      continue;
    }

    if (remaining[0] === '\n') {
      pushNode(renderElement('br', `${keyPrefix}-br-${key}`, {}, undefined, components));
      index += 1;
      continue;
    }

    if (remaining.startsWith('![')) {
      const endAlt = remaining.indexOf(']');
      const startUrl = remaining.indexOf('(', endAlt);
      const endUrl = remaining.indexOf(')', startUrl);
      if (endAlt !== -1 && startUrl !== -1 && endUrl !== -1) {
        const alt = remaining.slice(2, endAlt);
        const url = remaining.slice(startUrl + 1, endUrl);
        pushNode(
          renderElement(
            'img',
            `${keyPrefix}-img-${key}`,
            { src: url, alt },
            undefined,
            components,
          ),
        );
        index += endUrl + 1;
        continue;
      }
    }

    if (remaining.startsWith('[')) {
      const endLabel = remaining.indexOf(']');
      const startHref = remaining.indexOf('(', endLabel);
      const endHref = remaining.indexOf(')', startHref);
      if (endLabel !== -1 && startHref !== -1 && endHref !== -1) {
        const label = remaining.slice(1, endLabel);
        const href = remaining.slice(startHref + 1, endHref);
        pushNode(
          renderElement(
            'a',
            `${keyPrefix}-link-${key}`,
            { href },
            renderInline(label, `${keyPrefix}-link-${key}`, components),
            components,
          ),
        );
        index += endHref + 1;
        continue;
      }
    }

    if (remaining.startsWith('**')) {
      const end = remaining.indexOf('**', 2);
      if (end > 2) {
        const inner = remaining.slice(2, end);
        pushNode(
          renderElement(
            'strong',
            `${keyPrefix}-strong-${key}`,
            {},
            renderInline(inner, `${keyPrefix}-strong-${key}`, components),
            components,
          ),
        );
        index += end + 2;
        continue;
      }
    }

    if (remaining.startsWith('__')) {
      const end = remaining.indexOf('__', 2);
      if (end > 2) {
        const inner = remaining.slice(2, end);
        pushNode(
          renderElement(
            'strong',
            `${keyPrefix}-strong-${key}`,
            {},
            renderInline(inner, `${keyPrefix}-strong-${key}`, components),
            components,
          ),
        );
        index += end + 2;
        continue;
      }
    }

    if (remaining.startsWith('*')) {
      const end = remaining.indexOf('*', 1);
      if (end > 1) {
        const inner = remaining.slice(1, end);
        pushNode(
          renderElement(
            'em',
            `${keyPrefix}-em-${key}`,
            {},
            renderInline(inner, `${keyPrefix}-em-${key}`, components),
            components,
          ),
        );
        index += end + 1;
        continue;
      }
    }

    if (remaining.startsWith('_')) {
      const end = remaining.indexOf('_', 1);
      if (end > 1) {
        const inner = remaining.slice(1, end);
        pushNode(
          renderElement(
            'em',
            `${keyPrefix}-em-${key}`,
            {},
            renderInline(inner, `${keyPrefix}-em-${key}`, components),
            components,
          ),
        );
        index += end + 1;
        continue;
      }
    }

    if (remaining.startsWith('`')) {
      const end = remaining.indexOf('`', 1);
      if (end > 1) {
        const code = remaining.slice(1, end);
        pushNode(
          renderElement(
            'code',
            `${keyPrefix}-code-${key}`,
            {},
            code,
            components,
          ),
        );
        index += end + 1;
        continue;
      }
    }

    const specialIndex = nextSpecialIndex(remaining);
    if (specialIndex === -1) {
      pushNode(remaining);
      break;
    }

    const plainText = remaining.slice(0, specialIndex);
    pushNode(plainText);
    index += specialIndex;
  }

  return nodes;
}

function renderBlocks(blocks, components, prefix) {
  return blocks.map((block, blockIndex) => {
    const key = `${prefix}-${blockIndex}`;
    switch (block.type) {
      case 'heading': {
        const tag = `h${block.level}`;
        return renderElement(
          tag,
          key,
          {},
          renderInline(block.text, `${key}-inline`, components),
          components,
        );
      }
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        return renderElement(
          tag,
          key,
          {},
          block.items.map((item, itemIndex) =>
            renderElement(
              'li',
              `${key}-item-${itemIndex}`,
              {},
              renderInline(item, `${key}-item-${itemIndex}`, components),
              components,
            ),
          ),
          components,
        );
      }
      case 'code': {
        return renderElement(
          'pre',
          key,
          {},
          renderElement(
            'code',
            `${key}-code`,
            block.language ? { className: `language-${block.language}` } : {},
            block.code,
            components,
          ),
          components,
        );
      }
      case 'blockquote': {
        const nested = parseMarkdownBlocks(block.content);
        return renderElement(
          'blockquote',
          key,
          {},
          renderBlocks(nested, components, `${key}-blockquote`),
          components,
        );
      }
      case 'thematicBreak':
        return renderElement('hr', key, {}, undefined, components);
      case 'paragraph':
      default:
        return renderElement(
          'p',
          key,
          {},
          renderInline(block.text, `${key}-inline`, components),
          components,
        );
    }
  });
}

export default function ReactMarkdown(props) {
  const { children = '', components } = props;
  const blocks = parseMarkdownBlocks(children);
  return createElement(Fragment, null, renderBlocks(blocks, components ?? {}, 'block'));
}

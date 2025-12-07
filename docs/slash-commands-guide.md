# Slash Commands User Guide

Wikiroo's rich text editor supports slash commands for quick markdown formatting. Simply type `/` to bring up the command menu and select a formatting option.

## How to Use Slash Commands

1. While editing page content, type `/` at the beginning of a line or after whitespace
2. A command menu will appear showing available formatting options
3. Type to filter commands (e.g., `/h` to see heading options)
4. Use **Arrow Keys** (↑/↓) to navigate the menu
5. Press **Enter** or **Tab** to insert the selected command
6. Press **Escape** to close the menu without inserting

## Available Commands

### Headings

Create section headings at different levels:

- **/h1** - Heading 1 (largest)
  - Inserts: `# Your heading`

- **/h2** - Heading 2
  - Inserts: `## Your heading`

- **/h3** - Heading 3
  - Inserts: `### Your heading`

- **/h4** - Heading 4
  - Inserts: `#### Your heading`

- **/h5** - Heading 5
  - Inserts: `##### Your heading`

- **/h6** - Heading 6 (smallest)
  - Inserts: `###### Your heading`

### Text Formatting

Format inline text:

- **/bold** - Bold text
  - Inserts: `**text**`
  - Example: **bold text**

- **/italic** - Italic text
  - Inserts: `_text_`
  - Example: _italic text_

- **/code** - Inline code
  - Inserts: `` `code` ``
  - Example: `inline code`

### Code Blocks

- **/codeblock** - Multi-line code block
  - Inserts:
    ```
    ```
    your code here
    ```
    ```

### Lists

Create bullet or numbered lists:

- **/list** - Bullet list
  - Inserts: `- item`
  - Example:
    - First item
    - Second item

- **/numbered** - Numbered list
  - Inserts: `1. item`
  - Example:
    1. First item
    2. Second item

### Tables

- **/table** - Insert a table template
  - Inserts:
    ```
    | Column 1 | Column 2 |
    | --- | --- |
    | | |
    ```
  - Fill in the cells after insertion

### Other Elements

- **/quote** - Block quote
  - Inserts: `> quote text`
  - Example:
    > This is a quoted block

- **/divider** - Horizontal divider
  - Inserts: `---`
  - Creates a horizontal line separator

- **/link** - Insert a link
  - Inserts: `[text](url)`
  - Replace "text" and "url" with your content

## Keyboard Shortcuts

When the slash command menu is open:

- **↑ (Up Arrow)** - Move selection up
- **↓ (Down Arrow)** - Move selection down
- **Enter** - Insert selected command
- **Tab** - Insert selected command
- **Escape** - Close menu without inserting
- **Backspace** - Close menu if you delete back to the `/`

## Tips

- The menu filters as you type (e.g., `/h` shows only heading commands)
- Commands work at the start of a line or after whitespace
- The live preview on the right updates as you type
- You can always manually type markdown without using slash commands

## Markdown Preview

The editor shows a live preview of your markdown on the right side. This helps you see how your content will be formatted before saving.

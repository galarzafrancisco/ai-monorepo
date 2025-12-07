# Nested Pages User Guide

Wikiroo supports organizing pages in a hierarchical structure using nested pages. This allows you to create parent-child relationships between pages for better organization.

## Creating Nested Pages

When creating or editing a page, you can set its parent page:

1. Navigate to the page creation or edit form
2. Look for the **Parent Page** dropdown selector
3. Select a parent page from the list, or leave it empty for a root-level page
4. Save the page

The page will now appear as a child of the selected parent in the page tree.

## Navigating the Page Tree

The page tree in the sidebar shows your pages in a hierarchical structure:

- **Root pages** appear at the top level
- **Child pages** are indented under their parents
- Pages within the same level are sorted by their order value

### Expanding and Collapsing

- Click the **▶** (arrow) button to expand a parent page and show its children
- Click the **▼** (down arrow) button to collapse a parent page and hide its children
- By default, all pages are expanded when you load the page

### Breadcrumb Navigation

When viewing a nested page, breadcrumbs appear at the top showing the full path:

```
Home > Parent Page > Child Page > Current Page
```

Click any breadcrumb to navigate to that level in the hierarchy.

## Reorganizing Pages

You can change the parent-child relationships at any time:

1. Edit the page you want to move
2. Change the **Parent Page** selector to a new parent (or set to empty for root level)
3. Save the page

The page tree will automatically update to reflect the new structure.

### Important Notes

- **No circular references**: You cannot set a page as its own parent, or create circular chains (e.g., A → B → C → A)
- **Orphaned pages**: If a parent page is deleted, its children become root-level pages
- **Order**: Pages at the same level are sorted by their order field (editable in the page form)

## Best Practices

- Use nested pages to group related content
- Keep the hierarchy shallow (3-4 levels max) for easier navigation
- Use descriptive page titles that make sense in the tree structure
- Consider the order field to prioritize important pages

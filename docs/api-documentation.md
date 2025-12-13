# Wikiroo API Documentation

This document describes the Wikiroo API endpoints, including recent additions for nested pages functionality.

## Base URL

```
http://localhost:3000/wikiroo
```

## Endpoints

### Pages

#### List All Pages

```http
GET /pages
```

Query Parameters:
- `tag` (optional): Filter pages by tag name

Response: `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Page Title",
    "author": "Author Name",
    "parentId": "parent-uuid-or-null",
    "order": 0,
    "tags": [
      {
        "id": "tag-uuid",
        "name": "tag-name",
        "color": "#hexcolor"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Get Page Tree

**New endpoint for hierarchical page structure**

```http
GET /pages/tree
```

Response: `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Root Page",
    "author": "Author Name",
    "parentId": null,
    "order": 0,
    "children": [
      {
        "id": "child-uuid",
        "title": "Child Page",
        "author": "Author Name",
        "parentId": "uuid",
        "order": 0,
        "children": [],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Get Single Page

```http
GET /pages/:id
```

Response: `200 OK`
```json
{
  "id": "uuid",
  "title": "Page Title",
  "content": "Markdown content here...",
  "author": "Author Name",
  "parentId": "parent-uuid-or-null",
  "order": 0,
  "tags": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Errors:
- `404 Not Found` - Page not found

#### Create Page

```http
POST /pages
```

Request Body:
```json
{
  "title": "New Page",
  "content": "Page content in markdown",
  "author": "Author Name",
  "parentId": "parent-uuid-or-null",
  "tagNames": ["tag1", "tag2"]
}
```

Response: `201 Created`
```json
{
  "id": "new-uuid",
  "title": "New Page",
  "content": "Page content in markdown",
  "author": "Author Name",
  "parentId": "parent-uuid-or-null",
  "order": 1,
  "tags": [
    {
      "id": "tag-uuid",
      "name": "tag1",
      "color": "#color"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Errors:
- `400 Bad Request` - Parent page not found
- `400 Bad Request` - Circular reference detected

#### Update Page

```http
PATCH /pages/:id
```

Request Body (all fields optional):
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "author": "Updated Author",
  "parentId": "new-parent-uuid-or-null",
  "order": 5,
  "tagNames": ["tag1", "tag2"]
}
```

Response: `200 OK` - Returns updated page

Errors:
- `404 Not Found` - Page not found
- `400 Bad Request` - Parent page not found
- `400 Bad Request` - Circular reference detected (cannot set page as its own parent or create circular chains)

#### Reorder Page

**New endpoint for changing page order**

```http
PATCH /pages/:id/reorder
```

Request Body:
```json
{
  "order": 3
}
```

Response: `200 OK` - Returns updated page

Errors:
- `404 Not Found` - Page not found

#### Move Page

**New endpoint for changing page parent**

```http
PATCH /pages/:id/move
```

Request Body:
```json
{
  "parentId": "new-parent-uuid-or-null"
}
```

Response: `200 OK` - Returns updated page with new order calculated automatically

Errors:
- `404 Not Found` - Page not found
- `400 Bad Request` - Parent page not found
- `400 Bad Request` - Circular reference detected

#### Append to Page

```http
POST /pages/:id/append
```

Request Body:
```json
{
  "content": "Additional content to append"
}
```

Response: `200 OK` - Returns updated page

#### Delete Page

```http
DELETE /pages/:id
```

Response: `204 No Content`

Errors:
- `404 Not Found` - Page not found

**Note:** Deleting a parent page does not delete its children. Children will have their `parentId` set to `null`.

### Tags

#### Get All Tags

```http
GET /tags
```

Response: `200 OK`
```json
[
  {
    "id": "tag-uuid",
    "name": "tag-name",
    "color": "#hexcolor",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Tag

```http
POST /tags
```

Request Body:
```json
{
  "name": "new-tag"
}
```

Response: `201 Created` - Returns created or existing tag

#### Add Tag to Page

```http
POST /pages/:id/tags
```

Request Body:
```json
{
  "name": "tag-name",
  "color": "#hexcolor"
}
```

Response: `200 OK` - Returns updated page with tags

#### Remove Tag from Page

```http
DELETE /pages/:pageId/tags/:tagId
```

Response: `200 OK` - Returns updated page

**Note:** If a tag becomes orphaned (no pages using it), it is automatically soft-deleted.

## Schema Changes

### New Fields in Pages

- **parentId** (`uuid`, nullable): ID of the parent page, or `null` for root-level pages
- **order** (`integer`, default: 0): Order within siblings for sorting

### Indexes

The following indexes have been added for performance:
- Composite index on `(parent_id, order)` - Optimizes sibling queries

### Validation Rules

- A page cannot be its own parent
- Circular references are prevented (e.g., A → B → C → A)
- When creating a child page, if siblings exist, the new page's order is set to `max(sibling.order) + 1`
- When moving a page to a new parent, its order is recalculated

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| PAGE_NOT_FOUND | Page not found | The requested page does not exist |
| PARENT_PAGE_NOT_FOUND | Parent page not found | The specified parent page does not exist |
| CIRCULAR_REFERENCE | Circular reference | Cannot create circular parent-child relationships |

## Interactive Documentation

For interactive API documentation with request/response examples, visit:

```
http://localhost:3000/api/v1/docs
```

This Swagger UI is automatically generated from the API decorators and stays in sync with the code.

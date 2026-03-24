# How to Integrate Backend Search with Command Palette

This guide explains how to integrate backend search functionality with the frontend command palette (Alfred). This pattern allows users to search for resources (tasks, context blocks, etc.) directly from the command palette.

## Overview

The command palette integration follows this flow:
1. Backend exposes a search endpoint (REST API)
2. Generated TypeScript client provides type-safe access
3. Frontend command palette fetches and displays results
4. User navigates to selected resource

## Prerequisites

- Backend service with search capability
- DTOs for search query and results
- Generated TypeScript client (`@taico/client`)

## Step-by-Step Implementation

### 1. Backend: Ensure Search Endpoint Exists

Your backend should have a search endpoint. Example from `tasks.controller.ts`:

```typescript
@Get('search/query')
@ApiOperation({ summary: 'Search tasks by query string' })
@ApiOkResponse({
  type: [TaskSearchResultDto],
  description: 'Search results sorted by relevance',
})
async searchTasks(
  @Query() query: SearchTasksQueryDto,
): Promise<TaskSearchResultDto[]> {
  const results = await this.TasksService.searchTasks({
    query: query.query,
    limit: query.limit,
    threshold: query.threshold,
  });

  return results.map((result) => ({
    id: result.id,
    name: result.name,
    score: result.score,
  }));
}
```

**Key DTOs:**

```typescript
// Query DTO (apps/backend/src/tasks/dto/search-tasks-query.dto.ts)
export class SearchTasksQueryDto {
  @ApiProperty({ description: 'Search query string' })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum score threshold (0-1)',
    default: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}

// Result DTO (apps/backend/src/tasks/dto/task-search-result.dto.ts)
export class TaskSearchResultDto {
  @ApiProperty({ description: 'Task ID' })
  id: string;

  @ApiProperty({ description: 'Task name/title' })
  name: string;

  @ApiProperty({ description: 'Match confidence score (0-1)' })
  score: number;
}
```

### 2. Generate TypeScript Client

After defining your DTOs and endpoint:

```bash
npm run build:dev
```

This regenerates `packages/client` with type-safe methods. Verify the method exists:

```typescript
// packages/client/src/client/services/TaskService.ts
public static tasksControllerSearchTasks(
  query: string,
  limit: number = 10,
  threshold: number = 0.3,
): CancelablePromise<Array<TaskSearchResultDto>>
```

### 3. Frontend: Modify CommandPalette Component

Location: `apps/ui2/src/ui/components/CommandPalette/CommandPalette.tsx`

**3.1. Add Imports**

```typescript
import { useNavigate } from 'react-router-dom';
import { TaskService, type TaskSearchResultDto } from '@taico/client';

// Define union type for palette items
type PaletteItem =
  | { type: 'command'; command: Command }
  | { type: 'task'; task: TaskSearchResultDto };
```

**3.2. Add State**

```typescript
export function CommandPalette() {
  const navigate = useNavigate();
  const [taskResults, setTaskResults] = useState<TaskSearchResultDto[]>([]);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // ... existing state
}
```

**3.3. Add Search Effect (with Debouncing)**

```typescript
// Search tasks when input changes (with debounce)
useEffect(() => {
  // Clear previous timeout
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }

  // Clear task results if no input
  if (!searchTerm) {
    setTaskResults([]);
    return;
  }

  // Debounce task search
  searchTimeoutRef.current = window.setTimeout(async () => {
    setIsSearchingTasks(true);
    try {
      const results = await TaskService.tasksControllerSearchTasks(
        searchTerm,
        5,    // limit
        0.1   // threshold (lower = more permissive)
      );
      setTaskResults(results);
    } catch (err) {
      console.error('Failed to search tasks:', err);
      setTaskResults([]);
    } finally {
      setIsSearchingTasks(false);
    }
  }, 200); // 200ms debounce

  return () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };
}, [searchTerm]);
```

**3.4. Merge Results (Commands First, Then Resources)**

```typescript
// Combine commands and tasks into a single list
// Commands come first (higher priority), then task results
const allItems: PaletteItem[] = [
  ...filteredCommands.map((cmd): PaletteItem => ({
    type: 'command',
    command: cmd
  })),
  ...taskResults.map((task): PaletteItem => ({
    type: 'task',
    task
  })),
];
```

**3.5. Update Execute Handler**

```typescript
function executeItem(item: PaletteItem) {
  if (item.type === 'command') {
    item.command.onSelect();
  } else {
    // Navigate to the resource
    navigate(`/tasks/${item.task.id}`);
  }
  closeAndReset();
}
```

**3.6. Update Rendering**

```typescript
{allItems.length > 0 && (
  <div className="command-palette-results">
    {allItems.map((item, index) => {
      if (item.type === 'command') {
        const cmd = item.command;
        return (
          <div
            key={`cmd-${cmd.id}`}
            className={`command-palette-item ${
              index === selectedIndex ? 'command-palette-item--selected' : ''
            }`}
            onClick={() => executeItem(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="command-palette-item-label">
              {highlightMatch(cmd.label)}
            </span>
            {cmd.description && (
              <span className="command-palette-item-description">
                {cmd.description}
              </span>
            )}
          </div>
        );
      } else {
        const task = item.task;
        return (
          <div
            key={`task-${task.id}`}
            className={`command-palette-item command-palette-item--task ${
              index === selectedIndex ? 'command-palette-item--selected' : ''
            }`}
            onClick={() => executeItem(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="command-palette-item-label">
              {highlightMatch(task.name)}
            </span>
            <span className="command-palette-item-description">Task</span>
          </div>
        );
      }
    })}
  </div>
)}

{input && allItems.length === 0 && !isSearchingTasks && (
  <div className="command-palette-no-results">
    No results found
  </div>
)}

{isSearchingTasks && (
  <div className="command-palette-searching">
    Searching tasks...
  </div>
)}
```

**3.7. Update Cleanup**

```typescript
function closeAndReset() {
  setIsOpen(false);
  setInput('');
  setSelectedIndex(0);
  setTaskResults([]);
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }
}
```

### 4. Add CSS (Optional Styling)

Location: `apps/ui2/src/ui/components/CommandPalette/CommandPalette.css`

```css
.command-palette-searching {
  padding: var(--space-4) var(--space-5);
  color: var(--text-muted);
  font-size: var(--fs-2);
}

.command-palette-item--task {
  /* Tasks have a subtle visual difference */
  opacity: 0.95;
}
```

## Key Design Decisions

### 1. Debouncing
Search is debounced (200ms) to avoid excessive API calls while typing.

### 2. Priority
Commands appear **before** resource results. This ensures exact command matches are always visible first.

### 3. Threshold
Lower threshold (0.1-0.3) makes search more permissive. Adjust based on your search algorithm.

### 4. Limit
Limit results to 5-10 to keep the UI clean and fast.

### 5. Type Safety
Using discriminated unions (`PaletteItem`) ensures type-safe handling of different result types.

## Testing

1. Build the project: `npm run build:dev`
2. Start dev server: `npm run dev:[1-5]`
3. Open command palette (Cmd+/ or Ctrl+/)
4. Type a search query
5. Verify:
   - Commands appear first
   - Resource results appear below
   - Pressing Enter navigates correctly
   - Debouncing works (network tab shows delayed requests)

## Extending to Other Resources

To add search for other resources (e.g., context blocks, agents):

1. Add backend search endpoint
2. Regenerate client: `npm run build:dev`
3. Add result type to `PaletteItem` union
4. Add state and search effect
5. Add to `allItems` array
6. Handle navigation in `executeItem`
7. Update rendering logic

Example for context blocks:

```typescript
type PaletteItem =
  | { type: 'command'; command: Command }
  | { type: 'task'; task: TaskSearchResultDto }
  | { type: 'context'; block: BlockSearchResultDto }; // New!

// ... in executeItem
else if (item.type === 'context') {
  navigate(`/context/${item.block.id}`);
}
```

## Common Issues

### Issue: Results not appearing
- Check network tab for API errors
- Verify threshold isn't too high
- Check console for JavaScript errors

### Issue: Slow search
- Reduce debounce time (but increases API load)
- Optimize backend search algorithm
- Add search result caching

### Issue: Navigation not working
- Verify route exists in router config
- Check navigate path matches your routing structure

## Related Documentation

- [Create a Controller](./create-a-controller.md)
- [Create a DTO](./create-a-dto.md)
- [Create a Frontend](./create-a-frontend.md)

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderKanban } from "lucide-react";
import "./ProjectPicker.css";

export type PickableProject = { id: string; slug: string; tagName: string };

/**
 * Searchable single-project picker. The Tasks board uses it as a filter
 * ("All projects"), the task view uses it to set a task's project ("No project").
 */
export function ProjectPicker({
  projects,
  projectsLoaded,
  selectedProjectId,
  onChange,
  emptyLabel,
  ariaLabel,
  className = "",
  disabled = false,
  inline = false,
}: {
  projects: PickableProject[];
  projectsLoaded: boolean;
  selectedProjectId: string | null;
  onChange: (projectId: string | null) => void;
  /** Label for the "no project" choice and for the trigger when nothing is selected. */
  emptyLabel: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  /** Opens the list in the flow instead of floating, for containers that clip overflow (popups). */
  inline?: boolean;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) {
      return projects;
    }
    return projects.filter((project) =>
      project.slug.toLowerCase().includes(normalizedQuery) ||
      project.tagName.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, projects]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const selectProject = (projectId: string | null) => {
    onChange(projectId);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className={`project-picker${inline ? " project-picker--inline" : ""} ${className}`} ref={rootRef}>
      <button
        className="project-picker__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={!projectsLoaded || disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <FolderKanban className="project-picker__icon" size={15} strokeWidth={1.75} absoluteStrokeWidth />
        <span className={`project-picker__label${selectedProject ? "" : " project-picker__label--empty"}`}>
          {selectedProject?.slug ?? emptyLabel}
        </span>
        <ChevronDown
          className={`project-picker__chevron${isOpen ? " project-picker__chevron--open" : ""}`}
          size={14}
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
      </button>

      {isOpen ? (
        <div className="project-picker__menu">
          <input
            ref={searchInputRef}
            className="project-picker__search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />
          <div className="project-picker__options" role="listbox" aria-label={ariaLabel}>
            <button
              className={`project-picker__option${selectedProjectId === null ? " project-picker__option--selected" : ""}`}
              type="button"
              role="option"
              aria-selected={selectedProjectId === null}
              onClick={() => selectProject(null)}
            >
              {emptyLabel}
            </button>
            {filteredProjects.length === 0 ? (
              <div className="project-picker__empty">No matching projects</div>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className={`project-picker__option${selectedProjectId === project.id ? " project-picker__option--selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={selectedProjectId === project.id}
                  onClick={() => selectProject(project.id)}
                >
                  <span className="project-picker__option-name">{project.slug}</span>
                  <span className="project-picker__option-tag">{project.tagName}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

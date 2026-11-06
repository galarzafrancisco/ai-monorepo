import { FileText, SquareCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getTaskStatusTag } from '../tasks/taskStatusTag';
import { parseTaicoUrl, taicoFallbackLabel, taicoRouteOf } from './taicoLinks';
import { useTaicoLink } from './taicoLinkStore';
import './TaicoLinkChip.css';

export interface TaicoLinkChipProps {
  url: string;
  /** Text to show instead of the task or block name, e.g. a link's own text. */
  label?: string;
}

/**
 * A link to a task or context block in this Taico, drawn with its name (and,
 * for a task, its status) and opened in the app. Not such a link: renders
 * nothing, so callers check with parseTaicoUrl first.
 */
export function TaicoLinkChip({ url, label }: TaicoLinkChipProps) {
  const ref = parseTaicoUrl(url);
  const entry = useTaicoLink(ref);
  if (!ref) return null;

  const Icon = ref.kind === 'task' ? SquareCheck : FileText;
  const ready = entry?.status === 'ready' ? entry : null;
  const name = label ?? ready?.title ?? taicoFallbackLabel(ref);
  const status = ready?.taskStatus ? getTaskStatusTag(ready.taskStatus).label : null;
  const kindLabel = ref.kind === 'task' ? 'Task' : 'Context block';
  const title =
    entry?.status === 'error'
      ? `${kindLabel} not found or not visible to you`
      : `${kindLabel}${ready ? `: ${ready.title}` : ''}${status ? ` (${status})` : ''}`;

  return (
    <Link
      className="taico-link-chip"
      to={taicoRouteOf(url)}
      title={title}
      data-kind={ref.kind}
      data-status={ready?.taskStatus}
      data-missing={entry?.status === 'error' ? 'true' : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className="taico-link-chip__icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span className="taico-link-chip__name">{name}</span>
      {status ? <span className="taico-link-chip__status">{status}</span> : null}
    </Link>
  );
}

import { DataRow, Text, Avatar } from '../../ui/primitives';
import { ContextBlockSummary } from './types';
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import type { ContextTagResponseDto } from "@taico/client/v2";

export function ContextBlockRow({ blockSummary, onClick }: { blockSummary: ContextBlockSummary; onClick?: () => void }) {
  const tags = blockSummary.tags.map((tag: ContextTagResponseDto) => ({ label: tag.name }));

  return (
    <DataRow
      leading={<Avatar name={blockSummary.createdBy || 'unknown'} size='lg' />}
      topRight={elapsedTime(blockSummary.createdAt)}
      tags={tags}
      onClick={onClick}
    >
      <Text className='pre'>
        #{blockSummary.id.slice(0, 6)}
      </Text>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          {blockSummary.title}
        </Text>
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        Created by {blockSummary.createdBy || 'unknown'}
      </div>
    </DataRow>
  );
}

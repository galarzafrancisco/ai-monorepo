import { DataRow, Text, Avatar } from '../../ui/primitives';
import { ContextBlock } from './types';
import { elapsedTime } from '../../shared/helpers/elapsedTime';

export function ContextBlockRow({ block, onClick }: { block: ContextBlock; onClick?: () => void }) {
  const tags = block.tags.map(tag => ({ label: tag.name }));

  return (
    <DataRow
      leading={<Avatar name={block.author} size='lg' />}
      topRight={elapsedTime(block.createdAt)}
      tags={tags}
      onClick={onClick}
    >
      <Text className='pre'>
        #{block.id.slice(0, 6)}
      </Text>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <Text weight="bold" size='3' tone='default'>
          {block.title}
        </Text>
      </div>
      <div style={{ fontSize: 12 }} className="text--tone-muted">
        Created by {block.author}
      </div>
    </DataRow>
  );
}

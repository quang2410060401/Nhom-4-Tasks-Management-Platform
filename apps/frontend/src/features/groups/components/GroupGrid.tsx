import type { GroupCardViewModel } from '../types';
import { GroupCard } from './GroupCard';

interface GroupGridProps {
  groups: GroupCardViewModel[];
}

export function GroupGrid({ groups }: GroupGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {groups.map((group) => (
        <GroupCard key={group._id} group={group} />
      ))}
    </div>
  );
}

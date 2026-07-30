import { Avatar, Tooltip } from 'antd';
import clsx from 'clsx';
import type { MemberListItemViewModel } from '../types';

interface MemberAvatarStackProps {
  members: MemberListItemViewModel[];
  maxVisible?: number;
  size?: number;
  className?: string;
}

export function MemberAvatarStack({
  members,
  maxVisible = 4,
  size = 40,
  className,
}: MemberAvatarStackProps) {
  const visibleMembers = members.slice(0, maxVisible);
  const overflowCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <div className={clsx('flex items-center', className)}>
      <div className="flex -space-x-3">
        {visibleMembers.map((member) => (
          <Tooltip key={member.userId} title={`${member.name} (${member.role})`}>
            <Avatar
              size={size}
              src={member.avatar ?? undefined}
              className="border-2 border-white bg-primary/15 text-primary shadow-sm"
            >
              {member.initials}
            </Avatar>
          </Tooltip>
        ))}
        {overflowCount > 0 && (
          <Avatar
            size={size}
            className="border-2 border-white bg-primary/15 text-xs font-bold text-primary shadow-sm"
          >
            +{overflowCount}
          </Avatar>
        )}
      </div>
    </div>
  );
}

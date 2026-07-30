import { useOutletContext } from 'react-router-dom';
import type { GroupDetail } from '@/types';

export type MemberRoleFilter = 'all' | 'admin' | 'member' | 'pending';

export interface GroupDetailLayoutContext {
  groupId: string;
  group: GroupDetail;
}

export function useGroupDetailLayoutContext() {
  return useOutletContext<GroupDetailLayoutContext>();
}

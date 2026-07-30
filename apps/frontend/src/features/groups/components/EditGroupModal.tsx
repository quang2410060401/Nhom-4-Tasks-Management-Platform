import type { GroupDetail } from '../types';
import { GroupEditorModal } from './GroupEditorModal';

interface EditGroupModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  group: GroupDetail;
}

export function EditGroupModal({ open, onClose, groupId, group }: EditGroupModalProps) {
  return (
    <GroupEditorModal open={open} onClose={onClose} mode="edit" groupId={groupId} group={group} />
  );
}

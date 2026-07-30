import { GroupEditorModal } from './GroupEditorModal';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ open, onClose }: CreateGroupModalProps) {
  return <GroupEditorModal open={open} onClose={onClose} mode="create" />;
}

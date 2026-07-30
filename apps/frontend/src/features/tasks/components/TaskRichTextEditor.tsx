import { useEffect, useRef } from 'react';
import { Button } from 'antd';
import {
  BoldOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import clsx from 'clsx';
import { extractPlainTextFromHtml } from '../utils';

interface TaskRichTextEditorProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function TaskRichTextEditor({
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
}: TaskRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const nextValue = value ?? '';
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  const emitChange = () => {
    const html = editorRef.current?.innerHTML ?? '';
    const plainText = extractPlainTextFromHtml(html);
    onChange?.(plainText ? html : null);
  };

  const toolbarButtons = [
    { icon: <BoldOutlined />, action: () => exec('bold'), label: 'Bold' },
    { icon: <ItalicOutlined />, action: () => exec('italic'), label: 'Italic' },
    { icon: <UnorderedListOutlined />, action: () => exec('insertUnorderedList'), label: 'Bullets' },
    { icon: <OrderedListOutlined />, action: () => exec('insertOrderedList'), label: 'Numbering' },
    {
      icon: <LinkOutlined />,
      action: () => {
        const href = window.prompt('Nhập liên kết');
        if (href) {
          exec('createLink', href);
        }
      },
      label: 'Link',
    },
    { icon: <CodeOutlined />, action: () => exec('formatBlock', 'pre'), label: 'Code block' },
  ];

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border bg-white',
        error ? 'border-red-300' : 'border-slate-200',
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        {toolbarButtons.map((button) => (
          <Button
            key={button.label}
            type="text"
            size="small"
            disabled={disabled}
            icon={button.icon}
            onMouseDown={(event) => {
              event.preventDefault();
              button.action();
              emitChange();
            }}
            className="h-7 w-7 rounded-lg text-slate-600"
          />
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        data-placeholder={placeholder ?? 'Nhập mô tả công việc'}
        className={clsx(
          'min-h-[112px] px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]',
          disabled && 'bg-slate-50 text-slate-400',
        )}
      />
      {error && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

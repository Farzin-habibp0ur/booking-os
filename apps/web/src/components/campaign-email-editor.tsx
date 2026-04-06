'use client';

import { useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

const EmailEditor = dynamic(() => import('react-email-editor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-2xl">
      <p className="text-sm text-slate-400">Loading editor...</p>
    </div>
  ),
});

interface CampaignEmailEditorProps {
  initialDesign?: object;
  onChange: (html: string, design: object) => void;
}

export default function CampaignEmailEditor({ initialDesign, onChange }: CampaignEmailEditorProps) {
  const editorRef = useRef<any>(null);
  const readyRef = useRef(false);

  const onReady = useCallback(() => {
    readyRef.current = true;
    if (editorRef.current?.editor && initialDesign) {
      editorRef.current.editor.loadDesign(initialDesign);
    }
  }, [initialDesign]);

  // Poll for changes on a debounced interval (the Unlayer API event support varies by version)
  useEffect(() => {
    const interval = setInterval(() => {
      if (readyRef.current && editorRef.current?.editor) {
        editorRef.current.editor.exportHtml((data: any) => {
          if (data?.html) {
            onChange(data.html, data.design);
          }
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [onChange]);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-slate-200"
      style={{ height: 500 }}
      data-testid="email-editor"
    >
      <EmailEditor ref={editorRef} onReady={onReady} minHeight={500} />
    </div>
  );
}

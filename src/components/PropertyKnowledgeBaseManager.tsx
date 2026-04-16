import { useEffect, useState, useRef, useCallback } from 'react';
import { Upload, FileText, Trash2, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface Props {
  propertyId: string;
  /** Called whenever the file list changes (e.g. to refresh badges in parent). */
  onChange?: (count: number) => void;
  /** Hides the heading — useful when embedded inside a step that already has one. */
  compact?: boolean;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.doc,.txt,.md';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB safety cap

function fileNameFromPath(path: string) {
  return path.split('/').pop() || path;
}

export default function PropertyKnowledgeBaseManager({ propertyId, onChange, compact }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('landlord_properties')
      .select('knowledge_base_urls')
      .eq('id', propertyId)
      .maybeSingle();
    const next = ((data?.knowledge_base_urls as string[] | null) || []);
    setPaths(next);
    onChange?.(next.length);
    setLoading(false);
  }, [propertyId, onChange]);

  useEffect(() => { refresh(); }, [refresh]);

  const upload = async (files: FileList | File[]) => {
    if (!user || !propertyId) return;
    const list = Array.from(files);
    if (!list.length) return;

    setUploading(true);
    let okCount = 0;

    for (const file of list) {
      if (file.size > MAX_BYTES) {
        toast({ title: 'File too large', description: `${file.name} exceeds 15 MB.`, variant: 'destructive' });
        continue;
      }
      // Storage path MUST start with the landlord's user id to satisfy RLS.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `${user.id}/${propertyId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage.from('property-docs').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) {
        console.error('[kb-upload] storage error', upErr);
        toast({ title: 'Upload failed', description: `${file.name}: ${upErr.message}`, variant: 'destructive' });
        continue;
      }

      // Trigger parsing — fire-and-await so the user sees the doc in the list once parsed.
      const { error: fnErr } = await supabase.functions.invoke('parse-property-doc', {
        body: { propertyId, storagePath: path },
      });
      if (fnErr) {
        console.error('[kb-upload] parse error', fnErr);
        toast({ title: 'Parsing failed', description: `${file.name}: ${fnErr.message}`, variant: 'destructive' });
        // Best-effort cleanup — file is in storage but won't be referenced
        await supabase.storage.from('property-docs').remove([path]);
        continue;
      }
      okCount += 1;
    }

    setUploading(false);
    if (okCount > 0) {
      toast({ title: `${okCount} document${okCount === 1 ? '' : 's'} added` });
    }
    await refresh();
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async (path: string) => {
    // 1) remove the file from storage
    const { error: rmErr } = await supabase.storage.from('property-docs').remove([path]);
    if (rmErr) {
      toast({ title: 'Could not delete file', description: rmErr.message, variant: 'destructive' });
      return;
    }
    // 2) update the property: drop the path AND strip the file's section from knowledge_base_text
    const { data } = await supabase
      .from('landlord_properties')
      .select('knowledge_base_urls, knowledge_base_text')
      .eq('id', propertyId)
      .maybeSingle();

    const fileName = fileNameFromPath(path);
    const nextUrls = ((data?.knowledge_base_urls as string[] | null) || []).filter(p => p !== path);
    let nextText: string | null = data?.knowledge_base_text || null;
    if (nextText) {
      // Remove the delimited block written by parse-property-doc
      const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\n*===== FILE: ${escaped} =====[\\s\\S]*?===== END FILE: ${escaped} =====\\n*`, 'g');
      nextText = nextText.replace(re, '\n').trim() || null;
    }
    await supabase
      .from('landlord_properties')
      .update({ knowledge_base_urls: nextUrls, knowledge_base_text: nextText })
      .eq('id', propertyId);

    toast({ title: 'Document removed' });
    refresh();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Property knowledge base</h3>
          <p className="text-xs text-muted-foreground">
            Upload house manuals, wifi info, contracts, or appliance guides. The bot uses these to answer tenant questions.
          </p>
        </div>
      )}

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <div className="flex flex-col items-center gap-1.5">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {uploading ? 'Parsing document…' : 'Drop files or tap to upload'}
          </p>
          <p className="text-[11px] text-muted-foreground">PDF, images, DOCX · up to 15 MB each</p>
        </div>
      </label>

      <div className="space-y-1.5">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : paths.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No documents yet.</p>
        ) : (
          paths.map((p) => (
            <div key={p} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-accent/40 border border-border">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">{fileNameFromPath(p)}</span>
              <button
                onClick={() => remove(p)}
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Delete ${fileNameFromPath(p)}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

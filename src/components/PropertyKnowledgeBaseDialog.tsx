import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PropertyKnowledgeBaseManager from './PropertyKnowledgeBaseManager';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress?: string;
  onChange?: (count: number) => void;
}

export default function PropertyKnowledgeBaseDialog({ open, onOpenChange, propertyId, propertyAddress, onChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Knowledge base</DialogTitle>
          <DialogDescription>
            {propertyAddress ? `Documents for ${propertyAddress}.` : 'Upload documents the AI can use to answer tenant questions.'}
          </DialogDescription>
        </DialogHeader>
        <PropertyKnowledgeBaseManager propertyId={propertyId} onChange={onChange} compact />
      </DialogContent>
    </Dialog>
  );
}

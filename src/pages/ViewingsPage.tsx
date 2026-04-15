import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function ViewingsPage() {
  return (
    <div className="px-5 py-5 pb-8">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Viewings</h1>
      <Card className="flex flex-col items-center justify-center py-16 border-dashed">
        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">Coming soon</h3>
        <p className="text-sm text-muted-foreground">Viewing calendar will be available in Day 3</p>
      </Card>
    </div>
  );
}

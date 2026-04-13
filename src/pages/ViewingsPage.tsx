import TopNav from '@/components/TopNav';
import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function ViewingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Viewings</h1>
        <Card className="flex flex-col items-center justify-center py-16 bg-card border-dashed">
          <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground">Viewing calendar will be available in Day 3</p>
        </Card>
      </div>
    </div>
  );
}

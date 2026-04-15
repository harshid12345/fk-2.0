import { Card } from '@/components/ui/card';
import { UserCheck } from 'lucide-react';

export default function TenantsPage() {
  return (
    <div className="px-5 py-5 pb-8">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Tenants</h1>
      <Card className="flex flex-col items-center justify-center py-16 border-dashed">
        <UserCheck className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">Coming soon</h3>
        <p className="text-sm text-muted-foreground">Tenant management will be available in Day 2</p>
      </Card>
    </div>
  );
}

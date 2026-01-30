import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import FiscalGlossary from '@/components/FiscalGlossary';

export default function Glossary() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <FiscalGlossary />
      </div>
    </DashboardLayout>
  );
}

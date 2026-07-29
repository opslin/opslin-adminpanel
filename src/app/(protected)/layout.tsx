import { AdminGate } from "@/components/admin-gate";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}

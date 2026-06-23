import StaffDetail from "@/components/staff/StaffDetail";

export default function StaffDetailPage({ params }: { params: { id: string } }) {
  return <StaffDetail staffId={params.id} />;
}

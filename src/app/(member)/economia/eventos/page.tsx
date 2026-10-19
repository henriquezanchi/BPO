import { getAuthenticatedMember,requireEconomiaOuDirecao } from "@/lib/auth";
import { EventEconomyReport } from "@/components/economia/event-economy-report";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function EventEconomyPage(){
 const member=await getAuthenticatedMember();if(!member)redirect('/login?next=/economia/eventos');
 await requireEconomiaOuDirecao(member.schoolId);if(!member.mercurioAtivo)redirect('/portal');
 return <main className="mx-auto max-w-4xl p-5"><EventEconomyReport schoolId={member.schoolId}/></main>;
}

import { db } from "@/lib/db";
import { assertContributionOrder } from "@/lib/contribution-order";
export async function requireContributionOrder(memberId: string, year: number, month: number) {
  const [monthly,charges] = await Promise.all([
    db.contributionMonthlyStatus.findMany({where:{memberId},select:{year:true,month:true,status:true}}),
    db.paymentCharge.findMany({where:{memberId,status:{in:["pendente","pago"]}},select:{referenceYear:true,referenceMonth:true,status:true}}),
  ]);
  assertContributionOrder({year,month},monthly,charges);
}

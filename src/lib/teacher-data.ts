import { db } from "@/lib/db";

export async function getTeacherClasses(memberId: string) {
  const memberships = await db.classMembership.findMany({
    where: { memberId, role: "professor" },
    include: {
      classGroup: {
        include: {
          _count: { select: { memberships: { where: { role: "aluno" } } } },
          activities: { orderBy: { dueDate: "desc" }, take: 5 },
        },
      },
    },
  });

  return memberships.map((m) => m.classGroup);
}

export type TeacherClass = Awaited<ReturnType<typeof getTeacherClasses>>[number];

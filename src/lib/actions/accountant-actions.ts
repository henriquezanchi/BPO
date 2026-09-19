"use server";

import { requireDirector } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACCOUNTANT_DOCS_BUCKET as BUCKET } from "@/lib/storage-constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/** Cria o bucket privado na 1ª vez que alguém sobe um arquivo — idempotente (Supabase retorna erro se já existir, ignoramos). */
async function garantirBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

async function recalcularHasInvoice(payableId: string) {
  const total = await db.accountantDocument.count({ where: { payableId } });
  await db.payable.update({ where: { id: payableId }, data: { hasInvoice: total > 0 } });
}

/**
 * Recibo/NF real (bucket privado no Supabase Storage) anexado DIRETO na
 * conta a pagar correspondente — decisão explícita do usuário: sem área
 * solta de documentos, pra nunca conciliar o arquivo errado com o
 * pagamento errado. Marca hasInvoice automaticamente.
 */
export async function uploadAccountantDocument(schoolId: string, payableId: string, formData: FormData) {
  await requireDirector(schoolId);
  const payable = await db.payable.findUniqueOrThrow({ where: { id: payableId } });
  if (payable.schoolId !== schoolId) throw new Error("Conta não pertence a esta escola.");

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim() || file?.name || "Documento";
  if (!file || file.size === 0) throw new Error("Selecione um arquivo.");

  await garantirBucket();

  const extensao = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const path = `${schoolId}/${payableId}/${Date.now()}${extensao}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (error) throw new Error(`Falha ao subir o arquivo: ${error.message}`);

  await db.accountantDocument.create({ data: { payableId, title, filePath: path } });
  await recalcularHasInvoice(payableId);
  revalidatePath("/diretor");
}

export async function excluirAccountantDocument(schoolId: string, documentId: string) {
  await requireDirector(schoolId);
  const doc = await db.accountantDocument.findUniqueOrThrow({ where: { id: documentId }, include: { payable: true } });
  if (doc.payable.schoolId !== schoolId) throw new Error("Documento não pertence a esta escola.");

  await supabaseAdmin.storage.from(BUCKET).remove([doc.filePath]);
  await db.accountantDocument.delete({ where: { id: documentId } });
  await recalcularHasInvoice(doc.payableId);
  revalidatePath("/diretor");
}

export async function getAccountantDocumentUrl(schoolId: string, documentId: string): Promise<string> {
  await requireDirector(schoolId);
  const doc = await db.accountantDocument.findUniqueOrThrow({ where: { id: documentId }, include: { payable: true } });
  if (doc.payable.schoolId !== schoolId) throw new Error("Documento não pertence a esta escola.");

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.filePath, 60 * 10);
  if (error || !data) throw new Error("Falha ao gerar link do arquivo.");
  return data.signedUrl;
}

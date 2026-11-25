import type { IconeDestino } from "@/lib/area-trabalho";
import { Award, Banknote, CalendarClock, CalendarDays, ClipboardCheck, Coffee, Crown, DoorOpen, FileSignature, Globe2, GraduationCap, HandHeart, Home, KeyRound, MessageSquareText, Settings, Ticket, Users } from "lucide-react";

/** Ícone de cada destino da Área do Voluntário (menu e atalhos do início usam o mesmo). */
export const ICONES_DESTINOS: Record<IconeDestino, typeof Home> = {
  inicio: Home,
  instrutor: GraduationCap,
  grupos: Users,
  escolastica: CalendarClock,
  avaliacao: ClipboardCheck,
  economia: Banknote,
  eventos: Ticket,
  cafe: Coffee,
  direcao: Crown,
  admin: Settings,
  acessos: KeyRound,
  nacional: Globe2,
  termo: FileSignature,
  calendario: CalendarDays,
  salas: DoorOpen,
  aberturas: GraduationCap,
  secretarias: Users,
  oportunidades: HandHeart,
  trajetoria: Award,
  sugestoes: MessageSquareText,
};

export const SECOES_DESTINOS = ["Meu trabalho", "Secretarias", "Gestão da filial", "Nacional"] as const;

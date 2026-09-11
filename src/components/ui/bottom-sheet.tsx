"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] animate-[sheet-fade-in_0.2s_ease-out]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl animate-[sheet-slide-up_0.25s_ease-out]">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-base font-bold text-na-green-dark">{title}</Dialog.Title>
            <Dialog.Close className="text-muted-foreground text-lg text-gray-400 hover:text-gray-600">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="text-[13px] text-gray-800">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

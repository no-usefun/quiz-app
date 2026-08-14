"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export function Logo() {
  const { user } = useSession();

  const href = user
    ? user.role === "teacher"
      ? "/dashboard/teacher"
      : "/dashboard/student"
    : "/";

  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div className="flex h-8 w-8 items-center justify-center rounded-[8.8px] bg-[#165dfb] text-white font-bold text-xs hover:bg-[#165dfb]/90 transition-colors">
        <ShieldCheck className="h-4 w-4 text-white" />
      </div>
      <span className="text-sm font-bold tracking-tight text-[#111111] group-hover:text-[#165dfb] transition-colors">
        DynoQuizz
      </span>
    </Link>
  );
}

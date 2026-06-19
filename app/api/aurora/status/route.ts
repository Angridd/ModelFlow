import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const latestCurve = await prisma.auroraCurve.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      technology: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    imported: latestCurve !== null,
    technology: latestCurve?.technology ?? null,
    updatedAt: latestCurve?.updatedAt ?? null,
  });
}

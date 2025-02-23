"use client"

import { GlobalLogs } from "@/utils/logger"
import { ColumnDef } from "@tanstack/react-table"


export const columns: ColumnDef<GlobalLogs>[] = [
  {
    accessorKey: "date",
    header: "Date",
  },
  {
    accessorKey: "module",
    header: "Module",
  },
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "type",
    header: "Action",
  },
  {
    accessorKey: "statut",
    header: "Statut",
  }
]

"use client"

import { GlobalLogs } from "@/utils/logger"
import { ColumnDef } from "@tanstack/react-table"
import dayjs from "dayjs"
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime);

export const columns: ColumnDef<GlobalLogs>[] = [
  {
    accessorKey: "date",
    header: "Date",
    accessorFn: row => dayjs(row.date).fromNow(),
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
    // accessorFn: row => row.statut === "success" ? <div className="text-green-800">{row.statut}</div> : <div className="text-red-800">{row.statut}</div>
  }
]

"use client"

import { use } from "react"
import { ConvertForm } from "@/components/convert-form"

export default function ConvertPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = use(params)
  return <ConvertForm groupId={Number(groupId)} groupIdText={groupId} />
}

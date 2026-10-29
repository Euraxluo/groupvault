"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { CreateGroupDialog } from "@/components/create-group-dialog"
import { MobileNavbar } from "@/components/mobile-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewGroupPage() {
  const [open, setOpen] = useState(true)

  return (
    <main className="min-h-screen bg-background">
      <MobileNavbar />
      <div className="mx-auto w-full max-w-lg px-4 pb-28 pt-20">
        <h1 className="text-2xl font-bold tracking-tight">新建群</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          一次钱包签名即可建群。升级为 DAO 是之后单独由群主发起的操作。
        </p>
        <Card className="mt-5 border-dashed shadow-none">
          <CardHeader>
            <CardTitle className="text-base">用钱包创建</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              入群费用配置的 NEP-141 入群币计价。付费进群不会自动获得投票权重。
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              打开创建表单
            </Button>
          </CardContent>
        </Card>
      </div>
      <CreateGroupDialog open={open} onOpenChange={setOpen} />
    </main>
  )
}

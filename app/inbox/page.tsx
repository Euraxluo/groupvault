import { redirect } from "next/navigation"

/** Legacy inbox entry. Pending proposals now live under each DAO. */
export default function InboxPage() {
  redirect("/chat")
}

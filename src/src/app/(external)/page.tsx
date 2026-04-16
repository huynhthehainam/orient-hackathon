import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin/default");
  return <>Coming Soon</>;
}

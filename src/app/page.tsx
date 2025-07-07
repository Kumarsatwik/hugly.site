// import { getQueryClient } from "@/trpc/server";
// import { trpc } from "@/trpc/server";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import { Client } from "./client";
// import { Suspense } from "react";
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";


const Page = () => {
  // const queryClient = getQueryClient();
  // void queryClient.prefetchQuery(
  //   trpc.hello.queryOptions({ text: "text prefetch" })
  // );

  const [value,setValue]=useState("")

  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({
    onSuccess:()=>{
      toast.success("Background task started")
    }
  }));

  return (
    // <HydrationBoundary state={dehydrate(queryClient)}>
    //   <Suspense fallback={<div>Loading...</div>}>
    //     <Client />
    //   </Suspense>
    // </HydrationBoundary>
    <div>
      <Input value={value} onChange={(e)=>setValue(e.target.value)} />
      <Button onClick={() => invoke.mutate({ event: value })}>Click me</Button>
    </div>
  );
};

export default Page;

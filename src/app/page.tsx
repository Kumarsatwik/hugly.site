// import { getQueryClient } from "@/trpc/server";
// import { trpc } from "@/trpc/server";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import { Client } from "./client";
// import { Suspense } from "react";
"use client";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

const Page = () => {
  // const queryClient = getQueryClient();
  // void queryClient.prefetchQuery(
  //   trpc.hello.queryOptions({ text: "text prefetch" })
  // );

  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({}));

  return (
    // <HydrationBoundary state={dehydrate(queryClient)}>
    //   <Suspense fallback={<div>Loading...</div>}>
    //     <Client />
    //   </Suspense>
    // </HydrationBoundary>
    <div>
      <Button onClick={() => invoke.mutate({ event: "text" })}>Click me</Button>
    </div>
  );
};

export default Page;

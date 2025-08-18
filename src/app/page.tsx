"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [value, setValue] = useState("");

  const trpc = useTRPC();
  const { data: messages } = useQuery(trpc.messages.getMany.queryOptions());
  const createMessage = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: (data) => {
        console.log("✅ Message created successfully:", data);
        toast.success(`Message created successfully! ${data.message}`);
        setValue(""); // Clear the input after success
      },
      onError: (error) => {
        console.error("❌ Error creating message:", error);
        toast.error(`Failed to create message: ${error.message}`);
      },
    })
  );

  return (
    <div className="m-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mb-4 border-2 border-gray-300 rounded-md p-2 text-white"
      />
      <Button
        onClick={() => createMessage.mutate({ event: value })}
        disabled={createMessage.isPending || !value.trim()}
      >
        {createMessage.isPending ? "Creating..." : "Create Message"}
      </Button>

      {createMessage.isPending && (
        <p className="mt-2 text-sm text-gray-500">Processing your message...</p>
      )}

      {createMessage.isError && (
        <p className="mt-2 text-sm text-red-500">
          Error: {createMessage.error?.message}
        </p>
      )}

      {createMessage.isSuccess && (
        <p className="mt-2 text-sm text-green-500">
          Message created successfully!
        </p>
      )}

      <div className="flex gap-2 mt-10">
        {messages &&
          messages.map((message) => (
            <div
              key={message.id}
              className="border-2 w-fit border-gray-300 rounded-md p-2 text-white"
            >
              <p>{message.content}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Page;

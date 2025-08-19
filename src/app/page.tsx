"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const [value, setValue] = useState("");
  const router = useRouter();
  const trpc = useTRPC();
  // const { data: messages } = useQuery(trpc.messages.getMany.queryOptions());

  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (data) => {
        console.log("✅ Project created successfully:", data);
        router.push(`/projects/${data.createdProject.id}`);
      },
      onError: (error) => {
        console.error("❌ Error creating project:", error);
        toast.error(`Failed to create project: ${error.message}`);
      },
    })
  );

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="max-w-screen mx-auto flex items-center flex-col gap-y-4 justify-center">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mb-4 border-2 border-gray-300 rounded-md p-2 text-white"
        />
        <Button
          onClick={() => createProject.mutate({ event: value })}
          disabled={createProject.isPending || !value.trim()}
        >
          {createProject.isPending ? "Creating..." : "Create Project"}
        </Button>

        {createProject.isPending && (
          <p className="mt-2 text-sm text-gray-500">
            Processing your message...
          </p>
        )}

        {createProject.isError && (
          <p className="mt-2 text-sm text-red-500">
            Error: {createProject.error?.message}
          </p>
        )}

        {createProject.isSuccess && (
          <p className="mt-2 text-sm text-green-500">
            Project created successfully!
          </p>
        )}
      </div>

      {/* <div className="flex gap-2 mt-10">
        {messages &&
          messages.map((message) => (
            <div
              key={message.id}
              className="border-2 w-fit border-gray-300 rounded-md p-2 text-white"
            >
              <p>{message.content}</p>
            </div>
          ))}
      </div> */}
    </div>
  );
};

export default Page;

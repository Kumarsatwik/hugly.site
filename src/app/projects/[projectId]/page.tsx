import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

interface Props {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function Page({ params }: Props) {
  const { projectId } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Project {projectId}</h1>
      <div>
        <Button>
          <PlusIcon className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

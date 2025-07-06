import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
const Page = async () => {
  
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1>Users</h1>
      <ul>
        
      </ul>
      <Button>Click me</Button>
    </div>
  );
};

export default Page;

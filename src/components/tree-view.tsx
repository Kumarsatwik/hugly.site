import { TreeItem } from "@/types";

interface TreeViewProps {
  data: TreeItem[];
  value?: string | null;
  onSelect?: (filePath: string) => void;
}

export const TreeView = ({ data, value, onSelect }: TreeViewProps) => {
  return <p>{JSON.stringify(data)} </p>;
};

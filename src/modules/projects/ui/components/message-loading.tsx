import Image from "next/image";
import { useEffect, useState } from "react";

export const ShimmerMessage = () => {
  const messages = [
    "Thinking...",
    "Loading...",
    "Preparing...",
    "Generating...",
    "Analyzing your request...",
    "Building your website...",
    "Crafting components...",
    "Optimizing layout...",
    "Adding final touches...",
    "Almost ready...",
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground animate-pulse">
        {messages[currentMessageIndex]}
      </span>
    </div>
  );
};

export const MessageLoading = () => {
  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.png"
          alt="logo"
          width={24}
          height={24}
          className="rounded-full shrink-0"
        />
        <span className="text-sm font-medium">Vibe</span>
      </div>
      <div className="flex flex-col gap-y-4 pl-8.5">
        <ShimmerMessage />
      </div>
    </div>
  );
};

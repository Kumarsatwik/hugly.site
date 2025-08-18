
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import z from "zod";

export const messagesRouter = createTRPCRouter({

    getMany:baseProcedure.query(async()=>{
        const messages = await prisma.message.findMany({
            orderBy:{
                updatedAt:"desc"
            }
        })
        return messages
    }),

  create: baseProcedure
    .input(
      z.object({
        event: z.string().min(1, { message: "Message is required" }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        console.log("🚀 Creating message with input:", input);

        const newMessage = await prisma.message.create({
          data: {
            content: input.event,
            role: "USER",
            type: "RESULT",
          },
        });

        console.log("✅ Message created successfully:", newMessage);
        console.log("📤 Sending Inngest event with data:", {
          value: input.event,
        });

        const inngestResult = await inngest.send({
          name: "code-agent/run",
          data: {
            value: input.event,
          },
        });

        console.log("✅ Inngest event sent successfully:", inngestResult);

        return {
          success: true,
          message: "Background task started successfully",
          newMessage,
          inngestResult,
        };
      } catch (error) {
        console.error("❌ Error in message creation:", error);
        throw new Error(
          `Failed to create message: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }),
});

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import z from "zod";

export const messagesRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      })
    )
    .query(async ({ input }) => {
      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          fragments: true,
        },
        orderBy: {
          updatedAt: "asc",
        },
      });
      return messages;
    }),

  create: baseProcedure
    .input(
      z.object({
        event: z
          .string()
          .min(1, { message: "Message is required" })
          .max(10000, { message: "Message is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const createdMessage = await prisma.message.create({
          data: {
            projectId: input.projectId,
            content: input.event,
            role: "USER",
            type: "RESULT",
          },
        });

        await inngest.send({
          name: "code-agent/run",
          data: {
            value: input.event,
            projectId: input.projectId,
          },
        });

        return {
          success: true,
          message: "Background task started successfully",
          createdMessage,
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

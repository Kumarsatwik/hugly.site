import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import z from "zod";
import { generateSlug } from "random-word-slugs";

export const projectsRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    const messages = await prisma.message.findMany({
      orderBy: {
        updatedAt: "desc",
      },
    });
    return messages;
  }),

  create: baseProcedure
    .input(
      z.object({
        event: z.string().min(1, { message: "Message is required" }).max(10000, { message: "Message is too long" }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const createdProject = await prisma.project.create({
          data: {
            name: generateSlug(2, {
              format: "title",
            }),
            messages: {
              create: {
                content: input.event,
                role: "USER",
                type: "RESULT",
              },
            },
          },
        });

         await inngest.send({
          name: "code-agent/run",
          data: {
            value: input.event,
            projectId: createdProject.id,
          },
        });

        return {
          success: true,
          message: "Background task started successfully",
          createdProject,
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

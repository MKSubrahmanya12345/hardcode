import mongoose from "mongoose";
import Project from "../models/project.model.js";
import { processInput } from "../services/ai.services.js";

const isIdeaFinalized = (project) => {
  return Boolean(project?.ideaState?.summary?.trim()) && (project?.ideaState?.unknowns?.length ?? 0) === 0;
};

export const createIdeationProject = async (req, res) => {
  try {
    const { description } = req.body;
    const normalizedDescription = description?.trim();

    if (!normalizedDescription) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (!req.user?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const recentSameProject = await Project.findOne({
      owner: req.user._id,
      description: normalizedDescription,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (recentSameProject) {
      const latestReply = [...(recentSameProject.messages || [])]
        .reverse()
        .find(msg => msg.role === "ai")?.content || "Project already exists.";

      return res.json({
        projectId: recentSameProject._id,
        reply: latestReply,
        question: "",
        ideaState: recentSameProject.ideaState,
        ideationFinalized: isIdeaFinalized(recentSameProject),
        deduped: true
      });
    }

    const project = await Project.create({
      description: normalizedDescription,
      owner: req.user._id,
      messages: [{ role: "user", content: normalizedDescription }],
      ideaState: {
        summary: "",
        requirements: [],
        unknowns: []
      },
      meta: { stage: "idea" }
    });

    const ai = await processInput(project, normalizedDescription);

    project.ideaState = {
      summary: ai.summary,
      requirements: ai.requirements,
      unknowns: ai.unknowns
    };

    project.meta.stage = isIdeaFinalized(project) ? "components" : "idea";

    project.messages.push({
      role: "ai",
      content: ai.assistantReply
    });

    await project.save();

    res.json({
      projectId: project._id,
      reply: ai.assistantReply,
      question: ai.question,
      ideaState: project.ideaState,
      ideationFinalized: isIdeaFinalized(project)
    });
  } catch (err) {
    console.error("IDEATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

export const chatIdeationProject = async (req, res) => {
  try {
    const { projectId, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ error: "Invalid projectId" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden" });
    }

    project.messages.push({
      role: "user",
      content: message.trim()
    });

    const ai = await processInput(project, message);

    project.ideaState = {
      summary: ai.summary,
      requirements: ai.requirements,
      unknowns: ai.unknowns
    };

    project.meta.stage = isIdeaFinalized(project) ? "components" : "idea";

    project.messages.push({
      role: "ai",
      content: ai.assistantReply
    });

    await project.save();

    res.json({
      reply: ai.assistantReply,
      question: ai.question,
      ideaState: project.ideaState,
      ideationFinalized: isIdeaFinalized(project)
    });
  } catch (err) {
    console.error("IDEATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
import type { Subcommand } from "@sapphire/plugin-subcommands";
import type { SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import type { OsuCommand } from "../../commands/osu.command";
import { ExtendedError } from "../../lib/extended-error";
import { scoreHuntService } from "../../lib/services/score-hunt.service";

export function addScoreHuntStartSubcommand(command: SlashCommandSubcommandBuilder) {
  return command
    .setName("score-hunt-start")
    .setDescription("Arm a score hunt for the next in-game bot score");
}

export async function chatInputRunScoreHuntStartSubcommand(
  this: OsuCommand,
  interaction: Subcommand.ChatInputCommandInteraction,
) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    throw new ExtendedError("Score hunts can only be started inside a server.");
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    throw new ExtendedError("You must be a server administrator to start a score hunt.");
  }

  try {
    const hunt = scoreHuntService.armHunt(interaction.guildId, interaction.user.id);

    await interaction.editReply({
      embeds: [
        this.container.utilities.embedPresets.getSuccessEmbed(
          "Score hunt armed",
          `Waiting for the next in-game bot score. Duration will be ${scoreHuntService.formatDuration(hunt?.duration_seconds ?? 0)}.`,
        ),
      ],
    });
  }
  catch (error) {
    throw new ExtendedError(error instanceof Error ? error.message : "Couldn't start score hunt.");
  }
}
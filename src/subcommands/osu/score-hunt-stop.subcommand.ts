import type { Subcommand } from "@sapphire/plugin-subcommands";
import type { SlashCommandSubcommandBuilder } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import type { OsuCommand } from "../../commands/osu.command";
import { ExtendedError } from "../../lib/extended-error";
import { scoreHuntService } from "../../lib/services/score-hunt.service";

export function addScoreHuntStopSubcommand(command: SlashCommandSubcommandBuilder) {
  return command
    .setName("score-hunt-stop")
    .setDescription("Stop the current score hunt");
}

export async function chatInputRunScoreHuntStopSubcommand(
  this: OsuCommand,
  interaction: Subcommand.ChatInputCommandInteraction,
) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    throw new ExtendedError("Score hunts can only be stopped inside a server.");
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    throw new ExtendedError("You must be a server administrator to stop a score hunt.");
  }

  try {
    scoreHuntService.stopHunt(interaction.guildId);

    await interaction.editReply({
      embeds: [
        this.container.utilities.embedPresets.getSuccessEmbed(
          "Score hunt stopped",
          "The current armed or active score hunt has been cancelled.",
        ),
      ],
    });
  }
  catch (error) {
    throw new ExtendedError(error instanceof Error ? error.message : "Couldn't stop the score hunt.");
  }
}
